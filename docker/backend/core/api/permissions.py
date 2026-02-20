from rest_framework.permissions import BasePermission


class IsCoordinator(BasePermission):
    """Allows access only to users with role COORDINATOR."""
    message = 'Coordinator role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'COORDINATOR')


class IsTeacher(BasePermission):
    """Allows access only to users with role TEACHER."""
    message = 'Teacher role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'TEACHER')


class IsStudent(BasePermission):
    """Allows access only to users with role STUDENT."""
    message = 'Student role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'STUDENT')


class IsCoordOrTeacher(BasePermission):
    """Allows access to COORDINATOR or TEACHER."""
    message = 'Coordinator or Teacher role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('COORDINATOR', 'TEACHER'))
