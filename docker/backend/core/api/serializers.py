from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model

from .auth_security import (
    check_login_security,
    handle_login_failure,
    handle_login_success,
    apply_progressive_delay,
)

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extends simplejwt serializer to include user profile fields and security checks."""
    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        email = attrs.get(self.username_field)

        security_check = check_login_security(email)
        if not security_check['allowed']:
            raise AuthenticationFailed(security_check['error'])

        if security_check['delay'] > 0:
            apply_progressive_delay(security_check['delay'])

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            handle_login_failure(email)
            raise

        handle_login_success(email)

        data['university_id'] = self.user.university_id
        data['full_name'] = self.user.full_name
        data['role'] = self.user.role
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Embed claims inside the JWT payload as well (useful for stateless reads)
        token['university_id'] = user.university_id
        token['full_name'] = user.full_name
        token['role'] = user.role
        return token


class UserMeSerializer(serializers.ModelSerializer):
    """Serializer for the /api/me/ endpoint — returns safe read-only user fields."""
    is_course_coordinator = serializers.SerializerMethodField()
    is_controller = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'university_id', 'full_name', 'email', 'role',
                  'is_active', 'date_joined', 'is_course_coordinator', 'is_controller']
        read_only_fields = fields

    def get_is_course_coordinator(self, obj):
        if obj.role != 'TEACHER':
            return False
        return obj.coordinated_courses.exists()

    def get_is_controller(self, obj):
        return obj.role == 'CONTROLLER'
