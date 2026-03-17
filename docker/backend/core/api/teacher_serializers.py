from rest_framework import serializers
from core.models import Course, CourseAllocation, AcademicSession, Exam, ExamPaper, Grievance

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['course_code', 'title', 'credits', 'course_type']

class AcademicSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ['session_id', 'label', 'is_active']

class CourseAllocationSerializer(serializers.ModelSerializer):
    """
    Used for the teacher dashboard to show assigned classes.
    """
    course = CourseSerializer(read_only=True)
    session = AcademicSessionSerializer(read_only=True)
    
    class Meta:
        model = CourseAllocation
        fields = ['allocation_id', 'course', 'section_name', 'semester', 'session']

class ExamSerializer(serializers.ModelSerializer):
    """
    Used to list exams (Midsem, Endsem) for a specific allocation.
    """
    class Meta:
        model = Exam
        fields = ['exam_id', 'exam_type', 'total_marks', 'passing_marks', 'is_active', 'created_at']

class ExamPaperListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing papers in the teacher dashboard.
    Don't include heavy JSON or file paths here.
    """
    student_university_id = serializers.CharField(source='enrollment.student.university_id', read_only=True)
    student_name = serializers.CharField(source='enrollment.student.full_name', read_only=True)
    has_grievance = serializers.BooleanField(read_only=True, default=False)
    
    class Meta:
        model = ExamPaper
        fields = ['paper_id', 'student_university_id', 'student_name', 'total_score', 'evaluation_status', 'has_grievance']

class ExamPaperDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for grading a paper. Includes file paths and marks JSON.
    """
    student_university_id = serializers.CharField(source='enrollment.student.university_id', read_only=True)
    student_name = serializers.CharField(source='enrollment.student.full_name', read_only=True)
    question_paper_schema = serializers.JSONField(source='exam.question_paper_schema', read_only=True)
    exam_total_marks = serializers.IntegerField(source='exam.total_marks', read_only=True)
    has_grievance = serializers.BooleanField(read_only=True, default=False)
    grievance_text = serializers.CharField(read_only=True, allow_null=True)
    grievance_date = serializers.IntegerField(read_only=True, allow_null=True)
    
    # URL Generators
    question_paper_path = serializers.SerializerMethodField()
    answer_key_path = serializers.SerializerMethodField()
    pages = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamPaper
        fields = [
            'paper_id', 
            'student_university_id', 
            'student_name', 
            'pages',
            'marks_json', 
            'total_score', 
            'evaluation_status',
            'has_grievance',
            'grievance_text',
            'grievance_date',
            'question_paper_schema',
            'exam_total_marks',
            'question_paper_path',
            'answer_key_path'
        ]
        read_only_fields = ['paper_id', 'student_university_id', 'student_name', 'pages', 'question_paper_schema', 'exam_total_marks', 'question_paper_path', 'answer_key_path']

    def get_pages(self, obj):
        pages = obj.pages or []
        return [f"/api/teacher/paper/{obj.paper_id}/page/{index + 1}/" for index in range(len(pages))]

    def get_question_paper_path(self, obj):
        if obj.exam and obj.exam.question_paper_path:
            return f"/api/teacher/paper/{obj.paper_id}/question-paper/"
        return None

    def get_answer_key_path(self, obj):
        if obj.exam and obj.exam.answer_key_path:
            return f"/api/teacher/paper/{obj.paper_id}/answer-key/"
        return None


class FacultyGrievanceListSerializer(serializers.ModelSerializer):
    paper_id = serializers.SerializerMethodField()
    student_university_id = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    subject_code = serializers.SerializerMethodField()
    subject_title = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    original_faculty_id = serializers.SerializerMethodField()
    original_faculty_name = serializers.SerializerMethodField()
    assigned_faculty_id = serializers.IntegerField(read_only=True, allow_null=True)
    assigned_faculty_name = serializers.SerializerMethodField()
    grievance_type = serializers.SerializerMethodField()
    grievance_type_label = serializers.SerializerMethodField()
    assignment_status = serializers.SerializerMethodField()
    can_resolve = serializers.SerializerMethodField()

    class Meta:
        model = Grievance
        fields = [
            'id',
            'paper_id',
            'status',
            'student_comment',
            'student_university_id',
            'student_name',
            'subject_code',
            'subject_title',
            'section_name',
            'original_faculty_id',
            'original_faculty_name',
            'assigned_faculty_id',
            'assigned_faculty_name',
            'grievance_type',
            'grievance_type_label',
            'assignment_status',
            'can_resolve',
        ]

    def _paper(self, obj):
        return getattr(obj, 'paper', None)

    def _allocation(self, obj):
        paper = self._paper(obj)
        exam = getattr(paper, 'exam', None) if paper else None
        return getattr(exam, 'allocation', None) if exam else None

    def get_paper_id(self, obj):
        paper = self._paper(obj)
        return getattr(paper, 'paper_id', None)

    def get_student_university_id(self, obj):
        paper = self._paper(obj)
        enrollment = getattr(paper, 'enrollment', None) if paper else None
        student = getattr(enrollment, 'student', None) if enrollment else None
        return getattr(student, 'university_id', '') or ''

    def get_student_name(self, obj):
        paper = self._paper(obj)
        enrollment = getattr(paper, 'enrollment', None) if paper else None
        student = getattr(enrollment, 'student', None) if enrollment else None
        return getattr(student, 'full_name', '') or ''

    def get_subject_code(self, obj):
        allocation = self._allocation(obj)
        course = getattr(allocation, 'course', None) if allocation else None
        return getattr(course, 'course_code', '') or ''

    def get_subject_title(self, obj):
        allocation = self._allocation(obj)
        course = getattr(allocation, 'course', None) if allocation else None
        return getattr(course, 'title', '') or ''

    def get_section_name(self, obj):
        allocation = self._allocation(obj)
        return getattr(allocation, 'section_name', '') or ''

    def get_original_faculty_id(self, obj):
        allocation = self._allocation(obj)
        return getattr(allocation, 'teacher_id', None)

    def get_original_faculty_name(self, obj):
        allocation = self._allocation(obj)
        teacher = getattr(allocation, 'teacher', None) if allocation else None
        return getattr(teacher, 'full_name', None)

    def get_assigned_faculty_name(self, obj):
        assigned = getattr(obj, 'assigned_faculty', None)
        return getattr(assigned, 'full_name', None)

    def get_grievance_type(self, obj):
        return getattr(obj, 'grievance_type', Grievance.GRIEVANCE_TYPE_GENERAL)

    def get_grievance_type_label(self, obj):
        return getattr(obj, 'grievance_type_label', 'General Grievance')

    def get_assignment_status(self, obj):
        user = getattr(self.context.get('request'), 'user', None)
        if obj.assigned_faculty_id is None:
            return 'UNASSIGNED_AT_PRESENT'
        if user and obj.assigned_faculty_id == user.id:
            return 'ASSIGNED_TO_YOU'
        return 'ASSIGNED_TO_ANOTHER_FACULTY'

    def get_can_resolve(self, obj):
        user = getattr(self.context.get('request'), 'user', None)
        return bool(user and obj.status == 'OPEN' and obj.assigned_faculty_id == user.id)


class FacultyGrievanceDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['RESOLVED', 'REJECTED'])
    marks_json = serializers.JSONField(required=False)
    total_score = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
