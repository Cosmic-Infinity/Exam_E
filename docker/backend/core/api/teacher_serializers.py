from rest_framework import serializers
from core.models import Course, CourseAllocation, AcademicSession, Exam

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
    
    class Meta:
        model = ExamPaper
        fields = ['paper_id', 'student_university_id', 'student_name', 'total_score', 'evaluation_status']

class ExamPaperDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for grading a paper. Includes file paths and marks JSON.
    """
    student_university_id = serializers.CharField(source='enrollment.student.university_id', read_only=True)
    student_name = serializers.CharField(source='enrollment.student.full_name', read_only=True)
    question_paper_schema = serializers.JSONField(source='exam.question_paper_schema', read_only=True)
    exam_total_marks = serializers.IntegerField(source='exam.total_marks', read_only=True)
    
    class Meta:
        model = ExamPaper
        fields = [
            'paper_id', 
            'student_university_id', 
            'student_name', 
            'file_path', 
            'marks_json', 
            'total_score', 
            'evaluation_status',
            'question_paper_schema',
            'exam_total_marks'
        ]
        read_only_fields = ['paper_id', 'student_university_id', 'student_name', 'file_path', 'question_paper_schema', 'exam_total_marks']
