from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Count, Avg, F
from .models import Grievance, ExamPaper, CourseAllocation, User, Exam

@staff_member_required
def stats_dashboard(request):
    """
    Renders the main statistics dashboard.
    """
    # Get active allocations
    allocations = CourseAllocation.objects.select_related('course').filter(session__is_active=True)
    # Unique courses for dropdown
    dashboard_courses = sorted(list(set([(a.course.course_code, a.course.title) for a in allocations])))
    
    context = {
        'title': 'Statistics Dashboard',
        'courses': dashboard_courses,
    }
    return render(request, 'admin/core/stats_dashboard.html', context)

@staff_member_required
def stats_grievances(request):
    """
    API: Returns grievance statistics.
    If course_code is provided, returns grievances per section for that course.
    If not, returns grievances per course.
    """
    course_code = request.GET.get('course_code')
    
    if course_code:
        # Drill down: Group by Section (Allocation)
        # Note: We need section_name.
        grievances = Grievance.objects.filter(
            paper__enrollment__allocation__course__course_code=course_code
        ).values(
            label=F('paper__enrollment__allocation__section_name')
        ).annotate(count=Count('id')).order_by('-count')
        
        return JsonResponse({'by_course': [], 'chart_data': list(grievances), 'label_type': 'Section'})
    else:
        # High level: Group by Course
        grievances = Grievance.objects.values(
            label=F('paper__enrollment__allocation__course__course_code')
        ).annotate(count=Count('id')).order_by('-count')

        return JsonResponse({'by_course': list(grievances), 'chart_data': list(grievances), 'label_type': 'Course'})

@staff_member_required
def stats_scores(request):
    """
    API: Returns score distribution for a specific course/section.
    """
    course_code = request.GET.get('course_code')
    
    papers = ExamPaper.objects.filter(total_score__isnull=False)
    
    if course_code:
        papers = papers.filter(enrollment__allocation__course__course_code=course_code)

    # Simple histogram logic
    scores = list(papers.values_list('total_score', flat=True))
    
    # We can do bins in Python for simplicity
    if not scores:
         return JsonResponse({'distribution': [], 'labels': []})

    scores = [float(s) for s in scores]
    min_score = 0
    max_score = 100 # Assuming 100, finding max might be better
    
    # Create bins of 10
    bins = range(0, 101, 10)
    distribution = [0] * 10
    labels = [f"{i}-{i+10}" for i in range(0, 100, 10)]
    
    for s in scores:
        idx = int(s // 10)
        if idx >= 10: idx = 9 # Handle 100
        distribution[idx] += 1
        
    return JsonResponse({
        'distribution': distribution,
        'labels': labels,
        'meta': {
            'count': len(scores),
            'avg': sum(scores) / len(scores) if scores else 0
        }
    })

@staff_member_required
def stats_students_in_range(request):
    """
    API: Returns students in a specific score range for a course.
    """
    course_code = request.GET.get('course_code')
    min_score = float(request.GET.get('min', 0))
    max_score = float(request.GET.get('max', 100))
    
    papers = ExamPaper.objects.filter(
        total_score__gte=min_score, 
        total_score__lt=max_score if max_score < 100 else 101 # Include 100
    ).select_related('enrollment__student', 'enrollment__allocation')

    if course_code:
        papers = papers.filter(enrollment__allocation__course__course_code=course_code)
    
    students = []
    for p in papers:
        students.append({
            'name': p.enrollment.student.full_name,
            'university_id': p.enrollment.student.university_id,
            'score': float(p.total_score),
            'section': p.enrollment.allocation.section_name,
            'paper_id': p.paper_id
        })
        
    return JsonResponse({'students': students})
