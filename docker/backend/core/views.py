from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib import messages
from django.http import JsonResponse
from .forms import PasswordFilterForm
from .models import Student, Stream
from .tasks import generate_and_email_passwords_task

@staff_member_required
def password_management_view(request):
    form = PasswordFilterForm(request.POST or None)
    student_count = 0
    has_searched = False

    if request.method == 'POST':
        if '_search' in request.POST:
            if form.is_valid():
                school = form.cleaned_data.get('school')
                stream_id = form.cleaned_data.get('stream')
                section = form.cleaned_data.get('section')
                semester = form.cleaned_data.get('semester')

                # Build Query
                filters = {}
                if school:
                    # Filter streams by school if stream not explicitly selected, 
                    # OR filter students whose stream belongs to school? 
                    # Student -> Stream -> School
                    filters['stream__school'] = school
                
                if stream_id:
                    filters['stream_id'] = stream_id
                
                if section:
                    filters['section_name__iexact'] = section
                
                if semester:
                    filters['current_semester'] = semester

                student_qs = Student.objects.filter(**filters).select_related('user', 'stream')
                student_user_ids = list(student_qs.values_list('user_id', flat=True))
                
                # Store in session for generation step
                request.session['filtered_student_ids'] = student_user_ids
                
                student_count = len(student_user_ids)
                has_searched = True
                
                if student_count > 0:
                    messages.success(request, f"Found {student_count} students matching criteria.")
                else:
                    messages.warning(request, "No students found matching the selected filters.")
            else:
                 messages.error(request, "Please correct the errors in the filter form.")

        elif '_generate' in request.POST:
            # We use the previous search results from session to ensure consistency
            student_user_ids = request.session.get('filtered_student_ids', [])
            
            # Get algorithm from form data (even if not fully valid, this field should be)
            algorithm = request.POST.get('password_algorithm', 'numeric_8')

            if not student_user_ids:
                messages.error(request, "No students selected. Please perform a search first.")
            else:
                student_count = len(student_user_ids)
                # Launch Celery Task
                generate_and_email_passwords_task.delay(
                    user_ids=student_user_ids, 
                    algorithm=algorithm
                )
                
                messages.success(request, f"Password generation started for {student_count} students. They will act receive emails shortly.")
                
                # Clear session
                if 'filtered_student_ids' in request.session:
                    del request.session['filtered_student_ids']
                
                return redirect('admin:index') # Redirect back to admin home or stay

    context = {
        'title': 'Bulk Password Generation',
        'form': form,
        'student_count': student_count,
        'has_searched': has_searched
    }
    return render(request, 'admin/password_management.html', context)

def get_streams_for_school(request):
    """
    An API endpoint to be called by JavaScript to fetch streams for a given school.
    """
    school_id = request.GET.get('school_id')
    streams = Stream.objects.none()
    if school_id:
        streams = Stream.objects.filter(school_id=school_id).order_by('name')
    
    return JsonResponse(list(streams.values('stream_id', 'name')), safe=False)
