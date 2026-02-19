from django.contrib import admin
from django.db.models import F
import json
from .models import Exam, CourseAllocation, AcademicSession, School, User, Stream, Course, Enrollment, ExamPaper, Student, Teacher, Grievance
from .forms import ExamForm

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

# User admin is required for autocomplete_fields in other admins to work
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('university_id', 'full_name', 'role', 'is_active')
    search_fields = ('university_id', 'full_name')
    list_filter = ('role',)
    
    # Hide from main dashboard if desired, but must be registered
    def has_module_permission(self, request):
        return False

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('course_code', 'title', 'credits', 'course_type')
    search_fields = ('course_code', 'title')
    list_filter = ('course_type',)

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

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('user', 'school', 'specialization', 'is_coordinator')
    list_filter = ('school', 'is_coordinator')
    search_fields = ('user__university_id', 'user__full_name')
    autocomplete_fields = ['user', 'school']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "user":
            # Only show users who are TEACHERs
            kwargs["queryset"] = User.objects.filter(role='TEACHER')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(Grievance)
class GrievanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'paper', 'status', 'assigned_coordinator')
    list_filter = ('status',)
    search_fields = ('paper__enrollment__student__university_id',)
    autocomplete_fields = ['paper', 'assigned_coordinator']

