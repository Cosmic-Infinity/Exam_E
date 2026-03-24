#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="/Users/prom1/Documents/Exam_E"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
BACKUP_TABLE="testing_exam_papers_backup"
PAGES_PER_PAPER="${MEDIA_PAGES_PER_PAPER:-5}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/testing_portal_ready.sh apply    # backup current paper state, relink media, mark all papers COMPLETED
  ./scripts/testing_portal_ready.sh undo     # restore paper state from backup
  ./scripts/testing_portal_ready.sh status   # print linkage + status counts
  ./scripts/testing_portal_ready.sh verify   # strict readiness checks for student + teacher portal media visibility

Environment overrides:
  ROOT_DIR=/absolute/path/to/Exam_E
  MEDIA_PAGES_PER_PAPER=5

Notes:
  - This is TESTING ONLY.
  - 'apply' stores backup in DB table: testing_exam_papers_backup.
  - 'undo' restores evaluation_status, total_score, marks_json from that table.
  - 'apply' automatically runs 'verify' at the end.
EOF
}

run_psql() {
  local sql="$1"
  docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U postgres -d exam_e -v ON_ERROR_STOP=1 -c "$sql"
}

run_backend_cmd() {
  local cmd="$1"
  docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc "$cmd"
}

print_status() {
  echo "\n[Status] Exam paper linkage + release summary"
  run_psql "SELECT COUNT(*) FILTER (WHERE pages IS NULL) AS pages_null, COUNT(*) AS total FROM exam_papers;"
  run_psql "SELECT evaluation_status, COUNT(*) FROM exam_papers GROUP BY evaluation_status ORDER BY evaluation_status;"
  run_psql "SELECT COUNT(*) FILTER (WHERE question_paper_path IS NULL) AS qp_null, COUNT(*) FILTER (WHERE answer_key_path IS NULL) AS ak_null, COUNT(*) AS total_exams FROM exams;"
  run_psql "SELECT COUNT(DISTINCT enrollment.student_id) AS students_with_visible_completed_papers FROM exam_papers ep JOIN enrollments enrollment ON ep.enrollment_id=enrollment.enrollment_id WHERE ep.evaluation_status='COMPLETED' AND ep.pages IS NOT NULL AND ep.pages <> '[]'::jsonb;"
  run_psql "SELECT COUNT(DISTINCT ex.allocation_id) AS allocations_with_teacher_linked_papers FROM exam_papers ep JOIN exams ex ON ep.exam_id=ex.exam_id JOIN course_allocations ca ON ex.allocation_id=ca.allocation_id WHERE ca.teacher_id IS NOT NULL AND ep.pages IS NOT NULL AND ep.pages <> '[]'::jsonb;"
}

verify_mode() {
  echo "\n[Verify] Running strict student/teacher readiness checks..."

  local pages_null
  local completed_without_pages
  local exams_missing_docs
  local teacher_linked_allocations
  local teacher_allocations_with_papers

  pages_null=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d exam_e -At -c "SELECT COUNT(*) FROM exam_papers WHERE pages IS NULL OR pages='[]'::jsonb;")
  completed_without_pages=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d exam_e -At -c "SELECT COUNT(*) FROM exam_papers WHERE evaluation_status='COMPLETED' AND (pages IS NULL OR pages='[]'::jsonb);")
  exams_missing_docs=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d exam_e -At -c "SELECT COUNT(*) FROM exams WHERE question_paper_path IS NULL OR answer_key_path IS NULL;")
  teacher_linked_allocations=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d exam_e -At -c "SELECT COUNT(DISTINCT ex.allocation_id) FROM exam_papers ep JOIN exams ex ON ep.exam_id=ex.exam_id JOIN course_allocations ca ON ex.allocation_id=ca.allocation_id WHERE ca.teacher_id IS NOT NULL AND ep.pages IS NOT NULL AND ep.pages <> '[]'::jsonb;")
  teacher_allocations_with_papers=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d exam_e -At -c "SELECT COUNT(DISTINCT ex.allocation_id) FROM exam_papers ep JOIN exams ex ON ep.exam_id=ex.exam_id JOIN course_allocations ca ON ex.allocation_id=ca.allocation_id WHERE ca.teacher_id IS NOT NULL;")

  echo "  pages_null_or_empty: $pages_null"
  echo "  completed_without_pages: $completed_without_pages"
  echo "  exams_missing_qp_or_ak: $exams_missing_docs"
  echo "  teacher_allocations_with_linked_papers: $teacher_linked_allocations/$teacher_allocations_with_papers"

  if [[ "$pages_null" != "0" ]]; then
    echo "❌ Verify failed: some papers are still missing pages."
    exit 1
  fi

  if [[ "$completed_without_pages" != "0" ]]; then
    echo "❌ Verify failed: completed papers without pages found."
    exit 1
  fi

  if [[ "$exams_missing_docs" != "0" ]]; then
    echo "❌ Verify failed: exams missing question-paper/answer-key links."
    exit 1
  fi

  if [[ "$teacher_linked_allocations" != "$teacher_allocations_with_papers" ]]; then
    echo "❌ Verify failed: some teacher allocations still have no linked paper pages."
    exit 1
  fi

  echo "✅ Verify passed: student + teacher media linkage is test-ready."
}

apply_mode() {
  echo "[1/5] Ensuring backup table exists..."
  run_psql "CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
    paper_id INTEGER PRIMARY KEY,
    prev_evaluation_status VARCHAR(20),
    prev_total_score NUMERIC(5,2),
    prev_marks_json JSONB,
    backed_up_at TIMESTAMPTZ DEFAULT NOW()
  );"

  echo "[2/5] Backing up current exam paper state..."
  run_psql "TRUNCATE TABLE ${BACKUP_TABLE};"
  run_psql "INSERT INTO ${BACKUP_TABLE} (paper_id, prev_evaluation_status, prev_total_score, prev_marks_json)
            SELECT paper_id, evaluation_status, total_score, marks_json
            FROM exam_papers;"

  echo "[3/5] Seeding media folders for active enrollments..."
  run_backend_cmd "python manage.py seed_media_from_data --pages-per-paper ${PAGES_PER_PAPER} --assign-missing-teachers --overwrite-existing"

  echo "[4/5] Relinking exam media..."
  run_backend_cmd "python manage.py import_exam_media --overwrite-existing"

  echo "[5/5] Marking all papers COMPLETED for testing visibility..."
  run_psql "UPDATE exam_papers SET evaluation_status='COMPLETED' WHERE evaluation_status <> 'COMPLETED';"

  print_status
  verify_mode
  echo "\nDone: testing mode applied."
  echo "To revert: ./scripts/testing_portal_ready.sh undo"
}

undo_mode() {
  echo "[1/2] Restoring exam paper state from backup table..."
  run_psql "UPDATE exam_papers ep
            SET evaluation_status = b.prev_evaluation_status,
                total_score = b.prev_total_score,
                marks_json = b.prev_marks_json
            FROM ${BACKUP_TABLE} b
            WHERE ep.paper_id = b.paper_id;"

  echo "[2/2] Restore complete."
  print_status
  echo "\nDone: testing mode reverted."
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: docker compose file not found at $COMPOSE_FILE"
  exit 1
fi

ACTION="${1:-}"
case "$ACTION" in
  apply)
    apply_mode
    ;;
  undo)
    undo_mode
    ;;
  status)
    print_status
    ;;
  verify)
    verify_mode
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "Unknown action: $ACTION"
    usage
    exit 1
    ;;
esac
