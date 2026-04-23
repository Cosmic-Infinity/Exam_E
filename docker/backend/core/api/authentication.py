from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


class EmailBackend(ModelBackend):
    """
    Authenticates using email instead of username.
    Used by django.contrib.auth.authenticate() (e.g., in LoginView).
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Look up user by email (User.USERNAME_FIELD is 'email')
            user = User.objects.get(email=username)
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user (#20760).
            User().set_password(password)
        return None


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to read the access token from the
    'access_token' HttpOnly cookie set by LoginView.
    Falls back to the standard Authorization: Bearer header so that
    header-based clients (e.g. mobile, Postman) also work.
    """
    def authenticate(self, request):
        # 1. Try cookie
        raw_token = request.COOKIES.get('access_token')
        if raw_token:
            try:
                self._ensure_session_not_revoked(request)
                validated = self.get_validated_token(raw_token)
                return self.get_user(validated), validated
            except (InvalidToken, TokenError) as e:
                raise AuthenticationFailed(str(e))

        # 2. Fall back to Authorization header
        return super().authenticate(request)

    def _ensure_session_not_revoked(self, request):
        """
        Force immediate logout behavior when the refresh cookie has been blacklisted.

        Without this check, a user can continue accessing protected APIs until the
        access token expires, even after the refresh token is manually blacklisted.
        """
        refresh_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        raw_refresh = request.COOKIES.get(refresh_cookie)
        if not raw_refresh:
            return

        try:
            refresh = RefreshToken(raw_refresh)
            refresh.check_blacklist()
        except TokenError as exc:
            # Only deny when the refresh token is explicitly blacklisted.
            # Ignore other refresh-token errors so valid access tokens can still
            # be honored until they naturally expire.
            if 'blacklist' in str(exc).lower():
                raise AuthenticationFailed('Session has been revoked. Please log in again.')
