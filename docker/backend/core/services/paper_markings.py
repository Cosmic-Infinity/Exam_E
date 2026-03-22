import json
from pathlib import Path

from django.conf import settings
from django.utils import timezone


class PaperMarkingStorageError(ValueError):
    pass


def _paper_folder_name(paper):
    student = getattr(getattr(paper, 'enrollment', None), 'student', None)
    exam = getattr(paper, 'exam', None)
    allocation = getattr(exam, 'allocation', None) if exam else None
    course = getattr(allocation, 'course', None) if allocation else None

    roll_no = (getattr(student, 'university_id', None) or '').strip()
    course_code = (getattr(course, 'course_code', None) or '').strip().upper()

    if not roll_no or not course_code:
        raise PaperMarkingStorageError('Unable to resolve paper folder name for markings storage.')

    return f'{roll_no}_{course_code}'


def _markings_directory(paper):
    media_root = Path(settings.MEDIA_ROOT)
    return media_root / 'papers' / _paper_folder_name(paper) / 'markings'


def write_page_markings(paper, page_index, markings_payload, updated_by_user_id):
    if page_index < 1:
        raise PaperMarkingStorageError('Invalid page index.')

    markings_dir = _markings_directory(paper)
    markings_dir.mkdir(parents=True, exist_ok=True)

    now = timezone.now()
    payload = {
        'paper_id': paper.paper_id,
        'page_index': page_index,
        'markings': markings_payload,
        'updated_by': updated_by_user_id,
        'updated_at': now.isoformat(),
    }

    target_file = markings_dir / f'page_{page_index}.json'
    with target_file.open('w', encoding='utf-8') as file_obj:
        json.dump(payload, file_obj, ensure_ascii=True, indent=2)

    relative_media_path = target_file.relative_to(Path(settings.MEDIA_ROOT)).as_posix()
    return {
        'media_path': f'media/{relative_media_path}',
        'updated_at': payload['updated_at'],
        'updated_by': updated_by_user_id,
    }


def read_page_markings(paper, page_index):
    if page_index < 1:
        raise PaperMarkingStorageError('Invalid page index.')

    target_file = _markings_directory(paper) / f'page_{page_index}.json'
    if not target_file.exists() or not target_file.is_file():
        return None

    with target_file.open('r', encoding='utf-8') as file_obj:
        data = json.load(file_obj)

    if not isinstance(data, dict):
        raise PaperMarkingStorageError('Stored markings payload is invalid.')

    return data
