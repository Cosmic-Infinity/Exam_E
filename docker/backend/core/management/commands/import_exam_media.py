from pathlib import Path
import re

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Enrollment, Exam, ExamPaper


PAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}


class Command(BaseCommand):
	help = (
		'Auto-link exam assets from mediafiles. '\
		'Papers are mapped by folders named ROLLNO_SUBJECTCODE under mediafiles/papers, '\
		'and exam docs are linked from mediafiles/exam_docs.'
	)

	def add_arguments(self, parser):
		parser.add_argument(
			'--overwrite-existing',
			action='store_true',
			help='Overwrite existing paper page links and exam document paths.',
		)
		parser.add_argument(
			'--no-create-missing-exams',
			action='store_true',
			help='Do not auto-create a default MIDSEM exam when no exam exists for an allocation.',
		)
		parser.add_argument(
			'--default-total-marks',
			type=int,
			default=100,
			help='Total marks for auto-created default exams (default: 100).',
		)
		parser.add_argument(
			'--default-passing-marks',
			type=int,
			default=40,
			help='Passing marks for auto-created default exams (default: 40).',
		)

	def handle(self, *args, **options):
		overwrite_existing = options['overwrite_existing']
		create_missing_exams = not options['no_create_missing_exams']
		default_total_marks = options['default_total_marks']
		default_passing_marks = options['default_passing_marks']

		media_root = Path(settings.MEDIA_ROOT)
		papers_root = media_root / 'papers'
		exam_docs_root = media_root / 'exam_docs'

		if not papers_root.exists():
			self.stdout.write(self.style.WARNING(f'Papers folder not found: {papers_root}'))
		if not exam_docs_root.exists():
			self.stdout.write(self.style.WARNING(f'Exam docs folder not found: {exam_docs_root}'))

		with transaction.atomic():
			papers_summary = self._link_papers(
				papers_root,
				media_root,
				overwrite_existing,
				create_missing_exams,
				default_total_marks,
				default_passing_marks,
			)
			docs_summary = self._link_exam_docs(
				exam_docs_root,
				media_root,
				overwrite_existing,
			)

		self.stdout.write(self.style.SUCCESS('Exam media import finished.'))
		self.stdout.write(
			(
				'Papers: created=%(created)s updated=%(updated)s skipped=%(skipped)s '\
				'folders_without_match=%(folders_without_match)s auto_created_exams=%(auto_created_exams)s'
			)
			% papers_summary
		)
		self.stdout.write(
			(
				'Exam docs: qp_linked=%(qp_linked)s ak_linked=%(ak_linked)s '\
				'qp_skipped=%(qp_skipped)s ak_skipped=%(ak_skipped)s'
			)
			% docs_summary
		)

	def _link_papers(
		self,
		papers_root,
		media_root,
		overwrite_existing,
		create_missing_exams,
		default_total_marks,
		default_passing_marks,
	):
		summary = {
			'created': 0,
			'updated': 0,
			'skipped': 0,
			'folders_without_match': 0,
			'auto_created_exams': 0,
		}

		if not papers_root.exists():
			return summary

		for paper_folder in sorted(papers_root.iterdir(), key=lambda p: p.name.lower()):
			if not paper_folder.is_dir() or paper_folder.name.startswith('.'):
				continue

			parsed = self._parse_roll_course_from_folder(paper_folder.name)
			if not parsed:
				summary['folders_without_match'] += 1
				continue

			roll_no, course_code = parsed
			pages = self._collect_page_paths(paper_folder, media_root)

			if not pages:
				summary['skipped'] += 1
				continue

			enrollments = Enrollment.objects.filter(
				student__university_id=roll_no,
				allocation__course__course_code__iexact=course_code,
				status='ACTIVE',
			).select_related('allocation', 'student')

			if not enrollments.exists():
				summary['folders_without_match'] += 1
				continue

			for enrollment in enrollments:
				exams = list(
					Exam.objects.filter(allocation=enrollment.allocation)
					.order_by('created_at', 'exam_id')
				)

				if not exams and create_missing_exams:
					exam = Exam.objects.create(
						allocation=enrollment.allocation,
						exam_type='MIDSEM',
						total_marks=default_total_marks,
						passing_marks=default_passing_marks,
						is_active=True,
					)
					exams = [exam]
					summary['auto_created_exams'] += 1

				if not exams:
					summary['skipped'] += 1
					continue

				for exam in exams:
					paper, created = ExamPaper.objects.get_or_create(
						enrollment=enrollment,
						exam=exam,
						defaults={
							'pages': pages,
							'evaluation_status': 'PENDING',
						},
					)

					if created:
						summary['created'] += 1
						continue

					should_update = overwrite_existing or not paper.pages
					if should_update:
						paper.pages = pages
						paper.save(update_fields=['pages'])
						summary['updated'] += 1
					else:
						summary['skipped'] += 1

		return summary

	def _link_exam_docs(self, exam_docs_root, media_root, overwrite_existing):
		summary = {
			'qp_linked': 0,
			'ak_linked': 0,
			'qp_skipped': 0,
			'ak_skipped': 0,
		}

		if not exam_docs_root.exists():
			return summary

		doc_files = [
			p
			for p in exam_docs_root.iterdir()
			if p.is_file() and not p.name.startswith('.')
		]

		qp_files = [p for p in doc_files if self._is_question_paper_file(p.stem.upper())]
		ak_files = [p for p in doc_files if self._is_answer_key_file(p.stem.upper())]

		for exam in Exam.objects.select_related('allocation__course').all():
			qp_candidate = self._pick_exam_doc(qp_files, exam.exam_type, exam.exam_id)
			ak_candidate = self._pick_exam_doc(ak_files, exam.exam_type, exam.exam_id)
			changed = False

			if qp_candidate:
				qp_path = self._as_media_url_path(qp_candidate, media_root)
				if overwrite_existing or not exam.question_paper_path:
					exam.question_paper_path = qp_path
					summary['qp_linked'] += 1
					changed = True
				else:
					summary['qp_skipped'] += 1

			if ak_candidate:
				ak_path = self._as_media_url_path(ak_candidate, media_root)
				if overwrite_existing or not exam.answer_key_path:
					exam.answer_key_path = ak_path
					summary['ak_linked'] += 1
					changed = True
				else:
					summary['ak_skipped'] += 1

			if changed:
				exam.save(update_fields=['question_paper_path', 'answer_key_path'])

		return summary

	def _parse_roll_course_from_folder(self, folder_name):
		if '_' not in folder_name:
			return None
		roll_no, course_code = folder_name.split('_', 1)
		roll_no = roll_no.strip()
		course_code = course_code.strip().upper()
		if not roll_no or not course_code:
			return None
		return roll_no, course_code

	def _collect_page_paths(self, paper_folder, media_root):
		files = [
			p
			for p in paper_folder.iterdir()
			if p.is_file() and p.suffix.lower() in PAGE_EXTENSIONS
		]
		files = sorted(files, key=lambda p: p.name.lower())
		return [self._as_media_url_path(p, media_root) for p in files]

	def _as_media_url_path(self, file_path, media_root):
		rel = file_path.relative_to(media_root).as_posix()
		return f'media/{rel}'

	def _pick_exam_doc(self, doc_files, exam_type, seed):
		if not doc_files:
			return None

		sorted_files = sorted(doc_files, key=lambda p: p.name.lower())
		exam_type_matches = [p for p in sorted_files if self._is_exam_type_file(p.stem.upper(), exam_type)]
		if exam_type_matches:
			return exam_type_matches[seed % len(exam_type_matches)]

		return sorted_files[seed % len(sorted_files)]

	def _is_exam_type_file(self, stem_upper, exam_type):
		tokens = set(filter(None, re.split(r'[^A-Z0-9]+', stem_upper)))
		exam_type_upper = (exam_type or '').upper()
		if exam_type_upper == 'MIDSEM':
			return bool({'MID', 'MIDSEM', 'MIDSEMS', 'MIDTERM'} & tokens)
		if exam_type_upper == 'ENDSEM':
			return bool({'END', 'ENDSEM', 'ENDSEMS', 'FINAL'} & tokens)
		if exam_type_upper == 'QUIZ':
			return bool({'QUIZ', 'QUIZZES'} & tokens)
		return False

	def _is_question_paper_file(self, stem_upper):
		tokens = set(filter(None, re.split(r'[^A-Z0-9]+', stem_upper)))
		return bool({'QP', 'QUESTION', 'QUESTIONS', 'QUESTIONPAPER'} & tokens)

	def _is_answer_key_file(self, stem_upper):
		tokens = set(filter(None, re.split(r'[^A-Z0-9]+', stem_upper)))
		return bool({'AK', 'KEY', 'ANSWER', 'ANS', 'ANSWERKEY'} & tokens)
