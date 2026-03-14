from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from .models import Exam
from .tasks import generate_exam_paper_marks_template_task


@receiver(pre_save, sender=Exam)
def track_previous_schema(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_question_paper_schema = None
        return

    previous_schema = Exam.objects.filter(pk=instance.pk).values_list('question_paper_schema', flat=True).first()
    instance._previous_question_paper_schema = previous_schema


@receiver(post_save, sender=Exam)
def trigger_marks_template_generation(sender, instance, created, **kwargs):
    if not instance.question_paper_schema:
        return

    previous_schema = getattr(instance, '_previous_question_paper_schema', None)
    schema_changed = created or previous_schema != instance.question_paper_schema

    if schema_changed:
        generate_exam_paper_marks_template_task.delay(instance.pk)
