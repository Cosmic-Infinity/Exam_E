from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

_SECRET_KEY = os.environ.get('SECRET_KEY')
if not _SECRET_KEY:
    raise ValueError(
        'SECRET_KEY environment variable is not set. '
        'Set it in docker-compose.yml or your .env file.'
    )
SECRET_KEY = _SECRET_KEY

DEBUG = bool(int(os.environ.get('DEBUG', 0)))  # default OFF; set DEBUG=1 only in dev

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')

INSTALLED_APPS = [
    'core',

    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt.token_blacklist',

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]



MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': os.environ.get('DATABASE_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.environ.get('DATABASE_NAME', 'exam_e'),
        'USER': os.environ.get('DATABASE_USER', 'postgres'),
        'PASSWORD': os.environ.get('DATABASE_PASSWORD'),  # must be set — no default
        'HOST': os.environ.get('DATABASE_HOST', 'db'),
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'mediafiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.User'
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend', # Fallback
    'core.api.authentication.EmailBackend',
]

from datetime import timedelta

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # Cookie-based first (used by LoginView), then header-based as fallback
        'core.api.authentication.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# Set COOKIE_SECURE=0 in .env for local HTTP development; set to 1 in production (HTTPS)
_COOKIE_SECURE = bool(int(os.environ.get('COOKIE_SECURE', 0)))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_COOKIE': 'access_token',          # cookie name read by CookieJWTAuthentication
    'AUTH_COOKIE_REFRESH': 'refresh_token', # informational; used in views_auth.py
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SECURE': _COOKIE_SECURE,
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:8080'
).split(',')

CSRF_TRUSTED_ORIGINS = os.environ.get(
    'CSRF_TRUSTED_ORIGINS', 'http://localhost,http://127.0.0.1'
).split(',')

CORS_ALLOW_CREDENTIALS = True

# ── Email ─────────────────────────────────────────────────────────────────────
# In development (EMAIL_BACKEND not set) emails are printed to the console.
# In production set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# and supply the SMTP env vars below.
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS       = bool(int(os.environ.get('EMAIL_USE_TLS', 1)))
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@exam-e.local')

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL    = os.environ.get('CELERY_BROKER_URL',    'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://redis:6379/1')
CELERY_ACCEPT_CONTENT  = ['json']
CELERY_TASK_SERIALIZER = 'json'

# ── Security hardening ────────────────────────────────────────────────────────
# Trust the X-Forwarded-Proto header set by nginx so Django knows it's behind HTTPS.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Cookie security — driven by the same env toggle as JWT cookies.
CSRF_COOKIE_SECURE   = _COOKIE_SECURE
SESSION_COOKIE_SECURE = _COOKIE_SECURE

# Force HTTPS redirects and HSTS only in production (DEBUG=0).
if not DEBUG:
    SECURE_SSL_REDIRECT           = True
    SECURE_HSTS_SECONDS           = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD           = True
    SECURE_CONTENT_TYPE_NOSNIFF   = True
    SECURE_BROWSER_XSS_FILTER     = True
    X_FRAME_OPTIONS               = 'DENY'


