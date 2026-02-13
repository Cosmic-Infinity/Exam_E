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
docker exec -i docker-db-1 psql -U postgres -d university_exam_system < init_db.sql
4. Connect via DBeaver
Host: localhost

Port: 5433

Database: university_exam_system

User/Pass: postgres / postgres

Note: We are using port 5433 to avoid conflicts with any local Postgres installations.

🏁 Final Summary of Your Progress
Schema: 11 normalized tables covering Schools, Streams, Users, Enrollments, and Exams.

Logic: Role-Based Access Control (RBAC) via the role column and Session-based course mapping.

Integrity: 33 active constraints (Primary Keys, Foreign Keys, and Unique checks).

Persistence: Docker volumes are configured so your data stays safe even if containers restart.
