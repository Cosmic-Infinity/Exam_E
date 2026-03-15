from rest_framework.permissions import BasePermission


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


class CanAccessStatistics(BasePermission):
    """Allows statistics access to controller, staff admin, or coordinator teachers."""
    message = 'Statistics access requires controller, admin, or coordinator teacher role.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff or user.role == 'CONTROLLER':
            return True
        if user.role == 'TEACHER':
            return user.coordinated_courses.exists()
        return False
