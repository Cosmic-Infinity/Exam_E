from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from core.models import Enrollment, ExamPaper, Grievance
from core.api.file_gateway import build_protected_file_response, FileAccessError
from core.services.paper_markings import PaperMarkingStorageError, read_page_markings
from core.api.student_serializers import (
    StudentEnrollmentSerializer, 
    StudentPaperListSerializer, 
    StudentPaperDetailSerializer,
    GrievanceCreateSerializer,
    StudentGrievanceListSerializer,
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


def _student_visible_papers(user):
    return ExamPaper.objects.filter(
        enrollment__student=user,
        evaluation_status='COMPLETED',
    ).select_related('exam')


def _validate_paper_page_index(paper, page_index):
    pages = paper.pages or []
    index = page_index - 1
    if index < 0 or index >= len(pages):
        return False
    return True

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


class StudentGrievanceListView(generics.ListAPIView):
    """
    Lists grievances raised by the logged-in student.
    Optional query param: ?paper=<paper_id>
    """
    serializer_class = StudentGrievanceListSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        queryset = Grievance.objects.filter(
            paper__enrollment__student=self.request.user
        ).select_related('paper').order_by('-id')

        paper_id = self.request.query_params.get('paper')
        if paper_id:
            queryset = queryset.filter(paper_id=paper_id)

        return queryset


class StudentPaperPageFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk, page_index):
        paper = get_object_or_404(
            ExamPaper.objects.filter(
                enrollment__student=request.user,
                evaluation_status='COMPLETED',
            ),
            pk=pk,
        )

        pages = paper.pages or []
        index = page_index - 1
        if index < 0 or index >= len(pages):
            return Response({'detail': 'Page not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(pages[index])
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class StudentPaperQuestionFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk):
        paper = get_object_or_404(
            ExamPaper.objects.filter(
                enrollment__student=request.user,
                evaluation_status='COMPLETED',
            ).select_related('exam'),
            pk=pk,
        )

        question_path = paper.exam.question_paper_path if paper.exam else None
        if not question_path:
            return Response({'detail': 'Question paper not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(question_path)
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class StudentPaperAnswerKeyFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk):
        paper = get_object_or_404(
            ExamPaper.objects.filter(
                enrollment__student=request.user,
                evaluation_status='COMPLETED',
            ).select_related('exam'),
            pk=pk,
        )

        answer_key_path = paper.exam.answer_key_path if paper.exam else None
        if not answer_key_path:
            return Response({'detail': 'Answer key not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(answer_key_path)
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class StudentPaperMarkingsIndexView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk):
        paper = get_object_or_404(_student_visible_papers(request.user), pk=pk)
        index_payload = paper.markings_index or {}
        page_entries = index_payload.get('pages') or {}

        items = []
        if isinstance(page_entries, dict):
            for page_key, metadata in page_entries.items():
                try:
                    page_index = int(page_key)
                except (TypeError, ValueError):
                    continue

                metadata = metadata or {}
                items.append(
                    {
                        'page_index': page_index,
                        'api_path': f'/api/student/paper/{paper.paper_id}/markings/{page_index}/',
                        'updated_at': metadata.get('updated_at'),
                        'updated_by': metadata.get('updated_by'),
                    }
                )

        items.sort(key=lambda row: row['page_index'])
        return Response(
            {
                'paper_id': paper.paper_id,
                'count': len(items),
                'markings': items,
            },
            status=status.HTTP_200_OK,
        )


class StudentPaperMarkingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk, page_index):
        paper = get_object_or_404(_student_visible_papers(request.user), pk=pk)
        if not _validate_paper_page_index(paper, page_index):
            return Response({'detail': 'Page not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payload = read_page_markings(paper, page_index)
        except PaperMarkingStorageError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if payload is None:
            return Response(
                {
                    'paper_id': paper.paper_id,
                    'page_index': page_index,
                    'markings': None,
                    'updated_by': None,
                    'updated_at': None,
                },
                status=status.HTTP_200_OK,
            )

        return Response(payload, status=status.HTTP_200_OK)
