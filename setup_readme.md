# 🎓 Exam Evaluation System - Docker Guide

This project uses Docker Compose to orchestrate the Backend (Django), Frontend (React), Database (PostgreSQL), Cache (Redis), and Web Server (Nginx).

---

## 🚀 Service Names
When running selective commands, use these names:
- `db`
- `redis`
- `backend`
- `celery`
- `frontend`
- `nginx`

---

## 🛠 Command Combinations

### 1. The "Start Everything" (Standard)
```bash
# Build and start all services in the foreground
docker compose up --build

# Start everything in the background (detached)
docker compose up -d
2. Selective Starting (Your Current Focus)
Bash
# Run ONLY the database (to make entries/migrations)
docker compose up db -d

# Run Database and Backend (skip frontend/nginx)
docker compose up db backend

# Run Frontend only (for UI work)
docker compose up frontend
3. Maintenance & Cleanup
Bash
# Stop and remove all containers
docker compose down

# Stop everything AND delete volumes (WIPE THE DATABASE)
docker compose down -v

# View logs for a specific service
docker compose logs -f backend
4. Database Access
Bash
# Enter the Postgres shell inside the container
docker exec -it docker-db-1 psql -U postgres -d exam_e
📂 File Structure Requirements
For the builds to succeed, ensure the following exists:

./backend/manage.py

./frontend/public/index.html

./frontend/package.json



Persistence: Since your docker-compose.yml uses a named volume (postgres_data), you can run docker compose down and your database entries will not be lost. They only disappear if you run docker compose down -v.

The "Partial" Build: If you only change a file in the frontend, you don't need to rebuild the whole stack. Just run:
docker compose build frontend

Shell Access: If the backend isn't starting because of a missing dependency, you can "sneak" into it to see what's wrong:
docker compose run --rm backend sh
