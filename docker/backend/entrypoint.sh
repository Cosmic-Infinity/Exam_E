#!/bin/sh

# Wait for database
echo "Waiting for postgres..."
while ! nc -z db 5432; do
  sleep 1
done
echo "PostgreSQL started"

# Run migrations
# Using --fake-initial because the schema may already exist from init_db.sql
python manage.py migrate --noinput --fake-initial

# --- AUTOMATIC SUPERUSER CREATION ---
echo "Checking for superuser..."
python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print("Creating auto-generated superuser...")
    User.objects.create_superuser(
        email='23052199@kiit.ac.in',
        password='admin',
        full_name='System Admin',
        university_id='0000'
    )
else:
    print("Superuser already exists.")
EOF

# Collect static files
python manage.py collectstatic --noinput

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

echo "--- Automatic Data Import Complete ---"
# --- END DATA IMPORT ---

# Execute the CMD passed in Dockerfile/compose
exec "$@"
