"""
Celery tasks for email notifications related to authentication.

Registered under the 'core' app. These tasks are called async
(via .delay()) so the API response is never blocked by SMTP.

Available tasks:
    send_password_changed_email(user_id)
    send_welcome_email(user_id)
"""
import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_changed_email(self, user_id: int):
    """
    Sends a notification email when a user successfully changes their password.
    Retries up to 3 times on failure (SMTP errors, etc.).
    """
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning('send_password_changed_email: user %s not found', user_id)
        return

    subject = 'Your Exam-E password was changed'
    message = (
        f'Hi {user.full_name},\n\n'
        'Your Exam-E account password has just been changed.\n'
        'If you did not perform this action, please contact the administrator immediately.\n\n'
        'Exam-E Team'
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email] if user.email else [],
            fail_silently=False,
        )
        logger.info('Password-change email sent to user %s (%s)', user_id, user.email)
    except Exception as exc:
        logger.error('Failed to send password-change email to user %s: %s', user_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_welcome_email(self, user_id: int):
    """
    Sends a welcome email when a new user account is created.
    Can be triggered from UserAdmin.save_model or a post_save signal.
    """
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning('send_welcome_email: user %s not found', user_id)
        return

    subject = 'Welcome to Exam-E'
    message = (
        f'Hi {user.full_name},\n\n'
        f'Your Exam-E account has been created.\n'
        f'Your login ID is: {user.university_id}\n\n'
        'Please set your password by contacting the administrator or using '
        'the password-change endpoint once you receive your temporary credentials.\n\n'
        'Exam-E Team'
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email] if user.email else [],
            fail_silently=False,
        )
        logger.info('Welcome email sent to user %s (%s)', user_id, user.email)
    except Exception as exc:
        logger.error('Failed to send welcome email to user %s: %s', user_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_credentials_email(self, user_id: int, plain_password: str):
    """
    Sends an email with the new login credentials (including plaintext password).
    This is triggered by the admin bulk password generation action.
    """
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning('send_credentials_email: user %s not found', user_id)
        return

    subject = 'Exam-E: Your Login Credentials'
    message = (
        f'Hi {user.full_name},\n\n'
        'Your login credentials for Exam-E have been generated/reset by the administrator.\n\n'
        f'Login ID: {user.email}\n'
        f'University ID: {user.university_id}\n'
        f'Password: {plain_password}\n\n'
        'Please keep these credentials safe.\n\n'
        'Exam-E Team'
    )
    
    if not user.email:
        logger.warning('send_credentials_email: User %s has no email address.', user_id)
        return

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info('Credentials email sent to user %s (%s)', user_id, user.email)
    except Exception as exc:
        logger.error('Failed to send credentials email to user %s: %s', user_id, exc)
        raise self.retry(exc=exc)
