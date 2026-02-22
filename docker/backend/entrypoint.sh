#!/bin/sh

# Wait for database
echo "Waiting for postgres..."
while ! nc -z db 5432; do
  sleep 1
done
echo "PostgreSQL started"

# Run migrations
python manage.py migrate --noinput

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

# --- AUTOMATIC DATA IMPORT ---
echo "--- Starting post-migration data check/import ---"

# Step 1: Base Data (Schools, Streams, Teachers, Courses)
# These scripts use environment variables for DB config and handle existing data gracefully.
python scripts/import_academic_data.py --founders Data/schools_streams.csv
python scripts/import_academic_data.py --teachers Data/teachers.csv
python scripts/import_academic_data.py --courses Data/courses.csv
python scripts/import_academic_data.py --allocations Data/allocations.csv

# Step 2: Students (Batch files)
for f in Data/2301.csv Data/2302.csv Data/2303.csv Data/2304.csv Data/2305.csv; do
    if [ -f "$f" ]; then
        python scripts/import_students.py "$f"
    fi
done

# Step 3: Enrollments (Depends on Students and Allocations)
python scripts/bulk_enroll.py --csv Data/enrollments.csv --session "Spring 2026"

echo "--- Automatic Data Import Complete ---"
# --- END DATA IMPORT ---

# Execute the CMD passed in Dockerfile/compose
exec "$@"
