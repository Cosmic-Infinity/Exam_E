from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allows access only to users with role ADMIN."""
    message = 'Admin role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'ADMIN')


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


class IsAdminOrCoordinator(BasePermission):
    """Allows access to ADMIN or COORDINATOR (staff-level)."""
    message = 'Admin or Coordinator role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('ADMIN', 'COORDINATOR'))


class IsAdminOrTeacher(BasePermission):
    """Allows access to ADMIN or TEACHER."""
    message = 'Admin or Teacher role required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('ADMIN', 'TEACHER'))
