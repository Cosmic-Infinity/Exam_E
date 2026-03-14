# 🚀 Development Setup & First Boot

Follow this guide to setting up the backend, frontend, and database for the first time.

---

## 1. Prerequisites

- **Docker Desktop** (Running)
- **Git**
- **DBeaver** (Optional, for database visualization)

---

## 2. Initial Setup (The "Nuke & Boot")

If you are setting this up for the first time or want a fresh start, follow these steps.

### Step 1: Navigate to the Docker Directory

The entire stack configuration lives in the `docker/` folder.

```bash
cd docker
```

### Step 2: Build and Start the Stack

This command builds the Python (Backend) and Node (Frontend) images and starts the database.

```bash
docker compose up --build -d
```

> **Note**: The first build may take 5-10 minutes.

### Step 4: Verify Running Services

```bash
docker compose ps
```

You should see `backend`, `frontend`, `db`, `nginx`, `redis`, and `celery` all with status `Up`.

---

## 3. Resetting the System (The "Nuclear Option")

To wipe the database and start fresh with the latest CSV/PDF data:

```bash
# 1. Stop all containers and remove volumes (DELETES DB DATA)
docker compose -f docker/docker-compose.yml down -v

# 2. Rebuild and Start (Will auto-run all import scripts on boot)
docker compose -f docker/docker-compose.yml up --build -d
```

---

## 4. Database Initialization

### Automatic Setup (The "Zero-Touch" Boot)

Automatically on the first boot:
- **Database Schema**: Imported from `docker/init_db.sql`.
- **Migrations**: Automatic execution of Django migrations.
- **Superuser**: Created automatically (Credentials below).
- **Academic Data**: Imports Schools, Teachers, Courses from `Data/` CSVs.
- **Student Data**: Imports Students & Enrollments from `Data/` CSVs. 
- **Exam Media Linking**: Scans `backend/mediafiles/papers` and `backend/mediafiles/exam_docs` and auto-links:
	- paper pages to `ExamPaper.pages` using `ROLLNO_COURSECODE` folder names,
	- question paper and answer key paths to exams.

### Default Superuser Credentials (SYSTEM ADMIN)


| Attribute | Value |
| :--- | :--- |
| **Email** | `admin@kiit.ac.in` |
| **Password** | `admin` |
| **University ID** | `0000` |

### Default Student Credentials (TEST DATA)
The system imports students from CSVs (e.g., `2305.csv`).
- **Email**: Derived from CSV (usually `rollno@kiit.ac.in`).
- **Password**: `password` (Hardcoded for all imported students).
- **Roll No**: As per CSV (e.g., `2305101`).

> **⚠️ Note on Email Configuration**: This email address can be changed in [docker/backend/entrypoint.sh](docker/backend/entrypoint.sh) if needed for mail service API testing or production setup. The email must match your **mail service provider's authenticated sender address** when configuring `EMAIL_HOST_USER` in the environment variables.

---

## 4. Manual Administration

While the system is automated, you can manually trigger commands if needed.

### Creating a Manual Superuser
If you need an additional admin:
```bash
docker compose exec backend python manage.py createsuperuser
```

### Manual Media Re-Link (if files changed)
```bash
docker compose exec backend python manage.py import_exam_media --overwrite-existing
```

### Accessing the System

| System          | URL                                                              | Description                                        |
| :-------------- | :--------------------------------------------------------------- | :------------------------------------------------- |
| **Admin Panel** | [http://localhost:8000/admin](http://localhost:8000/admin)       | **System Admin Only**. Data Entry & User Management. |
| **API Docs**    | See `API_DOCS.md` file                                           | Backend API Documentation (No live Swagger UI yet) |
| **Frontend**    | [http://localhost:8080](http://localhost:8080)                   | **Main App**. Student/Teacher/Portal.              |
| **Database**    | `localhost:5433`                                                 | Direct SQL Access (Use DBeaver/PgAdmin, not browser) |

---

## 5. Connecting to the Database (DBeaver/PgAdmin)

To inspect the raw data or debug queries:

- **Host**: `localhost`
- **Port**: `5433` (Mapped from internal 5432 to avoid conflicts)
- **Database**: `exam_e`
- **Username**: `postgres`
- **Password**: `postgres`

> **Why Port 5433?** We use port 5433 for the host machine to avoid clashing with any local Postgres instance you might already have running.

---

## 6. Advanced: Selective Component Startup

Once the initial setup is complete (and the database volume is initialized), you often don't need to run the entire stack. You can start specific services to save resources.

| Goal              | Command                                     | Why?                                                             |
| :---------------- | :------------------------------------------ | :--------------------------------------------------------------- |
| **Backend Only**  | `docker compose up db redis backend celery` | Develop API endpoints without running the Frontend/React server. |
| **Frontend Only** | `docker compose up frontend`                | UI work (assuming the backend is already running or mocked).     |
| **Database Only** | `docker compose up db -d`                   | Inspect data in DBeaver without running any application logic.   |

> **Service Names**: The valid service names defined in `docker-compose.yml` are: `db`, `redis`, `backend`, `celery`, `frontend`, `nginx`.

---

## 7. How to "Nuke" and Reset

If you need to wipe the database and start fresh (e.g., to re-test the import flow):

```bash
# 1. Stop containers and DELETE volumes (This destroys all data)
docker compose down -v

# 2. Restart (Schema will be re-imported auto-magically)
docker compose up -d

# 3. Re-create the superuser (Step 3 above)
```
