from django.urls import path
from core.views import password_management_view, get_streams_for_school

app_name = 'core'
urlpatterns = [
    path('password_management/', password_management_view, name='password_management'),
    path('get_streams_for_school/', get_streams_for_school, name='get_streams_for_school'),
]
