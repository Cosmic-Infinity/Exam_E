from django.db import models

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

class User(models.Model):
    id = models.AutoField(primary_key=True)
    university_id = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=100)
    email = models.CharField(max_length=100, null=True, blank=True)
    role = models.CharField(max_length=20)
    password_hash = models.CharField(max_length=255)
    # is_active is not in DB schema for users table. 
    # But Django Admin might need it. We can add a property or field if we migrate DB.
    # Since we use managed=False, we must match DB.
    # However, for Auth, Django expects is_active.
    # We will remove it for now to fix the crash, but this User model 
    # might not work well as a Standard Django User without it.
    # Recommendation: Add is_active column to users table in DB.
    
    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return f"{self.full_name} ({self.university_id})"

    @property
    def is_active(self):
        return True

    @property
    def is_staff(self):
         return self.role in ['ADMIN', 'COORDINATOR']

    @property
    def is_superuser(self):
        return self.role == 'ADMIN'

    def has_perm(self, perm, obj=None):
        return self.is_staff

    def has_module_perms(self, app_label):
        return self.is_staff

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
    is_coordinator = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = 'teachers'

    def __str__(self):
        return f"Teacher Profile: {self.user.university_id}"

class Course(models.Model):
    course_code = models.CharField(max_length=15, primary_key=True)
    title = models.CharField(max_length=100)
    credits = models.IntegerField(default=4)
    course_type = models.CharField(max_length=20, null=True, blank=True, choices=[
        ('CORE', 'Core Course'),
        ('PE', 'Professional Elective'),
        ('OE', 'Open Elective'),
    ])

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
