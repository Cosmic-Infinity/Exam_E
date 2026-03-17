from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Exists, OuterRef, Subquery, Q, Count
from core.models import CourseAllocation, Exam, ExamPaper, Grievance
from core.api.file_gateway import build_protected_file_response, FileAccessError
from core.api.teacher_serializers import (
    CourseAllocationSerializer,
    ExamSerializer,
    ExamPaperListSerializer,
    ExamPaperDetailSerializer,
    FacultyGrievanceListSerializer,
    FacultyGrievanceDecisionSerializer,
)

class IsTeacher(permissions.BasePermission):
    """
    Custom permission to only allow teachers or controllers to access the view.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['TEACHER', 'CONTROLLER']
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

        grievance_qs = Grievance.objects.filter(
            paper_id=OuterRef('pk'),
            status='OPEN',
        ).filter(
            Q(assigned_faculty=self.request.user)
            | Q(assigned_faculty__isnull=True)
        )
        
        # Security: Ensure the exam belongs to an allocation owned by this teacher
        # We join exam -> allocation -> teacher
        return ExamPaper.objects.filter(
            exam_id=exam_id,
            exam__allocation__teacher=self.request.user
        ).select_related('enrollment__student').annotate(
            has_grievance=Exists(grievance_qs)
        )

class TeacherPaperDetailView(generics.RetrieveUpdateAPIView):
    """
    Get or Update a specific paper (Grading).
    URL: /api/teacher/paper/<int:pk>/
    """
    serializer_class = ExamPaperDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]
    queryset = ExamPaper.objects.all()

    def get_queryset(self):
        latest_open_grievance = Grievance.objects.filter(
            paper_id=OuterRef('pk'),
            status='OPEN',
        ).filter(
            Q(assigned_faculty=self.request.user)
            | Q(
                assigned_faculty__isnull=True,
                paper__exam__allocation__teacher=self.request.user,
            )
        ).order_by('-id')

        # Access either own-section papers or papers from other sections explicitly assigned to this faculty.
        return ExamPaper.objects.filter(
            Q(exam__allocation__teacher=self.request.user)
            | Q(grievance__assigned_faculty=self.request.user)
        ).select_related('exam', 'enrollment__student').annotate(
            has_grievance=Exists(latest_open_grievance),
            grievance_text=Subquery(latest_open_grievance.values('student_comment')[:1]),
            grievance_date=Subquery(latest_open_grievance.values('id')[:1]),
        ).distinct()


def _teacher_visible_papers(user):
    return ExamPaper.objects.filter(
        Q(exam__allocation__teacher=user)
        | Q(grievance__assigned_faculty=user)
    ).select_related('exam', 'enrollment__student').distinct()


class TeacherPaperPageFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, pk, page_index):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)

        pages = paper.pages or []
        index = page_index - 1
        if index < 0 or index >= len(pages):
            return Response({'detail': 'Page not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(pages[index])
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class TeacherPaperQuestionFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, pk):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)
        question_path = paper.exam.question_paper_path if paper.exam else None
        if not question_path:
            return Response({'detail': 'Question paper not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(question_path)
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class TeacherPaperAnswerKeyFileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, pk):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)
        answer_key_path = paper.exam.answer_key_path if paper.exam else None
        if not answer_key_path:
            return Response({'detail': 'Answer key not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            return build_protected_file_response(answer_key_path)
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)


class TeacherGrievanceListView(generics.ListAPIView):
    """
    Lists grievances visible to the logged-in faculty/controller.
    filter values:
      - my_section: grievances raised on papers from sections taught by the user
      - other_section: grievances assigned to the user from other faculty sections
      - all (default): union of both
    """

    serializer_class = FacultyGrievanceListSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get_queryset(self):
        user = self.request.user
        grievance_filter = (self.request.query_params.get('filter') or 'all').lower()

        base_qs = Grievance.objects.filter(status='OPEN').select_related(
            'paper__enrollment__student',
            'paper__exam__allocation__course',
            'paper__exam__allocation__teacher',
            'assigned_faculty',
        )

        my_section_qs = base_qs.filter(paper__exam__allocation__teacher=user)
        other_section_qs = base_qs.filter(assigned_faculty=user).exclude(paper__exam__allocation__teacher=user)

        if grievance_filter == 'my_section':
            return my_section_qs.order_by('-id')
        if grievance_filter == 'other_section':
            return other_section_qs.order_by('-id')

        return base_qs.filter(
            Q(paper__exam__allocation__teacher=user) | Q(assigned_faculty=user)
        ).distinct().order_by('-id')


class TeacherGrievanceDecisionView(APIView):
    """
    Accept/Reject a grievance as faculty.
    Decision is allowed only for the explicitly assigned faculty.
    """

    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def post(self, request, grievance_id):
        grievance = get_object_or_404(
            Grievance.objects.select_related('paper__exam__allocation', 'assigned_faculty'),
            pk=grievance_id,
        )

        if grievance.status != 'OPEN':
            return Response({'detail': 'Only OPEN grievances can be decided.'}, status=status.HTTP_400_BAD_REQUEST)

        assigned_faculty_id = grievance.assigned_faculty_id
        can_decide = assigned_faculty_id == request.user.id

        if not can_decide:
            return Response(
                {'detail': 'You are not authorized to decide this grievance. It must be assigned to you first.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = FacultyGrievanceDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decision_status = serializer.validated_data['status']
        marks_json = serializer.validated_data.get('marks_json')
        total_score = serializer.validated_data.get('total_score')

        with transaction.atomic():
            grievance.status = decision_status
            grievance.save(update_fields=['status'])

            if decision_status == 'RESOLVED':
                paper = grievance.paper
                update_fields = ['evaluation_status']
                paper.evaluation_status = 'COMPLETED'

                if marks_json is not None:
                    paper.marks_json = marks_json
                    update_fields.append('marks_json')

                if total_score is not None:
                    paper.total_score = total_score
                    update_fields.append('total_score')

                paper.save(update_fields=update_fields)

        return Response(
            {
                'id': grievance.id,
                'status': grievance.status,
                'assigned_faculty_id': grievance.assigned_faculty_id,
            },
            status=status.HTTP_200_OK,
        )


class TeacherGrievanceStatsView(APIView):
    """
    Summary stats for faculty grievance dashboard and dashboard badge.
    """

    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request):
        user = request.user

        visible_qs = Grievance.objects.filter(
            Q(paper__exam__allocation__teacher=user) | Q(assigned_faculty=user)
        )
        my_section_qs = Grievance.objects.filter(paper__exam__allocation__teacher=user)
        assigned_to_me_qs = Grievance.objects.filter(assigned_faculty=user)

        section_rows = (
            my_section_qs.values('paper__exam__allocation__section_name')
            .annotate(
                total=Count('id'),
                open=Count('id', filter=Q(status='OPEN')),
                resolved=Count('id', filter=Q(status='RESOLVED')),
                rejected=Count('id', filter=Q(status='REJECTED')),
            )
            .order_by('paper__exam__allocation__section_name')
        )

        by_section = [
            {
                'section_name': row.get('paper__exam__allocation__section_name') or 'Unspecified',
                'total': row['total'],
                'open': row['open'],
                'resolved': row['resolved'],
                'rejected': row['rejected'],
            }
            for row in section_rows
        ]

        payload = {
            'assigned_open_count': assigned_to_me_qs.filter(status='OPEN').count(),
            'to_resolve_count': assigned_to_me_qs.filter(status='OPEN').count(),
            'resolved_count': visible_qs.filter(status='RESOLVED').count(),
            'rejected_count': visible_qs.filter(status='REJECTED').count(),
            'visible_open_count': visible_qs.filter(status='OPEN').count(),
            'total_visible_count': visible_qs.count(),
            'by_section': by_section,
        }

        return Response(payload, status=status.HTTP_200_OK)
