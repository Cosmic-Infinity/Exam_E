from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from django.conf import settings

from .serializers import CustomTokenObtainPairSerializer, UserMeSerializer
from .tasks import send_password_changed_email

# ── cookie config (single source of truth: settings.SIMPLE_JWT) ──────────────
_JWT = settings.SIMPLE_JWT
_COOKIE_ACCESS   = _JWT.get('AUTH_COOKIE', 'access_token')
_COOKIE_REFRESH  = _JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
_COOKIE_SECURE   = _JWT.get('AUTH_COOKIE_SECURE', False)
_COOKIE_SAMESITE = _JWT.get('AUTH_COOKIE_SAMESITE', 'Lax')


# ── Public: Login ─────────────────────────────────────────────────────────────
class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { "university_id": "...", "password": "..." }
    Returns: { message, role, university_id, full_name }
             + sets HttpOnly access_token & refresh_token cookies.
    """
    permission_classes = []
    authentication_classes = []

    @method_decorator(ratelimit(key='ip', rate='5/m', block=True))
    def post(self, request):
        university_id = request.data.get('university_id')
        password = request.data.get('password')

        if not university_id or not password:
            return Response(
                {'error': 'university_id and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=university_id, password=password)

        if user is None or not user.is_active:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        # Embed custom claims in the token payload
        refresh['university_id'] = user.university_id
        refresh['full_name'] = user.full_name
        refresh['role'] = user.role

        response = Response({
            'message': 'Login successful',
            'university_id': user.university_id,
            'full_name': user.full_name,
            'role': user.role,
        })
        _set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


# ── Public: Custom token obtain (header-based, returns enriched JSON) ─────────
class CustomTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/token/
    Body: { "university_id": "...", "password": "..." }
    Returns: { access, refresh, university_id, full_name, role }
    Use this if the React frontend prefers bearer-token storage over cookies.
    """
    serializer_class = CustomTokenObtainPairSerializer


# ── Protected: Logout ─────────────────────────────────────────────────────────
class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token and clears both auth cookies.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.COOKIES.get(_COOKIE_REFRESH)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass  # already blacklisted or expired — still clear cookies

        response = Response({'message': 'Logged out'})
        response.delete_cookie(_COOKIE_ACCESS)
        response.delete_cookie(_COOKIE_REFRESH)
        return response


# ── Protected: /api/me/ ───────────────────────────────────────────────────────
class MeView(APIView):
    """
    GET /api/me/
    Returns the authenticated user's profile.
    Requires a valid access_token cookie OR Authorization: Bearer <token> header.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)


# ── Protected: Change password ────────────────────────────────────────────────
class ChangePasswordView(APIView):
    """
    POST /api/auth/password/change/
    Body: { "old_password": "...", "new_password": "...", "confirm_password": "..." }
    Requires authentication. Rejects short or matching passwords.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password     = request.data.get('old_password')
        new_password     = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([old_password, new_password, confirm_password]):
            return Response(
                {'error': 'old_password, new_password, and confirm_password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(old_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'new_password and confirm_password do not match'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if old_password == new_password:
            return Response(
                {'error': 'New password must differ from the current password'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])
        # Fire async email notification (non-blocking)
        send_password_changed_email.delay(user.pk)

        # Blacklist all existing refresh tokens for this user by rotating them out.
        # The easiest approach: return a fresh token pair so the client stays logged in.
        refresh = RefreshToken.for_user(user)
        refresh['university_id'] = user.university_id
        refresh['full_name']     = user.full_name
        refresh['role']          = user.role

        response = Response({'message': 'Password changed successfully'})
        _set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


# ── Helper ────────────────────────────────────────────────────────────────────

def _set_auth_cookies(response, access: str, refresh: str):
    """Set both HttpOnly auth cookies on a Response object."""
    cookie_kwargs = dict(httponly=True, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE)
    response.set_cookie(key=_COOKIE_ACCESS,  value=access,  **cookie_kwargs)
    response.set_cookie(key=_COOKIE_REFRESH, value=refresh, **cookie_kwargs)


# ── Protected: Cookie-based token refresh ───────────────────────────────────
class CookieTokenRefreshView(APIView):
    """
    POST /api/auth/refresh/
    Reads the refresh_token cookie, issues a new access_token cookie.
    If ROTATE_REFRESH_TOKENS=True, also replaces the refresh_token cookie.
    No request body needed — everything is read from cookies.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        raw_refresh = request.COOKIES.get(_COOKIE_REFRESH)
        if not raw_refresh:
            return Response(
                {'error': 'refresh_token cookie is missing'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            token = RefreshToken(raw_refresh)
            new_access = str(token.access_token)

            response = Response({'message': 'Token refreshed'})
            response.set_cookie(
                key=_COOKIE_ACCESS, value=new_access,
                httponly=True, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
            )

            # If rotation is enabled simplejwt already blacklisted the old token
            # and we get a new refresh token.
            if _JWT.get('ROTATE_REFRESH_TOKENS', False):
                new_refresh = str(token)  # token object now contains the rotated token
                response.set_cookie(
                    key=_COOKIE_REFRESH, value=new_refresh,
                    httponly=True, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
                )

            return response

        except TokenError as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)
