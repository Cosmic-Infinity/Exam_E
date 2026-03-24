#!/bin/sh

# Wait for database
echo "Waiting for postgres..."
while ! nc -z db 5432; do
  sleep 1
done
echo "PostgreSQL started"

BOOTSTRAP="${RUN_BOOTSTRAP:-1}"
if [ "$BOOTSTRAP" != "1" ]; then
    echo "Bootstrap disabled for this service. Skipping migrations/import pipeline."
    exec "$@"
fi

SNAPSHOT_FILE="${DB_SNAPSHOT_FILE:-/app/Data/db_snapshots/exam_e_snapshot.sql}"
SNAPSHOT_LOADED=0

if [ -f "$SNAPSHOT_FILE" ]; then
    echo "Database snapshot found at: $SNAPSHOT_FILE"
    echo "Restoring snapshot before migrations/imports..."

    export PGPASSWORD="${DATABASE_PASSWORD:-postgres}"
    DB_HOST="${DATABASE_HOST:-db}"
    DB_PORT="${DATABASE_PORT:-5432}"
    DB_NAME="${DATABASE_NAME:-exam_e}"
    DB_USER="${DATABASE_USER:-postgres}"

    psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SNAPSHOT_FILE"

    SNAPSHOT_LOADED=1
    echo "Snapshot restore complete."
else
    echo "No database snapshot found at $SNAPSHOT_FILE. Proceeding with normal bootstrap flow."
fi

# Run migrations
# Using --fake-initial because the schema may already exist from init_db.sql
if [ "$SNAPSHOT_LOADED" = "1" ]; then
    python manage.py migrate --noinput
else
    python manage.py migrate --noinput --fake-initial
fi

# --- AUTOMATIC SUPERUSER CREATION ---
echo "Checking for superuser..."
python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print("Creating auto-generated superuser...")
    User.objects.create_superuser(
        email='admin@kiit.ac.in',
        password='admin',
        full_name='System Admin',
        university_id='0000'
    )
else:
    print("Superuser already exists.")
EOF

# Collect static files
python manage.py collectstatic --noinput

if [ "$SNAPSHOT_LOADED" = "1" ]; then
    echo "Snapshot mode active. Skipping CSV bootstrap import pipeline."

    if [ "${RUN_MEDIA_SYNC_ON_SNAPSHOT:-1}" = "1" ]; then
        echo "Snapshot mode: syncing media links from Data/Papers..."
        python manage.py seed_media_from_data --pages-per-paper "${MEDIA_PAGES_PER_PAPER:-5}" --skip-link
        python manage.py import_exam_media --overwrite-existing
    else
        echo "Snapshot mode: media sync disabled (RUN_MEDIA_SYNC_ON_SNAPSHOT=${RUN_MEDIA_SYNC_ON_SNAPSHOT:-1})."
    fi

    exec "$@"
fi

# --- AUTOMATIC DATA IMPORT ---
echo "--- Starting post-migration data check/import ---"

# Step 1: Base Data (Schools, Streams, Teachers, Courses)
# These scripts use environment variables for DB config and handle existing data gracefully.
echo "Importing Foundational Data (Schools/Streams)..."
python scripts/import_academic_data.py --founders "Data/test_data/0. schools_streams.csv"

echo "Importing Teachers..."
python scripts/import_academic_data.py --teachers "Data/test_data/2_teachers.csv"

echo "Importing Courses..."
python scripts/import_academic_data.py --courses "Data/test_data/3_courses.csv"

echo "Importing Allocations..."
python scripts/import_academic_data.py --allocations "Data/test_data/4_allocations.csv"

# Step 2: Students
echo "Importing Students..."
python scripts/import_students.py "Data/test_data/1_students.csv"

# Step 3: Enrollments (Depends on Students and Allocations)
echo "Importing Enrollments..."
python scripts/bulk_enroll.py --csv "Data/test_data/5_enrollments.csv" --session "2024-2025"

# Step 4: Seed missing paper/doc files into mediafiles from Data/Papers
# This prevents exam_papers.pages from staying NULL when a roll-course folder
# is absent under backend/mediafiles/papers.
echo "Seeding mediafiles from Data/Papers..."
python manage.py seed_media_from_data --pages-per-paper "${MEDIA_PAGES_PER_PAPER:-5}"

# Step 5: Auto-link exam docs and student paper pages from mediafiles
echo "Linking exam media from backend/mediafiles..."
python manage.py import_exam_media --overwrite-existing

echo "--- Automatic Data Import Complete ---"
# --- END DATA IMPORT ---

# Execute the CMD passed in Dockerfile/compose
exec "$@"
