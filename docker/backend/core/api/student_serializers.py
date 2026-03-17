from rest_framework import serializers
from core.models import Enrollment, CourseAllocation, Course, ExamPaper, Grievance, Exam

class StudentCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['course_code', 'title', 'credits', 'course_type']

class StudentAllocationSerializer(serializers.ModelSerializer):
    course = StudentCourseSerializer(read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    
    class Meta:
        model = CourseAllocation
        fields = ['allocation_id', 'course', 'section_name', 'semester', 'teacher_name']

class StudentEnrollmentSerializer(serializers.ModelSerializer):
    allocation = StudentAllocationSerializer(read_only=True)
    
    class Meta:
        model = Enrollment
        fields = ['enrollment_id', 'allocation', 'enrollment_type', 'status']

class StudentExamSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='allocation.course.course_code', read_only=True)
    course_title = serializers.CharField(source='allocation.course.title', read_only=True)

    class Meta:
        model = Exam
        fields = ['exam_id', 'exam_type', 'total_marks', 'passing_marks', 'course_code', 'course_title']

class StudentPaperListSerializer(serializers.ModelSerializer):
    exam = StudentExamSerializer(read_only=True)
    
    class Meta:
        model = ExamPaper
        fields = ['paper_id', 'exam', 'total_score', 'evaluation_status']

class StudentPaperDetailSerializer(serializers.ModelSerializer):
    exam = StudentExamSerializer(read_only=True)
    question_paper_schema = serializers.JSONField(source='exam.question_paper_schema', read_only=True)
    question_paper_path = serializers.SerializerMethodField()
    answer_key_path = serializers.SerializerMethodField()
    pages = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamPaper
        fields = [
            'paper_id', 
            'exam', 
            'pages',
            'marks_json', 
            'total_score', 
            'evaluation_status',
            'question_paper_schema',
            'question_paper_path',
            'answer_key_path'
        ]
        read_only_fields = fields

    def get_pages(self, obj):
        pages = obj.pages or []
        return [f"/api/student/paper/{obj.paper_id}/page/{index + 1}/" for index in range(len(pages))]

    def get_question_paper_path(self, obj):
        if obj.exam and obj.exam.question_paper_path:
            return f"/api/student/paper/{obj.paper_id}/question-paper/"
        return None

    def get_answer_key_path(self, obj):
        if obj.exam and obj.exam.answer_key_path:
            return f"/api/student/paper/{obj.paper_id}/answer-key/"
        return None

class GrievanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grievance
        fields = ['id', 'paper', 'student_comment', 'status']
        read_only_fields = ['id', 'status']

    def validate_paper(self, value):
        # Ensure the paper belongs to the logged-in student
        request = self.context.get('request')
        if value.enrollment.student != request.user:
            raise serializers.ValidationError("You can only raise a grievance for your own papers.")
        
        # Ensure the paper is actually graded
        if value.evaluation_status != 'COMPLETED':
            raise serializers.ValidationError("You can only raise a grievance for fully graded papers.")
            
        return value

    def validate(self, attrs):
        """Allow multiple grievances, but block exact duplicate open submissions."""
        attrs = super().validate(attrs)
        paper = attrs.get('paper')
        comment = (attrs.get('student_comment') or '').strip()

        if paper and comment and Grievance.objects.filter(paper=paper, status='OPEN', student_comment__iexact=comment).exists():
            raise serializers.ValidationError({
                'student_comment': 'An open grievance with the same comment already exists for this paper.'
            })

        return attrs


class StudentGrievanceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grievance
        fields = ['id', 'paper', 'student_comment', 'status']
