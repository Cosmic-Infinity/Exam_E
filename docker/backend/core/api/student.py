from rest_framework import generics, permissions
from django.shortcuts import get_object_or_404
from core.models import Enrollment, ExamPaper, Grievance
from core.api.student_serializers import (
    StudentEnrollmentSerializer, 
    StudentPaperListSerializer, 
    StudentPaperDetailSerializer,
    GrievanceCreateSerializer
)

class IsStudent(permissions.BasePermission):
    """
    Custom permission to only allow students to access the view.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'STUDENT'
        )

class StudentEnrollmentListView(generics.ListAPIView):
    """
    Lists all active courses the student is currently enrolled in.
    """
    serializer_class = StudentEnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        user = self.request.user
        # Filter enrollments for the logged-in student in the active session
        return Enrollment.objects.filter(
            student=user,
            allocation__session__is_active=True,
            status='ACTIVE'
        ).select_related('allocation__course', 'allocation__teacher')

class StudentPaperListView(generics.ListAPIView):
    """
    Lists all graded and released papers for the logged-in student.
    """
    serializer_class = StudentPaperListSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        user = self.request.user
        # Only return papers that belong to the student and are fully graded
        return ExamPaper.objects.filter(
            enrollment__student=user,
            evaluation_status='COMPLETED'
        ).select_related('exam__allocation__course')

class StudentPaperDetailView(generics.RetrieveAPIView):
    """
    Fetches the full details of a specific paper (read-only).
    """
    serializer_class = StudentPaperDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    queryset = ExamPaper.objects.all()

    def get_queryset(self):
        # Security: Ensure the student can only view their own papers
        return ExamPaper.objects.filter(
            enrollment__student=self.request.user,
            evaluation_status='COMPLETED'
        ).select_related('exam__allocation__course')

class StudentGrievanceCreateView(generics.CreateAPIView):
    """
    Allows a student to raise a grievance for a specific paper.
    """
    serializer_class = GrievanceCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def perform_create(self, serializer):
        # The serializer validation already ensures the paper belongs to the student
        # and is fully graded. We just need to save it.
        # The status defaults to 'OPEN' in the model.
        serializer.save()
