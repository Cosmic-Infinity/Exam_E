from pathlib import Path
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand

from core.models import Exam


class Command(BaseCommand):
	help = (
		'Normalize linked exam doc filenames in mediafiles/exam_docs to '
		'Exam<exam_id>_<course_code>_QP/AK.<ext> and update Exam paths.'
	)

	def add_arguments(self, parser):
		parser.add_argument(
			'--overwrite-existing',
			action='store_true',
			help='Overwrite target files if they already exist.',
		)

	def handle(self, *args, **options):
		overwrite_existing = options['overwrite_existing']
		media_root = Path(settings.MEDIA_ROOT)
		docs_root = media_root / 'exam_docs'
		docs_root.mkdir(parents=True, exist_ok=True)

		summary = {
			'qp_updated': 0,
			'ak_updated': 0,
			'qp_missing_source': 0,
			'ak_missing_source': 0,
			'qp_skipped': 0,
			'ak_skipped': 0,
		}

		for exam in Exam.objects.select_related('allocation__course').order_by('exam_id'):
			course_code = exam.allocation.course.course_code.upper()

			new_qp_rel = self._normalize_one(
				exam.question_paper_path,
				docs_root,
				f'Exam{exam.exam_id}_{course_code}_QP',
				overwrite_existing,
				summary,
				'is_qp',
			)
			if new_qp_rel and new_qp_rel != exam.question_paper_path:
				exam.question_paper_path = new_qp_rel
				summary['qp_updated'] += 1

			new_ak_rel = self._normalize_one(
				exam.answer_key_path,
				docs_root,
				f'Exam{exam.exam_id}_{course_code}_AK',
				overwrite_existing,
				summary,
				'is_ak',
			)
			if new_ak_rel and new_ak_rel != exam.answer_key_path:
				exam.answer_key_path = new_ak_rel
				summary['ak_updated'] += 1

			exam.save(update_fields=['question_paper_path', 'answer_key_path'])

		self.stdout.write(self.style.SUCCESS('Exam doc filename normalization complete.'))
		self.stdout.write(
			(
				'QP: updated=%(qp_updated)s missing_source=%(qp_missing_source)s skipped=%(qp_skipped)s | '
				'AK: updated=%(ak_updated)s missing_source=%(ak_missing_source)s skipped=%(ak_skipped)s'
			)
			% summary
		)

	def _normalize_one(self, rel_path, docs_root, target_stem, overwrite_existing, summary, kind):
		if not rel_path:
			return rel_path

		source_path = self._to_abs_path(rel_path)
		if not source_path.exists() or not source_path.is_file():
			if kind == 'is_qp':
				summary['qp_missing_source'] += 1
			else:
				summary['ak_missing_source'] += 1
			return rel_path

		ext = source_path.suffix.lower() or '.pdf'
		target_path = docs_root / f'{target_stem}{ext}'

		if source_path.resolve() != target_path.resolve():
			if target_path.exists() and not overwrite_existing:
				if kind == 'is_qp':
					summary['qp_skipped'] += 1
				else:
					summary['ak_skipped'] += 1
				return f'media/exam_docs/{target_path.name}'
			shutil.copy2(source_path, target_path)

		return f'media/exam_docs/{target_path.name}'

	def _to_abs_path(self, rel_path):
		normalized = rel_path.lstrip('/')
		if normalized.startswith('media/'):
			normalized = normalized[len('media/'):]
		return Path(settings.MEDIA_ROOT) / normalized