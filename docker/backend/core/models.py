from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.utils import timezone
from django.utils.html import mark_safe

class AcademicSession(models.Model):
    session_id = models.AutoField(primary_key=True)
    label = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'academic_sessions'
    
    def __str__(self):
        return self.label

class School(models.Model):
    school_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'schools'
    
    def __str__(self):
        return self.code

class Stream(models.Model):
    stream_id = models.AutoField(primary_key=True)
    school = models.ForeignKey(School, on_delete=models.DO_NOTHING)
    name = models.CharField(max_length=100)
    degree_type = models.CharField(max_length=20, null=True, blank=True, choices=[
        ('B.TECH', 'B.Tech'),
        ('M.TECH', 'M.Tech'),
        ('B.SC', 'B.Sc'),
        ('M.SC', 'M.Sc'),
        ('PHD', 'Ph.D'),
    ])

    class Meta:
        managed = False
        db_table = 'streams'
    
    def __str__(self):
        return f"{self.name} ({self.degree_type})"

class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email must be set')
        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        # System admins use is_staff/is_superuser flags for Django Admin access only
        extra_fields.setdefault('role', 'TEACHER')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.AutoField(primary_key=True)
    university_id = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    ROLE_CHOICES = (
        ('CONTROLLER', 'Controller of Examination'), # Global Viewer
        ('TEACHER', 'Teacher'),
        ('STUDENT', 'Student'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='STUDENT',
        help_text=mark_safe(
            '<div style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba; border-radius: 4px; margin-top: 5px;">'
            '<strong>FOR COURSE COORDINATORS:</strong> Select <em>Teacher</em> here.<br>'
            'Then go to the <strong>Courses</strong> menu to assign them as a coordinator.'
            '</div>'
        )
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False,
        help_text="(Built-in Django) ⚠️ ADMIN PANEL ACCESS. Check strictly for System Administrators. Students/Teachers must be UNCHECKED."
    )
    is_superuser = models.BooleanField(
        default=False,
        help_text="(Built-in Django) ⚠️ GOD MODE. Grants full permission to modify ANY data. Check strictly for Main System Admin."
    )

    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name', 'university_id']

    class Meta:
        db_table = 'users'
        managed = False

    def __str__(self):
        return f"{self.full_name} ({self.university_id})"

class Student(models.Model):
    # OneToOne relation to User. DB has user_id as PK and FK.
    user = models.OneToOneField(User, on_delete=models.DO_NOTHING, primary_key=True, db_column='user_id', related_name='student_profile')
    stream = models.ForeignKey(Stream, on_delete=models.DO_NOTHING, null=True, blank=True)
    current_semester = models.IntegerField(default=1)
    section_name = models.CharField(max_length=10, null=True, blank=True)
    batch = models.CharField(max_length=10, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'students'

    def __str__(self):
        return f"Student Profile: {self.user.university_id}"

class Teacher(models.Model):
    # OneToOne relation to User. DB has user_id as PK and FK.
    user = models.OneToOneField(User, on_delete=models.DO_NOTHING, primary_key=True, db_column='user_id', related_name='teacher_profile')
    school = models.ForeignKey(School, on_delete=models.DO_NOTHING, null=True, blank=True)
    specialization = models.CharField(max_length=100, null=True, blank=True)
    # Controller capabilities are handled by User.role == 'CONTROLLER'
    is_coordinator = models.BooleanField(default=False) # Legacy flag, use Course.coordinator field

    class Meta:
        managed = False
        db_table = 'teachers'

    def __str__(self):
        return f"Teacher Profile: {self.user.university_id}"

class DataImport(models.Model):
    class Meta:
        managed = False  # No database table
        verbose_name = "Data Import Tool"
        verbose_name_plural = "Data Import Tool"

class Course(models.Model):
    course_code = models.CharField(max_length=15, primary_key=True)
    title = models.CharField(max_length=100)
    credits = models.IntegerField(default=4)
    course_type = models.CharField(max_length=20, null=True, blank=True, choices=[
        ('CORE', 'Core Course'),
        ('PE', 'Professional Elective'),
        ('OE', 'Open Elective'),
    ])
    # Link to the Teacher who coordinates this course
    coordinator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='coordinated_courses', limit_choices_to={'role': 'TEACHER'})

    class Meta:
        managed = False
        db_table = 'courses'

    def __str__(self):
        return f"{self.course_code} - {self.title}"

class CourseAllocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    # Yes, it is a FK. We should use ForeignKey in Django.
    course = models.ForeignKey(Course, on_delete=models.DO_NOTHING, db_column='course_code')
    section_name = models.CharField(max_length=10)
    session = models.ForeignKey(AcademicSession, on_delete=models.DO_NOTHING)
    teacher = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True)
    semester = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'course_allocations'

    def __str__(self):
        return f"{self.course.course_code} - Sec {self.section_name} ({self.session.label})"

class Enrollment(models.Model):
    enrollment_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.DO_NOTHING, related_name='enrollments')
    allocation = models.ForeignKey(CourseAllocation, on_delete=models.DO_NOTHING)
    enrollment_type = models.CharField(max_length=20, default='REGULAR', choices=[
        ('REGULAR', 'Regular'),
        ('BACKLOG', 'Backlog'),
    ])
    status = models.CharField(max_length=20, default='ACTIVE', choices=[
        ('ACTIVE', 'Active'),
        ('DROPPED', 'Dropped'),
        ('COMPLETED', 'Completed'),
    ])

    class Meta:
        managed = False
        db_table = 'enrollments'

    def __str__(self):
        return f"{self.student.university_id} -> {self.allocation.course.course_code}"

class ExamPaper(models.Model):
    paper_id = models.AutoField(primary_key=True)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.DO_NOTHING)
    exam = models.ForeignKey('Exam', on_delete=models.DO_NOTHING, null=True, blank=True)
    file_path = models.TextField()
    marks_json = models.JSONField(null=True, blank=True)
    total_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    evaluation_status = models.CharField(max_length=20, default='PENDING', choices=[
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REVALUATION', 'Revaluation')
    ])

    class Meta:
        managed = False
        db_table = 'exam_papers'

    def __str__(self):
        return f"Paper {self.paper_id} ({self.evaluation_status})"

class Grievance(models.Model):
    id = models.AutoField(primary_key=True)
    paper = models.ForeignKey(ExamPaper, on_delete=models.DO_NOTHING)
    student_comment = models.TextField(null=True, blank=True)
    assigned_coordinator = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True, related_name='assigned_grievances', db_column='assigned_coordinator')
    status = models.CharField(max_length=20, default='OPEN', choices=[
        ('OPEN', 'Open'),
        ('RESOLVED', 'Resolved'),
        ('REJECTED', 'Rejected'),
    ])

    class Meta:
        managed = False
        db_table = 'grievances'
    
    def __str__(self):
        return f"Grievance {self.id} ({self.status})"

class Exam(models.Model):
    exam_id = models.AutoField(primary_key=True)
    allocation = models.ForeignKey(CourseAllocation, on_delete=models.DO_NOTHING)
    exam_type = models.CharField(max_length=20, choices=[
        ('MIDSEM', 'Mid Semester'),
        ('ENDSEM', 'End Semester'),
        ('QUIZ', 'Quiz')
    ])
    total_marks = models.IntegerField()
    passing_marks = models.IntegerField(null=True, blank=True)
    question_paper_schema = models.JSONField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'exams'

    def __str__(self):
        return f"{self.exam_type} - {self.total_marks} Marks"
