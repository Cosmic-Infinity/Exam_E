from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import F
from django.utils.crypto import get_random_string
from django.shortcuts import render
from django.urls import path
from django import forms
import json
from .models import Exam, CourseAllocation, AcademicSession, School, User, Stream, Course, Enrollment, ExamPaper, Student, Teacher, Grievance, DataImport
from .forms import ExamForm, UserCreationForm, UserChangeForm, CSVImportForm
from .tasks import send_credentials_email
from .services import importer


@admin.register(AcademicSession)
class AcademicSessionAdmin(admin.ModelAdmin):
    list_display = ('label', 'is_active')
    search_fields = ('label',)


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')
    search_fields = ('code', 'name')


@admin.register(Stream)
class StreamAdmin(admin.ModelAdmin):
    list_display = ('name', 'degree_type', 'school')
    list_filter = ('degree_type', 'school')
    search_fields = ('name',)
    autocomplete_fields = ['school']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Full UserAdmin — supports creating users with hashed passwords,
    editing existing users, and the built-in password-change form.
    Required for autocomplete_fields in other admins to work.
    """
    form         = UserChangeForm
    add_form     = UserCreationForm

    list_display  = ('university_id', 'email', 'full_name', 'role', 'is_active', 'is_staff')
    list_filter   = ('role', 'is_active', 'is_staff')
    search_fields = ('university_id', 'full_name', 'email')
    ordering      = ('email',)
    filter_horizontal = ()

    fieldsets = (
        (None,            {'fields': ('email', 'university_id', 'password')}),
        ('Personal info', {'fields': ('full_name', 'role')}),
        ('Permissions',   {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Dates',         {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'university_id', 'full_name', 'role',
                       'password1', 'password2',
                       'is_active', 'is_staff', 'is_superuser'),
        }),
    )

    readonly_fields = ('last_login', 'date_joined')
    actions = ['generate_and_email_credentials']

    def generate_and_email_credentials(self, request, queryset):
        """
        Generates a random password for selected users, sets it,
        and sends an email with the new credentials.
        """
        if not request.user.is_superuser:
            self.message_user(request, "Only superusers can perform this action.", level='error')
            return

        count = 0
        for user in queryset:
            # Generate a secure 12-char alphanumeric password
            plain_password = get_random_string(length=12)
            
            # Set the password (hashes it)
            user.set_password(plain_password)
            user.save()
            
            # Send the email with the PLAIN password
            send_credentials_email.delay(user.pk, plain_password)
            count += 1
            
        self.message_user(request, f"New credentials generated and emailed to {count} users.")
    
    generate_and_email_credentials.short_description = "Generate passwords & email credentials"

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('course_code', 'title', 'credits', 'course_type', 'coordinator')
    search_fields = ('course_code', 'title', 'coordinator__full_name')
    list_filter = ('course_type',)
    autocomplete_fields = ['coordinator']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "coordinator":
            # Only allow selecting Teachers as coordinators (Controllers are also teachers)
            kwargs["queryset"] = User.objects.filter(role__in=['TEACHER', 'CONTROLLER'])
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(CourseAllocation)
class CourseAllocationAdmin(admin.ModelAdmin):
    list_display = ('course', 'section_name', 'session', 'teacher', 'semester')
    list_filter = ('session', 'course', 'semester')
    search_fields = ('course__course_code', 'teacher__full_name')
    autocomplete_fields = ['course', 'session', 'teacher']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "teacher":
            kwargs["queryset"] = User.objects.filter(role='TEACHER')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'allocation', 'enrollment_type', 'status')
    list_filter = ('status', 'enrollment_type')
    search_fields = ('student__university_id', 'allocation__course__course_code')
    autocomplete_fields = ['student', 'allocation']

@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    form = ExamForm
    # We use a custom template to add the drill-down filters
    change_form_template = 'admin/core/exam/change_form.html'
    
    list_display = ('exam_type', 'total_marks', 'allocation', 'is_active')
    list_filter = ('exam_type', 'is_active')
    search_fields = ('allocation__course__course_code',)
    autocomplete_fields = ['allocation']
    fieldsets = (
        (None, {
            'fields': ('allocation', 'exam_type', 'total_marks', 'is_active')
        }),
        ('Schema Configuration', {
            'fields': ('apply_to_all_sections', 'question_paper_schema',),
            'description': 'Use the builder below to define sections and questions.'
        }),
    )

    def render_change_form(self, request, context, add=False, change=False, form_url='', obj=None):
        if context is None:
            context = {}
            
        # Build hierarchy for frontend drill-down
        allocs = CourseAllocation.objects.select_related('course', 'session') \
            .filter(session__is_active=True) \
            .annotate(
                code=F('course__course_code'),
                title=F('course__title'),
                sem=F('semester')
            ).values(
                'allocation_id', 'sem', 'code', 'title', 'section_name'
            ).order_by('sem', 'code', 'section_name')

        hierarchy = {}
        for a in allocs:
            sem_key = str(a['sem'])
            code_title = f"{a['code']} - {a['title']}"
            
            if sem_key not in hierarchy:
                hierarchy[sem_key] = {}
            if code_title not in hierarchy[sem_key]:
                hierarchy[sem_key][code_title] = []
            
            hierarchy[sem_key][code_title].append({
                'section': a['section_name'], 
                'id': a['allocation_id']
            })

        context['allocation_hierarchy_json'] = json.dumps(hierarchy)
        return super().render_change_form(request, context, add, change, form_url, obj)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        if form.cleaned_data.get('apply_to_all_sections'):
            # Propagate schema to other sections of the same course & session
            course = obj.allocation.course
            session = obj.allocation.session
            exam_type = obj.exam_type
            
            # Find all sibling allocations
            sibling_allocations = CourseAllocation.objects.filter(
                course=course,
                session=session
            ).exclude(pk=obj.allocation.pk)
            
            count = 0
            for allocation in sibling_allocations:
                # Find or create the exam for this sibling allocation
                sibling_exam, created = Exam.objects.get_or_create(
                    allocation=allocation,
                    exam_type=exam_type,
                    defaults={
                        'total_marks': obj.total_marks,
                        'question_paper_schema': obj.question_paper_schema,
                        'is_active': obj.is_active
                    }
                )
                
                # If it already existed, update it
                if not created:
                    sibling_exam.total_marks = obj.total_marks
                    sibling_exam.question_paper_schema = obj.question_paper_schema
                    sibling_exam.is_active = obj.is_active
                    sibling_exam.save()
                
                count += 1
            
            self.message_user(request, f"Schema applied to {count} other sections.")

@admin.register(ExamPaper)
class ExamPaperAdmin(admin.ModelAdmin):
    list_display = ('paper_id', 'enrollment', 'exam', 'evaluation_status')
    list_filter = ('evaluation_status', 'exam__exam_type')
    search_fields = ('enrollment__student__university_id',)
    autocomplete_fields = ['enrollment', 'exam']

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('user', 'stream', 'current_semester', 'section_name', 'batch')
    list_filter = ('stream', 'current_semester', 'batch')
    search_fields = ('user__university_id', 'user__full_name')
    autocomplete_fields = ['user', 'stream']
    actions = ['generate_and_email_student_credentials']

    def changelist_view(self, request, extra_context=None):
        if extra_context is None:
            extra_context = {}
        extra_context['password_management_url'] = '/admin/core/password_management/'
        return super().changelist_view(request, extra_context=extra_context)

    def generate_and_email_student_credentials(self, request, queryset):
        """
        Admin action to generate and send login credentials to selected students.
        """
        if not request.user.is_superuser:
            self.message_user(request, "Only superusers can perform this action.", level='error')
            return

        count = 0
        for student in queryset:
            user = student.user
            # Default to 8-digit numeric if triggered from main StudentAdmin list
            plain_password = get_random_string(length=8, allowed_chars='0123456789')
            user.set_password(plain_password)
            user.save()
            send_credentials_email.delay(user.pk, plain_password)
            count += 1
            
        self.message_user(request, f"Generated & emailed credentials to {count} students.")
    
    generate_and_email_student_credentials.short_description = "Generate & Email selected student credentials"

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('user', 'school', 'specialization', 'is_coordinator')
    list_filter = ('school', 'is_coordinator')
    search_fields = ('user__university_id', 'user__full_name')
    autocomplete_fields = ['user', 'school']
    actions = ['generate_and_email_teacher_credentials']

    def generate_and_email_teacher_credentials(self, request, queryset):
        """
        Admin action to generate and send login credentials to selected teachers.
        """
        if not request.user.is_superuser:
            self.message_user(request, "Only superusers can perform this action.", level='error')
            return

        count = 0
        for teacher in queryset:
            user = teacher.user
            # Default to 8-digit numeric for teachers as well
            plain_password = get_random_string(length=8, allowed_chars='0123456789')
            user.set_password(plain_password)
            user.save()
            send_credentials_email.delay(user.pk, plain_password)
            count += 1
            
        self.message_user(request, f"Generated & emailed credentials to {count} teachers.")
    
    generate_and_email_teacher_credentials.short_description = "Generate & Email selected teacher credentials"

    def get_form(self, request, obj=None, **kwargs):
        # We need to manually set the form attribute for the ModelAdmin usage
        # This wrapper is needed because `self.form` above is referencing the class directly
        # Django expects `form` attribute on ModelAdmin or `get_form` return type
        defaults = {}
        if self.form is None:
             defaults['form'] = self.TeacherAdminForm
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "user":
            # Only show users who are TEACHERs
            kwargs["queryset"] = User.objects.filter(role='TEACHER')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    # ---------------------------------------------------------
    # CUSTOM LOGIC TO ASSIGN COORDINATOR
    # ---------------------------------------------------------

    class TeacherAdminForm(forms.ModelForm):
        coordinated_course = forms.ModelChoiceField(
            queryset=Course.objects.all(),
            required=False,
            label="Assign as Coordinator for Course",
            help_text="If 'Is Coordinator' is checked, you MUST select a course here. This will set this teacher as the coordinator for the selected course."
        )

        class Meta:
            model = Teacher
            fields = '__all__'

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            # Find the course this teacher is already coordinating
            if self.instance and self.instance.pk:
                try:
                    # User is the related object
                    current_coordinated_courses = Course.objects.filter(coordinator=self.instance.user)
                    if current_coordinated_courses.exists():
                        self.fields['coordinated_course'].initial = current_coordinated_courses.first()
                except Exception:
                    pass

        def clean(self):
            cleaned_data = super().clean()
            is_coordinator = cleaned_data.get('is_coordinator')
            course = cleaned_data.get('coordinated_course')

            # VALIDATION RULE: If checked, must pick a course
            if is_coordinator and not course:
                self.add_error('coordinated_course', "You marked this teacher as a Coordinator. You must select which course they coordinate.")
            
            return cleaned_data

    form = TeacherAdminForm

    def save_model(self, request, obj, form, change):
        # 1. Save the Teacher model (updates is_coordinator flag)
        super().save_model(request, obj, form, change)
        
        # 2. Handle the Course update
        is_coordinator = form.cleaned_data.get('is_coordinator')
        new_course = form.cleaned_data.get('coordinated_course')
        
        # We need the User object linked to this Teacher
        user_instance = obj.user
        
        if is_coordinator and new_course:
            # A. Remove this teacher from any OTHER courses they might be coordinating
            #    This ensures 1 teacher -> 1 course (if that's the rule), or just avoids stale data
            Course.objects.filter(coordinator=user_instance).exclude(pk=new_course.pk).update(coordinator=None)
            
            # B. Assign them to the NEW course
            new_course.coordinator = user_instance
            new_course.save()
            
            # self.message_user(request, f"Successfully assigned {user_instance.full_name} as coordinator for {new_course.title}.")
            
        elif not is_coordinator:
            # If they are NOT a coordinator anymore, remove them from ANY course
            Course.objects.filter(coordinator=user_instance).update(coordinator=None)

@admin.register(Grievance)
class GrievanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'paper', 'status', 'assigned_coordinator')
    list_filter = ('status',)
    search_fields = ('paper__enrollment__student__university_id',)
    autocomplete_fields = ['paper', 'assigned_coordinator']


@admin.register(DataImport)
class DataImportAdmin(admin.ModelAdmin):
    change_list_template = "admin/csv_import.html"

    def changelist_view(self, request, extra_context=None):
        form = CSVImportForm()
        result = None
        
        if request.method == 'POST':
            form = CSVImportForm(request.POST, request.FILES)
            if form.is_valid():
                import_type = form.cleaned_data['import_type']
                csv_file = request.FILES['csv_file']
                
                try:
                    if import_type == 'school_stream':
                        result = importer.import_schools_streams(csv_file)
                    elif import_type == 'student':
                        result = importer.import_students(csv_file)
                    elif import_type == 'teacher':
                        result = importer.import_teachers(csv_file)
                    elif import_type == 'course':
                        result = importer.import_courses(csv_file)
                    elif import_type == 'allocation':
                        result = importer.import_allocations(csv_file)
                    elif import_type == 'enrollment':
                        result = importer.import_enrollments(csv_file)
                        
                    if result:
                        level = 'success' if not result.get('errors') else 'warning'
                        self.message_user(request, result['message'], level=level)
                except Exception as e:
                    self.message_user(request, f"Fatal Error: {str(e)}", level='error')
                    result = {'errors': [str(e)], 'message': 'Import Failed'}

        context = {
            **self.admin_site.each_context(request),
            'opts': self.model._meta,
            'form': form,
            'result': result,
            'title': 'Bulk Data Import'
        }
        return render(request, "admin/csv_import.html", context)

    def has_add_permission(self, request):
        return False
        
    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
        
    def has_view_permission(self, request, obj=None):
        return True

