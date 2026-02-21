from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from core.models import CourseAllocation, Exam, ExamPaper
from core.api.teacher_serializers import CourseAllocationSerializer, ExamSerializer, ExamPaperListSerializer, ExamPaperDetailSerializer

class IsTeacher(permissions.BasePermission):
    """
    Custom permission to only allow teachers, coordinators or controllers to access the view.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['TEACHER', 'COORDINATOR', 'CONTROLLER']
        )

class TeacherAllocationListView(generics.ListAPIView):
    """
    Lists all active course allocations for the logged-in teacher.
    """
    serializer_class = CourseAllocationSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get_queryset(self):
        user = self.request.user
        # Filter allocations where the teacher is the logged-in user
        # and the academic session is currently active.
        return CourseAllocation.objects.filter(
            teacher=user,
            session__is_active=True
        ).select_related('course', 'session')

class TeacherExamListView(APIView):
    """
    Lists all exams (Midsem, Endsem) for a specific allocation (class).
    """
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, allocation_id):
        # 1. Verify the allocation belongs to this teacher
        allocation = get_object_or_404(CourseAllocation, pk=allocation_id, teacher=request.user)
        
        # 2. Get exams
        exams = Exam.objects.filter(allocation=allocation)
        serializer = ExamSerializer(exams, many=True)
        return Response(serializer.data)

class TeacherPaperListView(generics.ListAPIView):
    """
    Lists all papers for a specific exam ID.
    URL: /api/teacher/papers/?exam_id=123
    """
    serializer_class = ExamPaperListSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get_queryset(self):
        exam_id = self.request.query_params.get('exam_id')
        if not exam_id:
            return ExamPaper.objects.none()
        
        # Security: Ensure the exam belongs to an allocation owned by this teacher
        # We join exam -> allocation -> teacher
        return ExamPaper.objects.filter(
            exam_id=exam_id,
            exam__allocation__teacher=self.request.user
        ).select_related('enrollment__student')

class TeacherPaperDetailView(generics.RetrieveUpdateAPIView):
    """
    Get or Update a specific paper (Grading).
    URL: /api/teacher/paper/<int:pk>/
    """
    serializer_class = ExamPaperDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]
    queryset = ExamPaper.objects.all()

    def get_queryset(self):
        # Only allow access to papers belonging to this teacher's allocations
        return ExamPaper.objects.filter(
            exam__allocation__teacher=self.request.user
        ).select_related('exam', 'enrollment__student')
