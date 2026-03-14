"""
Celery tasks for email notifications related to authentication.

Registered under the 'core' app. These tasks are called async
(via .delay()) so the API response is never blocked by SMTP.

Available tasks:
    send_password_changed_email(user_id)
    send_welcome_email(user_id)
"""
import logging
import string
import random
import uuid
from copy import deepcopy
from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from core.models import Exam, Enrollment, ExamPaper

logger = logging.getLogger(__name__)


def _extract_schema_sections(schema):
    if not schema:
        return []

    if isinstance(schema, dict) and isinstance(schema.get('sections'), list):
        return schema.get('sections', [])

    # Backward-compatible parser for array-only schema payloads.
    if isinstance(schema, list):
        return [{'type': 'COMPULSORY', 'questions': schema}]

    return []


def _build_marks_template_from_schema(schema):
    sections = _extract_schema_sections(schema)
    marks_template = {
        'template_version': 3,
        'generated_from_schema': True,
        'sections': [],
    }

    for section_index, section in enumerate(sections, start=1):
        questions_payload = []
        for fallback_q_index, question in enumerate(section.get('questions', []), start=1):
            q_no = question.get('q_no') or fallback_q_index
            parts = question.get('parts', []) if isinstance(question.get('parts'), list) else []

            parts_payload = []
            expected_total = 0.0
            for p_index, max_mark in enumerate(parts, start=1):
                expected_marks = float(max_mark or 0)
                expected_total += expected_marks
                parts_payload.append({
                    'part_no': p_index,
                    'expected_marks': expected_marks,
                    'awarded_marks': None,
                })

            questions_payload.append({
                'q_no': int(q_no),
                'expected_total': expected_total,
                'awarded_total': None,
                'parts': parts_payload,
            })

        marks_template['sections'].append({
            'section_index': section_index,
            'type': section.get('type', 'COMPULSORY'),
            'choose': section.get('choose'),
            'questions': questions_payload,
        })
    return marks_template


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


def _generate_password(algorithm: str) -> str:
    """Helper to generate a password based on the chosen algorithm."""
    if algorithm == 'numeric_8':
        return ''.join(random.choices(string.digits, k=8))
    elif algorithm == 'alnum_10':
        chars = string.ascii_letters + string.digits
        return ''.join(random.choices(chars, k=10))
    elif algorithm == 'uuid_12':
        return str(uuid.uuid4())[:12]
    else:
        # Default to a reasonably secure password
        chars = string.ascii_letters + string.digits
        return ''.join(random.choices(chars, k=10))


@shared_task(bind=True)
def generate_and_email_passwords_task(self, user_ids: list[int], algorithm: str):
    """
    Generates new passwords for a list of users and sends them via email.
    This is a parent task that calls sub-tasks for each user.
    """
    User = get_user_model()
    logger.info(f"Starting bulk password generation for {len(user_ids)} users with algorithm '{algorithm}'.")

    for user_id in user_ids:
        try:
            user = User.objects.get(pk=user_id)
            new_password = _generate_password(algorithm)
            user.set_password(new_password)
            user.save(update_fields=['password'])
            
            # Queue the email sending task
            send_credentials_email.delay(user_id=user.id, plain_password=new_password)
            logger.info(f"Successfully generated password and queued email for user {user_id}.")

        except User.DoesNotExist:
            logger.warning(f"generate_and_email_passwords_task: User with ID {user_id} not found. Skipping.")
        except Exception as e:
            logger.error(f"An error occurred for user {user_id} in generate_and_email_passwords_task: {e}")
    
    logger.info("Finished bulk password generation task.")


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_exam_paper_marks_template_task(self, exam_id: int):
    """
    Auto-creates/refreshes marks templates for all ACTIVE enrollments of an exam
    whenever the exam schema is set/updated.
    """
    try:
        exam = Exam.objects.select_related('allocation__course').get(pk=exam_id)
    except Exam.DoesNotExist:
        logger.warning('generate_exam_paper_marks_template_task: exam %s not found', exam_id)
        return

    if not exam.question_paper_schema:
        logger.info('Exam %s has no schema; skipping marks template generation.', exam_id)
        return

    marks_template = _build_marks_template_from_schema(exam.question_paper_schema)

    enrollments = Enrollment.objects.filter(
        allocation=exam.allocation,
        status='ACTIVE',
    ).select_related('student', 'allocation__course')

    if not enrollments.exists():
        logger.info('No ACTIVE enrollments found for exam %s allocation %s', exam_id, exam.allocation_id)
        return

    created_count = 0
    updated_count = 0

    with transaction.atomic():
        for enrollment in enrollments:
            paper, created = ExamPaper.objects.get_or_create(
                enrollment=enrollment,
                exam=exam,
                defaults={
                    'marks_json': deepcopy(marks_template),
                    'evaluation_status': 'PENDING',
                    'total_score': None,
                },
            )

            if created:
                created_count += 1
                continue

            # Fresh-system policy: overwrite template from latest schema.
            paper.marks_json = deepcopy(marks_template)
            paper.total_score = None
            paper.evaluation_status = 'PENDING'
            paper.save(update_fields=['marks_json', 'total_score', 'evaluation_status'])
            updated_count += 1

    logger.info(
        'Exam %s marks template generation completed: created=%s updated=%s',
        exam_id,
        created_count,
        updated_count,
    )
