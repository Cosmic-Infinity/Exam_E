from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path('admin/dashboard/', views.stats_dashboard, name='stats_dashboard'),
    path('admin/dashboard/api/grievances/', views.stats_grievances, name='stats_grievances'),
    path('admin/dashboard/api/scores/', views.stats_scores, name='stats_scores'),
    path('admin/dashboard/api/students/', views.stats_students_in_range, name='stats_students'),
    path('admin/', admin.site.urls),
]
