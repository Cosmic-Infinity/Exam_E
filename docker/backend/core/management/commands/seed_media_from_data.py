from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import shutil

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import CourseAllocation, Enrollment, User


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
SUBJECT_ALIAS_KEYWORDS = {
    "DAA": ("algorithm", "algorithms", "analysis"),
    "CI": ("intelligence", "machine learning", "ai", "analytics", "computational"),
    "SE": ("software", "database", "web", "programming", "systems"),
    "CN": ("network", "networks", "communication", "signals"),
    "EE": ("electronic", "electronics", "circuit", "circuits", "embedded", "signal"),
    "HPC": ("high performance", "parallel", "performance", "compute", "computing"),
}


class Command(BaseCommand):
    help = (
        "Seed backend/mediafiles from Data/Papers and link to enrollments. "
        "Creates/updates mediafiles/papers/<ROLLNO>_<COURSECODE> folders, copies exam docs, "
        "optionally backfills missing allocation teachers, then runs import_exam_media."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--pages-per-paper",
            type=int,
            default=4,
            help="Number of pages to copy per enrollment paper folder (default: 4).",
        )
        parser.add_argument(
            "--overwrite-existing",
            action="store_true",
            help="Overwrite existing files under mediafiles/papers/<ROLLNO>_<COURSECODE>.",
        )
        parser.add_argument(
            "--assign-missing-teachers",
            action="store_true",
            help="If an allocation has no teacher, assign the best matching teacher from specialization.",
        )
        parser.add_argument(
            "--skip-link",
            action="store_true",
            help="Only copy files; do not run import_exam_media at the end.",
        )

    def handle(self, *args, **options):
        pages_per_paper = max(1, options["pages_per_paper"])
        overwrite_existing = options["overwrite_existing"]
        assign_missing_teachers = options["assign_missing_teachers"]
        skip_link = options["skip_link"]

        media_root = Path(settings.MEDIA_ROOT)
        papers_root = media_root / "papers"
        docs_root = media_root / "exam_docs"
        data_root = self._resolve_data_root()

        papers_root.mkdir(parents=True, exist_ok=True)
        docs_root.mkdir(parents=True, exist_ok=True)

        subject_pools = self._collect_subject_pools(data_root)
        if not subject_pools:
            self.stdout.write(self.style.WARNING("No source files found in Data/Papers subject folders."))
            return

        with transaction.atomic():
            if assign_missing_teachers:
                teacher_assignments = self._assign_missing_allocation_teachers(subject_pools)
                self.stdout.write(
                    f"Teacher assignments backfilled: {teacher_assignments['assigned']} (skipped: {teacher_assignments['skipped']})"
                )

            copy_summary = self._seed_paper_folders(
                subject_pools,
                papers_root,
                pages_per_paper,
                overwrite_existing,
            )
            docs_summary = self._copy_exam_docs(data_root, docs_root, overwrite_existing)

        self.stdout.write(self.style.SUCCESS("Data -> mediafiles seed complete."))
        self.stdout.write(
            (
                "Paper folders: created=%(created)s updated=%(updated)s skipped=%(skipped)s "
                "enrollments_seen=%(enrollments_seen)s"
            )
            % copy_summary
        )
        self.stdout.write(
            "Exam docs copied: copied=%s skipped=%s" % (docs_summary["copied"], docs_summary["skipped"])
        )

        if not skip_link:
            self.stdout.write("Running import_exam_media to link copied assets with enrollments/exams...")
            call_command("import_exam_media", overwrite_existing=overwrite_existing)

    def _resolve_data_root(self) -> Path:
        candidates = [
            Path(settings.BASE_DIR) / "Data",
            Path(settings.BASE_DIR).parent / "Data",
            Path(settings.BASE_DIR).parent.parent / "Data",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        raise FileNotFoundError("Could not locate Data directory from Django BASE_DIR.")

    def _collect_subject_pools(self, data_root: Path) -> dict[str, list[Path]]:
        pools: dict[str, list[Path]] = defaultdict(list)
        papers_root = data_root / "Papers"

        for sem_folder in (papers_root / "MidSem", papers_root / "EndSem"):
            if not sem_folder.exists():
                continue

            for subject_dir in sem_folder.iterdir():
                if not subject_dir.is_dir():
                    continue
                if "answer" in subject_dir.name.lower():
                    continue

                token = subject_dir.name.strip().upper()
                files = sorted(
                    [
                        p
                        for p in subject_dir.rglob("*")
                        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
                    ],
                    key=lambda p: p.name.lower(),
                )
                pools[token].extend(files)

        # Deduplicate while preserving deterministic order.
        for token, files in pools.items():
            seen = set()
            unique = []
            for file_path in files:
                key = str(file_path.resolve())
                if key in seen:
                    continue
                seen.add(key)
                unique.append(file_path)
            pools[token] = unique

        return dict(pools)

    def _seed_paper_folders(
        self,
        subject_pools: dict[str, list[Path]],
        papers_root: Path,
        pages_per_paper: int,
        overwrite_existing: bool,
    ):
        summary = {"created": 0, "updated": 0, "skipped": 0, "enrollments_seen": 0}

        enrollments = (
            Enrollment.objects.filter(status="ACTIVE")
            .select_related("student", "allocation__course", "allocation__teacher__teacher_profile")
            .order_by("enrollment_id")
        )

        course_context = self._course_context(enrollments)
        tokens = sorted(subject_pools.keys())

        for enrollment in enrollments:
            summary["enrollments_seen"] += 1

            course_code = enrollment.allocation.course.course_code.upper()
            roll_no = enrollment.student.university_id
            folder = papers_root / f"{roll_no}_{course_code}"
            folder_exists = folder.exists() and any(folder.iterdir())

            if folder_exists and not overwrite_existing:
                summary["skipped"] += 1
                continue

            token = self._pick_subject_token(course_context[course_code], tokens)
            source_files = subject_pools.get(token, [])
            if not source_files:
                summary["skipped"] += 1
                continue

            folder.mkdir(parents=True, exist_ok=True)
            if overwrite_existing:
                for old_file in folder.glob("*"):
                    if old_file.is_file():
                        old_file.unlink()

            picked = self._slice_for_enrollment(source_files, pages_per_paper, enrollment.enrollment_id)
            for index, source in enumerate(picked, start=1):
                ext = source.suffix.lower() or ".jpg"
                target = folder / f"page{index}{ext}"
                shutil.copy2(source, target)

            if folder_exists:
                summary["updated"] += 1
            else:
                summary["created"] += 1

        return summary

    def _course_context(self, enrollments):
        ctx: dict[str, dict[str, str]] = {}
        for enrollment in enrollments:
            course = enrollment.allocation.course
            teacher = enrollment.allocation.teacher
            teacher_spec = ""
            if teacher and hasattr(teacher, "teacher_profile") and teacher.teacher_profile:
                teacher_spec = teacher.teacher_profile.specialization or ""
            course_code = course.course_code.upper()
            entry = ctx.setdefault(course_code, {"title": (course.title or ""), "teacher_specs": ""})
            if teacher_spec:
                existing = entry["teacher_specs"]
                entry["teacher_specs"] = f"{existing} {teacher_spec}".strip()
        return ctx

    def _pick_subject_token(self, course_data: dict[str, str], tokens: list[str]) -> str:
        title = (course_data.get("title") or "").lower()
        teacher_specs = (course_data.get("teacher_specs") or "").lower()
        text = f"{title} {teacher_specs}".strip()

        best_token = tokens[0]
        best_score = -1
        for token in tokens:
            score = 0
            token_lower = token.lower()
            if token_lower in text:
                score += 3
            for keyword in SUBJECT_ALIAS_KEYWORDS.get(token, ()):  # Fallback keywords for ambiguous subject folders.
                if keyword in text:
                    score += 2
            if score > best_score:
                best_score = score
                best_token = token

        return best_token

    def _slice_for_enrollment(self, files: list[Path], count: int, enrollment_id: int):
        if len(files) <= count:
            return files
        start = enrollment_id % len(files)
        picked = []
        for i in range(count):
            picked.append(files[(start + i) % len(files)])
        return picked

    def _copy_exam_docs(self, data_root: Path, docs_root: Path, overwrite_existing: bool):
        copied = 0
        skipped = 0

        source_dirs = [
            data_root / "Papers" / "Questions",
            data_root / "Papers" / "MidSem" / "Answer Keys",
            data_root / "Papers" / "EndSem" / "Answer Key",
        ]

        for source_dir in source_dirs:
            if not source_dir.exists():
                continue
            for source in sorted(source_dir.glob("*"), key=lambda p: p.name.lower()):
                if not source.is_file():
                    continue
                target = docs_root / source.name
                if target.exists() and not overwrite_existing:
                    skipped += 1
                    continue
                shutil.copy2(source, target)
                copied += 1

        return {"copied": copied, "skipped": skipped}

    def _assign_missing_allocation_teachers(self, subject_pools: dict[str, list[Path]]):
        assigned = 0
        skipped = 0

        missing_allocations = CourseAllocation.objects.filter(teacher__isnull=True).select_related("course")
        teachers = (
            User.objects.filter(role="TEACHER")
            .select_related("teacher_profile")
            .order_by("university_id")
        )
        tokens = sorted(subject_pools.keys())

        for allocation in missing_allocations:
            course_text = (allocation.course.title or "").lower()
            token = self._pick_subject_token({"title": course_text, "teacher_specs": ""}, tokens)

            best_teacher = None
            best_score = -1
            for teacher in teachers:
                if not hasattr(teacher, "teacher_profile") or not teacher.teacher_profile:
                    continue
                specialization = (teacher.teacher_profile.specialization or "").lower()
                score = 0
                if token.lower() in specialization:
                    score += 2
                for keyword in SUBJECT_ALIAS_KEYWORDS.get(token, ()):  # Reuse the same token heuristics.
                    if keyword in specialization:
                        score += 2
                if score > best_score:
                    best_score = score
                    best_teacher = teacher

            if best_teacher:
                allocation.teacher = best_teacher
                allocation.save(update_fields=["teacher"])
                assigned += 1
            else:
                skipped += 1

        return {"assigned": assigned, "skipped": skipped}