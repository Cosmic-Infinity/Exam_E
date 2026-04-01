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
    TeacherPaperMarkingUpsertSerializer,
)
from core.services.paper_markings import (
    PaperMarkingStorageError,
    read_page_markings,
    write_page_markings,
)


def _is_grievance_super_viewer(user):
    return bool(user and user.is_authenticated and user.role == 'CONTROLLER')


def _grievance_visibility_q(user):
    """
    Visibility scope for grievance list/stats.
    - Controller: all grievances.
    - Teacher: own section OR explicitly assigned OR coordinated courses.
    """
    if _is_grievance_super_viewer(user):
        return Q()

    visibility_q = Q(paper__exam__allocation__teacher=user) | Q(assigned_faculty=user)
    if user.role == 'TEACHER':
        visibility_q |= Q(paper__exam__allocation__course__coordinator=user)
    return visibility_q


def _grievance_detail_q(user):
    """
    Scope allowed to view grievance content fields (comment/type).
    - Controller: all grievances.
    - Teacher: assigned grievances OR grievances for coordinated courses.
    """
    if _is_grievance_super_viewer(user):
        return Q()

    detail_q = Q(assigned_faculty=user)
    if user.role == 'TEACHER':
        detail_q |= Q(paper__exam__allocation__course__coordinator=user)
    return detail_q

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
            Q(paper__exam__allocation__teacher=self.request.user)
            | Q(assigned_faculty=self.request.user)
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
        visible_open_grievance = Grievance.objects.filter(
            paper_id=OuterRef('pk'),
            status='OPEN',
        ).filter(
            Q(paper__exam__allocation__teacher=self.request.user)
            | Q(assigned_faculty=self.request.user)
        )

        detail_open_grievance = Grievance.objects.filter(
            paper_id=OuterRef('pk'),
            status='OPEN',
        ).filter(
            _grievance_detail_q(self.request.user)
        ).order_by('-id')

        # Access either own-section papers or papers from other sections explicitly assigned to this faculty.
        return ExamPaper.objects.filter(
            Q(exam__allocation__teacher=self.request.user)
            | Q(grievance__assigned_faculty=self.request.user)
        ).select_related('exam', 'enrollment__student').annotate(
            has_grievance=Exists(visible_open_grievance),
            grievance_text=Subquery(detail_open_grievance.values('student_comment')[:1]),
            grievance_date=Subquery(detail_open_grievance.values('id')[:1]),
        ).distinct()


def _teacher_visible_papers(user):
    return ExamPaper.objects.filter(
        Q(exam__allocation__teacher=user)
        | Q(grievance__assigned_faculty=user)
    ).select_related('exam', 'enrollment__student').distinct()


def _validate_paper_page_index(paper, page_index):
    pages = paper.pages or []
    index = page_index - 1
    if index < 0 or index >= len(pages):
        return False
    return True


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


class TeacherPaperMarkingsIndexView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, pk):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)
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
                        'api_path': metadata.get('api_path') or f'/api/teacher/paper/{paper.paper_id}/markings/{page_index}/',
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


class TeacherPaperMarkingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request, pk, page_index):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)
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

    def put(self, request, pk, page_index):
        paper = get_object_or_404(_teacher_visible_papers(request.user), pk=pk)
        if not _validate_paper_page_index(paper, page_index):
            return Response({'detail': 'Page not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TeacherPaperMarkingUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            storage_meta = write_page_markings(
                paper,
                page_index,
                serializer.validated_data['markings'],
                request.user.id,
            )
        except PaperMarkingStorageError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        markings_index = paper.markings_index if isinstance(paper.markings_index, dict) else {}
        markings_pages = markings_index.get('pages') if isinstance(markings_index.get('pages'), dict) else {}

        markings_pages[str(page_index)] = {
            'storage_path': storage_meta['media_path'],
            'api_path': f'/api/teacher/paper/{paper.paper_id}/markings/{page_index}/',
            'updated_at': storage_meta['updated_at'],
            'updated_by': storage_meta['updated_by'],
        }

        markings_index['version'] = 1
        markings_index['pages'] = markings_pages
        paper.markings_index = markings_index
        paper.save(update_fields=['markings_index'])

        return Response(
            {
                'paper_id': paper.paper_id,
                'page_index': page_index,
                'storage_path': storage_meta['media_path'],
                'updated_at': storage_meta['updated_at'],
                'updated_by': storage_meta['updated_by'],
            },
            status=status.HTTP_200_OK,
        )


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
            'paper__exam__allocation__course__coordinator',
            'paper__exam__allocation__teacher',
            'assigned_faculty',
        )

        my_section_qs = base_qs.filter(paper__exam__allocation__teacher=user)
        if _is_grievance_super_viewer(user):
            visible_qs = base_qs
        else:
            visible_qs = base_qs.filter(_grievance_visibility_q(user)).distinct()

        other_section_qs = visible_qs.exclude(paper__exam__allocation__teacher=user)

        if grievance_filter == 'my_section':
            return my_section_qs.order_by('-id')
        if grievance_filter == 'other_section':
            return other_section_qs.order_by('-id')

        return visible_qs.order_by('-id')


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

        if _is_grievance_super_viewer(user):
            visible_qs = Grievance.objects.all()
        else:
            visible_qs = Grievance.objects.filter(_grievance_visibility_q(user)).distinct()

        assigned_to_me_qs = Grievance.objects.filter(assigned_faculty=user)

        section_rows = (
            visible_qs.values('paper__exam__allocation__section_name')
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
