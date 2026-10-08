# Development Setup & First Boot

Follow this guide to set up the backend, frontend, and database environments.

---

## 1. Prerequisites

- **Docker Desktop** (Running)
- **Git**
- **DBeaver** or **PgAdmin** (Optional, for direct database inspection)

---

## 2. Initial Setup

To configure and run the full stack for the first time:

### Step 1: Navigate to the Docker Directory

The container stack configuration lives in the `docker/` directory:

```bash
cd docker
```

### Step 2: Build and Start the Stack

This command builds the Python (Backend) and Node (Frontend) container images and initializes the services:

```bash
docker compose up --build -d
```

> **Note**: Initial image builds may take several minutes depending on network download speeds.

### Step 3: Verify Running Services

```bash
docker compose ps
```

All core services (`backend`, `frontend`, `db`, `nginx`, `redis`, and `celery`) should report status `Up`.

---

## 3. Resetting the Database

To reset the database and re-run all initialization scripts from scratch:

```bash
# 1. Stop containers and remove persistent volumes
docker compose down -v

# 2. Rebuild and restart (triggers automated bootstrap import on boot)
docker compose up --build -d
```

---

## 4. Database Initialization & Default Credentials

### Automated Initialization

On initial database creation:
- **Database Schema**: Initialized from `docker/init_db.sql`.
- **Migrations**: Applies all Django database migrations.
- **Superuser**: Provisioned automatically.
- **Academic Data**: Imports Schools, Teachers, and Courses from `Data/` CSV files.
- **Student Data**: Imports Students and Enrollments from `Data/` CSV files.
- **Exam Media Linking**: Scans `backend/mediafiles/papers` and `backend/mediafiles/exam_docs` and links:
  - Paper page assets to `ExamPaper.pages` using `ROLLNO_COURSECODE` folder conventions.
  - Question papers and answer key paths to their respective exam definitions.

### Default Superuser Credentials (SYSTEM ADMIN)

| Attribute | Value |
| :--- | :--- |
| **Email** | `admin@kiit.ac.in` |
| **Password** | `admin` |
| **University ID** | `0000` |

### Default Student Credentials (TEST DATA)

Students imported from sample CSV files:
- **Email**: Derived from CSV (e.g., `rollno@kiit.ac.in`).
- **Password**: `Check@123`
- **Roll No**: As per CSV (e.g., `2305101`).

---

## 5. Manual Administration & Service Access

### Manual Administrative Commands

```bash
# Create an additional superuser interactively
docker compose exec backend python manage.py createsuperuser

# Re-link exam media files
docker compose exec backend python manage.py import_exam_media --overwrite-existing

# Seed additional test media from Data directory and link
docker compose exec backend python manage.py seed_media_from_data --pages-per-paper 5 --assign-missing-teachers --overwrite-existing
```

### Service Access Endpoints

| System | URL | Description |
| :--- | :--- | :--- |
| **Admin Panel** | [http://localhost/admin](http://localhost/admin) | Django Administration (via Nginx reverse proxy). Direct access at `http://localhost:8000/admin`. |
| **Frontend Application** | [http://localhost](http://localhost) | Portal application via Nginx reverse proxy. Development frontend server runs at `http://localhost:8080`. |
| **API Documentation** | [API_DOCS.md](API_DOCS.md) | REST API specification. |
| **Database Direct Port** | `localhost:5433` | Direct PostgreSQL port for external tools. |

### Local Network Access (DEBUG Mode)

- In `DEBUG` mode, the backend allows local network access for testing across handheld devices.
- The frontend asset resolver resolves relative media URLs to the current host, allowing mobile devices on the same LAN to load paper images and documents.

---

## 6. Database Snapshot Export & Restore

To share initialized database states across development machines without re-running CSV imports:

### Export Snapshot

From the `docker/` directory:

```bash
# Linux / macOS
sh export_db_snapshot.sh

# Windows PowerShell
.\export_db_snapshot.ps1
```

Snapshots are written to:
```text
Data/db_snapshots/exam_e_snapshot.sql
```

A custom destination path can be specified:
```bash
sh export_db_snapshot.sh ../Data/db_snapshots/custom_snapshot.sql
```

### Automatic Snapshot Restore on Startup

The backend entrypoint checks for `Data/db_snapshots/exam_e_snapshot.sql` on startup:
- **If present**: Restores the SQL dump directly into PostgreSQL, runs pending migrations, and bypasses CSV bootstrap scripts.
- **If absent**: Executes standard CSV bootstrap import routines.

---

## 7. Connecting to the Database (DBeaver / PgAdmin)

To connect an external database client:

- **Host**: `localhost`
- **Port**: `5433` (Mapped from container port 5432 to avoid local port conflicts)
- **Database**: `exam_e`
- **Username**: `postgres`
- **Password**: `postgres`

---

## 8. Selective Component Startup

During active development, individual services can be started independently:

| Scope | Command | Purpose |
| :--- | :--- | :--- |
| **Backend Stack** | `docker compose up db redis backend celery` | Backend API and background task development without frontend build. |
| **Frontend Only** | `docker compose up frontend` | UI development against an already running or mocked backend. |
| **Database Only** | `docker compose up db -d` | Direct database inspection without application processes. |
