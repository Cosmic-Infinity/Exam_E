from django.db.models import Count, Avg, F, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Grievance, ExamPaper, CourseAllocation, User, Course

# --- Helper ---
def _get_accessible_courses(user):
    """
    Returns a QuerySet of Course objects accessible to the user for statistics.
    - Controller: All courses.
    - Course Coordinator (Teacher): Only courses they coordinate.
    """
    if user.role == 'CONTROLLER':
        return Course.objects.all()
    elif user.role == 'TEACHER':
        # Teachers can only view stats if they are explicitly assigned as the coordinator
        return Course.objects.filter(coordinator=user)
    return Course.objects.none()

# --- New Data APIs (JSON) for Frontend ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_dashboard_data(request):
    """
    API: Returns list of accessible courses for the dashboard dropdown/overview.
    """
    courses = _get_accessible_courses(request.user).values('course_code', 'title')
    return Response({'courses': list(courses)})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_grievances(request):
    """
    API: Returns grievance statistics.
    If course_code is provided, returns grievances per section for that course.
    If not, returns grievances per course (filtered by permission).
    """
    course_code = request.GET.get('course_code')
    accessible_courses = _get_accessible_courses(request.user)

    if course_code:
        # Check permission for this specific course
        if not accessible_courses.filter(course_code=course_code).exists():
             return Response({'detail': 'Permission denied for this course.'}, status=403)

        # Drill down: Group by Section (Allocation)
        grievances = Grievance.objects.filter(
            paper__enrollment__allocation__course__course_code=course_code
        ).values(
            label=F('paper__enrollment__allocation__section_name')
        ).annotate(count=Count('id')).order_by('-count')
        
        return Response({'by_course': [], 'chart_data': list(grievances), 'label_type': 'Section'})
    else:
        # High level: Group by Course
        # Only show stats for courses the user has access to
        grievances = Grievance.objects.filter(
            paper__enrollment__allocation__course__in=accessible_courses
        ).values(
            label=F('paper__enrollment__allocation__course__course_code')
        ).annotate(count=Count('id')).order_by('-count')

        return Response({'by_course': list(grievances), 'chart_data': list(grievances), 'label_type': 'Course'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_scores(request):
    """
    API: Returns score distribution for a specific course/section.
    """
    course_code = request.GET.get('course_code')
    accessible_courses = _get_accessible_courses(request.user)
    
    papers = ExamPaper.objects.filter(total_score__isnull=False)
    
    if course_code:
        if not accessible_courses.filter(course_code=course_code).exists():
             return Response({'detail': 'Permission denied for this course.'}, status=403)
        papers = papers.filter(enrollment__allocation__course__course_code=course_code)
    else:
        # Filter papers by accessible courses
        papers = papers.filter(enrollment__allocation__course__in=accessible_courses)

    # Simple histogram logic
    scores = list(papers.values_list('total_score', flat=True))
    
    # We can do bins in Python for simplicity
    if not scores:
         return Response({'distribution': [], 'labels': []})

    scores = [float(s) for s in scores]
    
    # Create bins of 10
    distribution = [0] * 10
    labels = [f"{i}-{i+10}" for i in range(0, 100, 10)]
    
    for s in scores:
        idx = int(s // 10)
        if idx >= 10: idx = 9 # Handle 100
        distribution[idx] += 1
        
    return Response({
        'distribution': distribution,
        'labels': labels,
        'meta': {
            'count': len(scores),
            'avg': sum(scores) / len(scores) if scores else 0
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_students_in_range(request):
    """
    API: Returns students in a specific score range for a course.
    """
    course_code = request.GET.get('course_code')
    min_score = float(request.GET.get('min', 0))
    max_score = float(request.GET.get('max', 100))
    
    accessible_courses = _get_accessible_courses(request.user)

    papers = ExamPaper.objects.filter(
        total_score__gte=min_score, 
        total_score__lt=max_score if max_score < 100 else 101 # Include 100
    ).select_related('enrollment__student', 'enrollment__allocation')

    if course_code:
        if not accessible_courses.filter(course_code=course_code).exists():
             return Response({'detail': 'Permission denied for this course.'}, status=403)
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
            'paper_id': p.paper_id
        })
        
    return Response({'students': students})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
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
