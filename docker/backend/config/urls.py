from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from core.api import stats as views
from core.api.auth import LoginView, LogoutView, CustomTokenObtainPairView, MeView, CookieTokenRefreshView, ChangePasswordView

urlpatterns = [
    # ── Django admin ─────────────────────────────────────
    path('admin/', admin.site.urls),
    path('admin/stats/', views.stats_dashboard, name='stats_dashboard'),
    path('admin/stats/api/grievances/', views.stats_grievances, name='stats_grievances'),
    path('admin/stats/api/scores/', views.stats_scores, name='stats_scores'),
    path('admin/stats/api/students/', views.stats_students_in_range, name='stats_students'),

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
