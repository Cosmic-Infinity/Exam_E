from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from core.api import stats as views
from core.api.auth import LoginView, LogoutView, CustomTokenObtainPairView, MeView, CookieTokenRefreshView, ChangePasswordView
from core.api.teacher import (
    TeacherAllocationListView,
    TeacherExamListView,
    TeacherPaperListView,
    TeacherPaperDetailView,
    TeacherPaperMarkingsIndexView,
    TeacherPaperMarkingDetailView,
    TeacherPaperPageFileView,
    TeacherPaperQuestionFileView,
    TeacherPaperAnswerKeyFileView,
    TeacherGrievanceListView,
    TeacherGrievanceDecisionView,
    TeacherGrievanceStatsView,
)
from core.api.student import (
    StudentEnrollmentListView,
    StudentPaperListView,
    StudentPaperDetailView,
    StudentPaperMarkingsIndexView,
    StudentPaperMarkingDetailView,
    StudentPaperPageFileView,
    StudentPaperQuestionFileView,
    StudentPaperAnswerKeyFileView,
    StudentGrievanceCreateView,
    StudentGrievanceListView,
)
from core.api.admin_files import AdminPaperPageFileView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ── Django admin ─────────────────────────────────────
    path('admin/stats/', views.admin_stats_dashboard, name='admin_stats_dashboard'),
    path('admin/stats/api/grievances/', views.admin_stats_grievances, name='admin_stats_grievances'),
    path('admin/stats/api/scores/', views.admin_stats_scores, name='admin_stats_scores'),
    path('admin/stats/api/students/', views.admin_stats_students, name='admin_stats_students'),
    path('api/stats/dashboard/data/', views.stats_dashboard_data, name='stats_dashboard_data'),
    path('api/stats/subjects/', views.stats_subjects, name='stats_subjects'),
    path('api/stats/sections/', views.stats_sections, name='stats_sections'),
    path('api/stats/grievances/', views.stats_grievances, name='stats_grievances'),
    path('api/stats/scores/', views.stats_scores, name='stats_scores'),
    path('api/stats/students/', views.stats_students_in_range, name='stats_students'),
    path('admin/core/', include('core.admin_urls')),
    path('admin/', admin.site.urls),

    # ── Cookie-based auth (used by React frontend) ────────
    path('api/auth/login/',             LoginView.as_view(),              name='login'),
    path('api/auth/logout/',            LogoutView.as_view(),             name='logout'),
    path('api/auth/refresh/',           CookieTokenRefreshView.as_view(), name='cookie_token_refresh'),

    # ── Header-based JWT (access + refresh in response body) ──
    # Returns { access, refresh, university_id, full_name, role }
    path('api/token/',         CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(),          name='token_refresh'),

    # ── Protected user profile ────────────────────────────
    path('api/me/', MeView.as_view(), name='user_me'),
]

urlpatterns += [
    path('api/admin/paper/<int:pk>/page/<int:page_index>/', AdminPaperPageFileView.as_view(), name='admin_paper_page_file'),
    path('api/teacher/allocations/', TeacherAllocationListView.as_view(), name='teacher_allocations'),
    path('api/teacher/exams/<int:allocation_id>/', TeacherExamListView.as_view(), name='teacher_exams'),
    path('api/teacher/papers/', TeacherPaperListView.as_view(), name='teacher_papers'),
    path('api/teacher/paper/<int:pk>/', TeacherPaperDetailView.as_view(), name='teacher_paper_detail'),
    path('api/teacher/paper/<int:pk>/markings/', TeacherPaperMarkingsIndexView.as_view(), name='teacher_paper_markings'),
    path('api/teacher/paper/<int:pk>/markings/<int:page_index>/', TeacherPaperMarkingDetailView.as_view(), name='teacher_paper_marking_detail'),
    path('api/teacher/paper/<int:pk>/page/<int:page_index>/', TeacherPaperPageFileView.as_view(), name='teacher_paper_page_file'),
    path('api/teacher/paper/<int:pk>/question-paper/', TeacherPaperQuestionFileView.as_view(), name='teacher_question_paper_file'),
    path('api/teacher/paper/<int:pk>/answer-key/', TeacherPaperAnswerKeyFileView.as_view(), name='teacher_answer_key_file'),
    path('api/teacher/grievances/', TeacherGrievanceListView.as_view(), name='teacher_grievance_list'),
    path('api/teacher/grievances/stats/', TeacherGrievanceStatsView.as_view(), name='teacher_grievance_stats'),
    path('api/teacher/grievances/<int:grievance_id>/decision/', TeacherGrievanceDecisionView.as_view(), name='teacher_grievance_decision'),

    # Student URLs
    path('api/student/enrollments/', StudentEnrollmentListView.as_view(), name='student_enrollments'),
    path('api/student/papers/', StudentPaperListView.as_view(), name='student_papers'),
    path('api/student/paper/<int:pk>/', StudentPaperDetailView.as_view(), name='student_paper_detail'),
    path('api/student/paper/<int:pk>/markings/', StudentPaperMarkingsIndexView.as_view(), name='student_paper_markings'),
    path('api/student/paper/<int:pk>/markings/<int:page_index>/', StudentPaperMarkingDetailView.as_view(), name='student_paper_marking_detail'),
    path('api/student/paper/<int:pk>/page/<int:page_index>/', StudentPaperPageFileView.as_view(), name='student_paper_page_file'),
    path('api/student/paper/<int:pk>/question-paper/', StudentPaperQuestionFileView.as_view(), name='student_question_paper_file'),
    path('api/student/paper/<int:pk>/answer-key/', StudentPaperAnswerKeyFileView.as_view(), name='student_answer_key_file'),
    path('api/student/grievance/', StudentGrievanceCreateView.as_view(), name='student_grievance_create'),
    path('api/student/grievances/', StudentGrievanceListView.as_view(), name='student_grievance_list'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
