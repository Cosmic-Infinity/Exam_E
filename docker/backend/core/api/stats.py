from django.db.models import Count, F, Q
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Grievance, ExamPaper, CourseAllocation, User, Course
from .permissions import CanAccessStatistics

# --- Helper ---
def _is_admin_staff(user):
    return bool(user and user.is_authenticated and user.is_staff)


def _get_accessible_courses(user):
    """
    Returns a QuerySet of Course objects accessible to the user for statistics.
    - Controller: All courses.
    - Course Coordinator (Teacher): Only courses they coordinate.
    """
    if user.role == 'CONTROLLER' or _is_admin_staff(user):
        return Course.objects.all()
    elif user.role == 'TEACHER':
        # Teachers can only view stats if they are explicitly assigned as the coordinator
        return Course.objects.filter(coordinator=user)
    return Course.objects.none()


def _grievances_payload(user, course_code=None):
    accessible_courses = _get_accessible_courses(user)

    if course_code:
        if not accessible_courses.filter(course_code=course_code).exists():
            return {'detail': 'Permission denied for this course.'}, 403

        grievances = Grievance.objects.filter(
            paper__enrollment__allocation__course__course_code=course_code
        ).values(
            label=F('paper__enrollment__allocation__section_name')
        ).annotate(count=Count('id')).order_by('-count')

        return {'by_course': [], 'chart_data': list(grievances), 'label_type': 'Section'}, 200

    grievances = Grievance.objects.filter(
        paper__enrollment__allocation__course__in=accessible_courses
    ).values(
        label=F('paper__enrollment__allocation__course__course_code')
    ).annotate(count=Count('id')).order_by('-count')

    return {'by_course': list(grievances), 'chart_data': list(grievances), 'label_type': 'Course'}, 200


def _scores_payload(user, course_code=None):
    accessible_courses = _get_accessible_courses(user)

    papers = ExamPaper.objects.filter(total_score__isnull=False)

    if course_code:
        if not accessible_courses.filter(course_code=course_code).exists():
            return {'detail': 'Permission denied for this course.'}, 403
        papers = papers.filter(enrollment__allocation__course__course_code=course_code)
    else:
        papers = papers.filter(enrollment__allocation__course__in=accessible_courses)

    scores = list(papers.values_list('total_score', flat=True))
    if not scores:
        return {'distribution': [], 'labels': []}, 200

    scores = [float(s) for s in scores]
    distribution = [0] * 10
    labels = [f"{i}-{i+10}" for i in range(0, 100, 10)]

    for s in scores:
        idx = int(s // 10)
        if idx >= 10:
            idx = 9
        distribution[idx] += 1

    return {
        'distribution': distribution,
        'labels': labels,
        'meta': {
            'count': len(scores),
            'avg': sum(scores) / len(scores) if scores else 0,
        },
    }, 200


def _students_payload(user, course_code=None, min_score=0, max_score=100):
    accessible_courses = _get_accessible_courses(user)

    papers = ExamPaper.objects.filter(
        total_score__gte=min_score,
        total_score__lt=max_score if max_score < 100 else 101,
    ).select_related('enrollment__student', 'enrollment__allocation')

    if course_code:
        if not accessible_courses.filter(course_code=course_code).exists():
            return {'detail': 'Permission denied for this course.'}, 403
        papers = papers.filter(enrollment__allocation__course__course_code=course_code)
    else:
        papers = papers.filter(enrollment__allocation__course__in=accessible_courses)

    students = []
    for p in papers:
        students.append({
            'name': p.enrollment.student.full_name,
            'university_id': p.enrollment.student.university_id,
            'score': float(p.total_score),
            'section': p.enrollment.allocation.section_name,
            'paper_id': p.paper_id,
        })

    return {'students': students}, 200


@staff_member_required
def admin_stats_dashboard(request):
    courses = _get_accessible_courses(request.user).values_list('course_code', 'title')
    return render(request, 'admin/core/stats_dashboard.html', {'courses': list(courses)})


@staff_member_required
def admin_stats_grievances(request):
    payload, status = _grievances_payload(request.user, request.GET.get('course_code'))
    return JsonResponse(payload, status=status)


@staff_member_required
def admin_stats_scores(request):
    payload, status = _scores_payload(request.user, request.GET.get('course_code'))
    return JsonResponse(payload, status=status)


@staff_member_required
def admin_stats_students(request):
    try:
        min_score = float(request.GET.get('min', 0))
        max_score = float(request.GET.get('max', 100))
    except ValueError:
        return JsonResponse({'error': 'Invalid min/max score range'}, status=400)

    payload, status = _students_payload(
        request.user,
        request.GET.get('course_code'),
        min_score,
        max_score,
    )
    return JsonResponse(payload, status=status)

# --- New Data APIs (JSON) for Frontend ---

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_dashboard_data(request):
    """
    API: Returns list of accessible courses for the dashboard dropdown/overview.
    """
    courses = _get_accessible_courses(request.user).values('course_code', 'title')
    return Response({'courses': list(courses)})

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_grievances(request):
    """
    API: Returns grievance statistics.
    If course_code is provided, returns grievances per section for that course.
    If not, returns grievances per course (filtered by permission).
    """
    payload, status = _grievances_payload(request.user, request.GET.get('course_code'))
    return Response(payload, status=status)

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_scores(request):
    """
    API: Returns score distribution for a specific course/section.
    """
    payload, status = _scores_payload(request.user, request.GET.get('course_code'))
    return Response(payload, status=status)

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_students_in_range(request):
    """
    API: Returns students in a specific score range for a course.
    """
    try:
        min_score = float(request.GET.get('min', 0))
        max_score = float(request.GET.get('max', 100))
    except ValueError:
        return Response({'error': 'Invalid min/max score range'}, status=400)

    payload, status = _students_payload(
        request.user,
        request.GET.get('course_code'),
        min_score,
        max_score,
    )
    return Response(payload, status=status)

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_subjects(request):
    """
    API: Returns all subjects with their evaluation progress.
    """
    courses = _get_accessible_courses(request.user)
    
    courses_with_stats = courses.annotate(
        total_students=Count('courseallocation__enrollment', distinct=True),
        checked=Count('courseallocation__enrollment__exampaper', filter=Q(courseallocation__enrollment__exampaper__evaluation_status='COMPLETED'), distinct=True),
        pending=Count('courseallocation__enrollment__exampaper', filter=~Q(courseallocation__enrollment__exampaper__evaluation_status='COMPLETED'), distinct=True),
        grievances=Count('courseallocation__enrollment__exampaper__grievance', distinct=True)
    ).values('course_code', 'title', 'total_students', 'checked', 'pending', 'grievances')
    
    return Response({'subjects': list(courses_with_stats)})

@api_view(['GET'])
@permission_classes([IsAuthenticated, CanAccessStatistics])
def stats_sections(request):
    """
    API: Returns sections for a specific course with their evaluation progress.
    """
    course_code = request.GET.get('course_code')
    if not course_code:
        return Response({'error': 'course_code is required'}, status=400)
        
    if not _get_accessible_courses(request.user).filter(course_code=course_code).exists():
        return Response({'error': 'Not authorized for this course'}, status=403)
        
    allocations = CourseAllocation.objects.filter(course=course_code)
    
    sections_with_stats = allocations.annotate(
        total_students=Count('enrollment', distinct=True),
        checked=Count('enrollment__exampaper', filter=Q(enrollment__exampaper__evaluation_status='COMPLETED'), distinct=True),
        pending=Count('enrollment__exampaper', filter=~Q(enrollment__exampaper__evaluation_status='COMPLETED'), distinct=True),
        grievances=Count('enrollment__exampaper__grievance', distinct=True)
    ).values('allocation_id', 'section_name', 'teacher__full_name', 'total_students', 'checked', 'pending', 'grievances')
    
    return Response({'sections': list(sections_with_stats)})
