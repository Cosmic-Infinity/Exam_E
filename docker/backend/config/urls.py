from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from core.api import stats as views
from core.api.auth import LoginView, LogoutView, CustomTokenObtainPairView, MeView, CookieTokenRefreshView, ChangePasswordView
from core.api.teacher import TeacherAllocationListView, TeacherExamListView, TeacherPaperListView, TeacherPaperDetailView
from core.api.student import StudentEnrollmentListView, StudentPaperListView, StudentPaperDetailView, StudentGrievanceCreateView

urlpatterns = [
    # ── Django admin ─────────────────────────────────────
    path('api/stats/dashboard/data/', views.stats_dashboard_data, name='stats_dashboard_data'),
    path('admin/stats/', views.stats_dashboard, name='stats_dashboard'), # HTML View
    path('api/stats/grievances/', views.stats_grievances, name='stats_grievances'),
    path('api/stats/scores/', views.stats_scores, name='stats_scores'),
    path('api/stats/students/', views.stats_students_in_range, name='stats_students'),
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

    # ── Teacher Portal APIs ───────────────────────────────
    path('api/teacher/allocations/', TeacherAllocationListView.as_view(), name='teacher_allocations'),
    path('api/teacher/allocations/<int:allocation_id>/exams/', TeacherExamListView.as_view(), name='teacher_exams'),
    path('api/teacher/papers/', TeacherPaperListView.as_view(), name='teacher_papers'),
    path('api/teacher/paper/<int:pk>/', TeacherPaperDetailView.as_view(), name='teacher_paper_detail'),

    # ── Student Portal APIs ───────────────────────────────
    path('api/student/enrollments/', StudentEnrollmentListView.as_view(), name='student_enrollments'),
    path('api/student/papers/', StudentPaperListView.as_view(), name='student_papers'),
    path('api/student/paper/<int:pk>/', StudentPaperDetailView.as_view(), name='student_paper_detail'),
    path('api/student/grievance/', StudentGrievanceCreateView.as_view(), name='student_grievance_create'),
]
