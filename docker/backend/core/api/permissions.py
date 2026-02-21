from rest_framework.permissions import BasePermission

# Note: COORDINATOR role is for System Admin only and not used in API permissions.
# System Admins use the Django Admin Panel.

class IsTeacher(BasePermission):
    """Allows access to TEACHER or CONTROLLER (since Controllers are also Teachers)."""
    message = 'Teacher or Controller role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('TEACHER', 'CONTROLLER'))



class IsStudent(BasePermission):
    """Allows access only to users with role STUDENT."""
    message = 'Student role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'STUDENT')


class IsController(BasePermission):
    """Allows access only to users with role CONTROLLER."""
    message = 'Controller role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'CONTROLLER')
