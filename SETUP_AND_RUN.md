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

### Step 3: Verify Running Services

```bash
docker compose ps
```

You should see `backend`, `frontend`, `db`, `nginx`, `redis`, and `celery` all with status `Up`.

---

## 3. Database Initialization

### Automatic Schema Import

The PostgreSQL database is configured to **automatically import** the schema from `docker/init_db.sql` on the very first boot.

- You **DO NOT** need to run any manual SQL scripts unless you are resetting an existing database without nuking the volume.

### Setting up the Admin User (Critical for First Boot)

The database starts empty (no users). You must create a "Superuser" to access the Admin Panel.

0. Migrate
   ```bash
   docker compose -f docker-compose.yml exec backend python manage.py migrate
   ```

1. Run the creation command inside the backend container:
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```
2. Follow the prompts:
   - **Username**: `admin` (or your preference)
   - **Email**: `admin@uni.edu`
   - **Password**: (Set a strong password)

---

## 4. Accessing the System

| System          | URL                                                              | Description                                        |
| :-------------- | :--------------------------------------------------------------- | :------------------------------------------------- |
| **Admin Panel** | [http://localhost:8000/admin](http://localhost:8000/admin)       | **System Admin Only**. Data Entry & User Management. |
| **API Docs**    | [http://localhost:8000/api/docs](http://localhost:8000/api/docs) | Backend Swagger/OpenAPI Documentation              |
| **Frontend**    | [http://localhost:3000](http://localhost:3000)                   | **Main App**. Student/Teacher/Controller Portals.  |
| **Database**    | `localhost:5433`                                                 | Direct SQL Access (See below)                      |

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
