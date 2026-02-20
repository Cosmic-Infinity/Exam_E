from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default simplejwt serializer to include user profile fields
    (university_id, full_name, role) in the response.
    Accepts 'email' as the login field.
    """
    username_field = User.USERNAME_FIELD  # 'email'


    def validate(self, attrs):
        data = super().validate(attrs)  # adds 'access' and 'refresh' keys
        # Append user profile fields
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
    class Meta:
        model = User
        fields = ['id', 'university_id', 'full_name', 'email', 'role',
                  'is_active', 'is_staff', 'is_verified', 'date_joined']
        read_only_fields = fields
