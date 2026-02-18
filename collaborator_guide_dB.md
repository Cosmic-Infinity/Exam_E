🛠 Collaborator Guide: Getting Started
Follow these steps to sync your local environment with the latest database schema.

1. Prerequisite
Ensure you have Docker Desktop running and DBeaver installed for visualization.

2. Launch the Stack
Bash
# Pull the latest changes
git pull origin main

# Build and start the containers
docker compose up -d
3. Initialize the Database
Since the schema is stored in init_db.sql, you need to import it into your local container:

Bash
docker exec -i docker-db-1 psql -U postgres -d exam_e < init_db.sql
4. Connect via DBeaver
Host: localhost

Port: 5433

Database: exam_e

User/Pass: postgres / postgres

Note: We are using port 5433 to avoid conflicts with any local Postgres installations.

5. Populate Initial Data
The database starts empty. Use the Python scripts to load the initial university structure.

Bash
# 1. Load Schools & Streams
python scripts/import_academic_data.py --founders Data/schools_streams.csv

# 2. Load Courses
python scripts/import_academic_data.py --courses Data/courses.csv

# 3. Load Teachers
python scripts/import_academic_data.py --teachers Data/teachers.csv

# 4. Enroll Students (Bulk)
python scripts/bulk_enroll.py --csv Data/enrollments.csv --session "Spring 2026"

🏁 Final Summary of Your Progress
Schema: 12 normalized tables covering Schools, Streams, Users, Enrollments, and Exams.

Logic: Role-Based Access Control (RBAC) via the role column and Session-based course mapping.

Integrity: 33 active constraints (Primary Keys, Foreign Keys, and Unique checks).

Persistence: Docker volumes are configured so your data stays safe even if containers restart.
