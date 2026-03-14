# 🎓 Exam Evaluation System (Exam_E)

> **Quick Start**: Go to [SETUP_AND_RUN.md](SETUP_AND_RUN.md) for first-boot instructions.
> **Status**: Active Development. See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for the latest changelog (March 6, 2026).

## 1. The Core Philosophy

"Optimize for Speed & Security, Not Raw Compute." Since you are a small team with a hard deadline, choose tools that handle the heavy lifting (Admin panels, Auth, Security) for you. Do not reinvent the wheel.


# 2. The Recommended Stack

| Component   | Choice             | Why for your team?                                                                 |
|-------------|--------------------|------------------------------------------------------------------------------------|
| Backend     | Python (Django)    | The built-in Admin Interface saves ~30% of dev time. It handles the "System Admin" roles (data ingress, user management) out-of-the-box. |
| API Layer   | Django Ninja/DRF   | It uses Type Hints (Standard Python 3.6+). It validates data strictness like Java but writes as fast as Python. Highly performant. |
| Frontend    | React (TypeScript) | Essential for the complex "Paper Checking" UI and the "Controller Dashboard". TypeScript prevents runtime bugs. |
| Database    | PostgreSQL         | The industry standard. Handles concurrent writes/reads better than MySQL. Essential for the complex "random allocation" queries. |
| Web Server  | Nginx              | CRITICAL. It serves the heavy static images (scanned papers) and protects the slower Python backend from the 5,000 concurrent connections. |
| Task Queue  | Celery + Redis     | Handles the "Mass Mailing" and "Auto-Distribution" scripts in the background without freezing the student's UI. |


# 3. The Architecture (Single Machine / Local Network)

Entry Point: http://localhost (Nginx reverse proxy).

Nginx (Port 80):

Rule A: Request for `/Data/*` (e.g., Papers) -> Served directly from disk (Alias to `/app/Data`).

Rule B: Request for `/api/*` -> Proxy to Backend (Port 8000).

Rule C: Request for `/` -> Proxy to Frontend (Port 8080).

Application (Django/Gunicorn): Runs via `python manage.py runserver` in dev. Handles logic, auth, and DB queries.

Database (Postgres): 
- **Internal**: `db:5432` (Accessed by Django).
- **External**: `localhost:5433` (Exposed for debugging tools like DBeaver).
- **Persistence**: Data stored in `postgres_data` volume.

Celery Worker: A separate background process that wakes up to send emails or shuffle grievances.


# 4. Implementation Strategy by Feature

Auth & Security:

Use Django Allauth or built-in Auth.

JWT (JSON Web Tokens) for stateless student login.

Rotation: A simple Python script that generates random strings, hashes them with bcrypt, and updates the User table.

Paper Evaluation:

Frontend: React loads the JPG. Use a library like react-zoom-pan-pinch.

Data: Teachers submit "Marks" and "Comments". These are JSON payloads sent to Django.

Constraint: Do not let teachers "download" the whole bundle. Stream images one by one.

Grievance System:

Submission: Student flags a question index.

Distribution: A nightly Celery task queries all Grievance objects with status='OPEN' and randomly assigns them to a Teacher in the Subject pool.

Mass Mailing (Credentials):

Trigger: System Administrator (via Django Admin Panel) selects Students/Teachers and clicks "Generate & Email selected credentials".

Action: Django adds tasks to Redis. Celery workers pick them up one by one and talk to the configured SMTP server (or print to console in dev).


# 5. Admin & Analytics

**Dashboard**: A custom Django Admin dashboard (`/admin/stats/`) provides real-time statistics:
- **Grievance Analytics**: Visualize complaints per course/section.
- **Score Distribution**: Histograms of student performance.
- **Drill-down**: Click on charts to view specific students and their exam papers.

**Exam Builder**: A visual drag-and-drop interface within the Admin panel allows System admin to define complex exam structures (Sections, Questions, Parts) without writing raw JSON.

**Bulk Password Management**: A dedicated tool in the admin panel to filter students by school, stream, section, or semester and generate credentials in bulk.

**Media Auto-Import for Testing**: On startup, the backend auto-links exam assets from `backend/mediafiles`:
- Student answer pages from `backend/mediafiles/papers/<ROLLNO>_<COURSECODE>/...`
- Question papers and answer keys from `backend/mediafiles/exam_docs/`


# 6. Authentication, Authorization & Security

For comprehensive documentation on authentication, role-based access control, and security implementation, see **[AUTHENTICATION.md](AUTHENTICATION.md)**.

**Quick Reference**:
- Users authenticate with email + password
- JWT tokens stored in secure HttpOnly cookies
- Three roles: STUDENT, TEACHER, CONTROLLER
- Role-based API access control via permission classes
- Course-level authorization for statistics and grading

---

## Admin Panel

The Django admin (`http://localhost/admin/`) is the central control hub for the system. It handles:

- **User Management**:
  - Full CRUD for Students, Teachers, and System Administrators.
  - **Single-click Credential Generation**: Select users and choose "Generate & Email selected credentials" from the actions menu.
- **Bulk Password Management Tool**:
  - Located on the Admin Dashboard > "Bulk Password Management".
  - Allows bulk password generation for students filtered by School, Stream, Section, or Semester.
  - Integrated with Celery for background email delivery.
- **Academic Setup**:
  - Automated CSV imports via `docker/backend/entrypoint.sh` using `Data/test_data/`.
  - Automatic media linking via `python manage.py import_exam_media --overwrite-existing`.
  - Course coordinator is a real faculty capability, assigned by linking a teacher to `Course.coordinator`.
- **Stats Dashboard**:
  - Real-time evaluation progress, grievance analytics, and score distribution.

> **Note**: The Admin Panel is for System Administrators only. Students & Teachers use the React Frontend (`http://localhost/`).

## Background Email (Celery)

System-wide notifications (password generation, grievance updates) are handled asynchronously.

- **Dev**: Emails are printed to the docker logs (`docker compose logs backend`).
- **Production**: Configure `EMAIL_BACKEND` (SMTP) via environment variables.

## First-Time Setup & Initialization

The system is fully automated on startup.

1. **Clean Start**: To reset everything (schema, data, and users):
   ```bash
   cd docker
   docker compose down -v
   ```

2. **Build and Start**:
   ```bash
   docker compose up --build
   ```

   Wait for the terminal to show "Automatic Data Import Complete".

3. **Access the Application**:
   - **Student/Teacher Portal**: http://localhost
   - **Admin Panel**: http://localhost/admin/

4. **Default Credentials**:
   - **Admin**: `admin@kiit.ac.in` / `admin`
   - **Test Students**: Check [Data/test_data/1_students.csv](Data/test_data/1_students.csv) (Roll numbers are login IDs)
   - **Test Teachers**: Check [Data/test_data/2_teachers.csv](Data/test_data/2_teachers.csv) (Emp IDs are login IDs)

For detailed authentication information, see [AUTHENTICATION.md](AUTHENTICATION.md).

---

