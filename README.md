# Exam Evaluation System (Exam_E)

> **Quick Start**: Go to [SETUP_AND_RUN.md](docs/SETUP_AND_RUN.md) for first-boot instructions.

> **Acceleration Tip**: You can export a DB snapshot and auto-load it on boot (`export_db_snapshot.sh` or `export_db_snapshot.ps1`). See the "Database Snapshot Export + Auto-Load" section in [SETUP_AND_RUN.md](docs/SETUP_AND_RUN.md).

---

## 1. System Overview

Exam_E is a university-grade examination paper evaluation, digitization, and grievance review platform. It provides specialized, role-based workspaces for Students, Faculty (Evaluators and Course Coordinators), and Examination Controllers, backed by an automated Django administration control plane. The platform is engineered for high concurrency, academic data integrity, and strict access controls over digitized answer sheets and grading workflows.

---

## 2. Technology Stack

| Layer | Technology | Role in System |
| :--- | :--- | :--- |
| **Backend** | Python 3 / Django 4.2+ | Core ORM, business logic, and administrative control plane for academic entities. |
| **API Layer** | Django REST Framework (DRF) + SimpleJWT | RESTful endpoints, serializer validation, token rotation, and role-based permissions (RBAC). |
| **Frontend** | React 18 / TypeScript / Vite / Tailwind CSS | Single-page application with responsive layouts and runtime adaptive routing for desktop and mobile views. |
| **Database** | PostgreSQL | Relational database enforcing strict integrity across schools, courses, allocations, enrollments, papers, marks, and grievances. |
| **Reverse Proxy** | Nginx | Reverse proxy handling public traffic and serving digitized paper scans securely via internal `X-Accel-Redirect` gateways. |
| **Task Queue & Cache** | Celery + Redis | Asynchronous background email delivery and account-based brute force protection tracking. |

---

## 3. Architecture (Single Machine / Local Network)

Entry Point: http://localhost (Nginx reverse proxy).

Current development access:

- `http://localhost` (recommended via nginx)
- `http://<your-lan-ip>` from hotspot/LAN devices in DEBUG mode

### Reverse Proxy (Nginx - Port 80)

- **Rule A: Protected Assets** -> Routed through authenticated backend gateway with `X-Accel-Redirect` internal locations.
- **Rule B: API Requests (`/api/*`)** -> Proxy to Backend (Port 8000).
- **Rule C: Frontend Requests (`/`)** -> Proxy to Frontend (Port 8080).

### Backend Application (Django/Gunicorn)

Runs via `python manage.py runserver` in dev. Handles logic, auth, and DB queries.

### Frontend Runtime Routing

- Desktop and mobile views share route paths, and `App.tsx` selects mobile page variants at runtime based on user-agent + touch heuristics.
- Mobile-specific pages currently include login, student/faculty dashboards, grievance page, statistics pages, and evaluator view.

### Database (PostgreSQL)

- **Internal**: `db:5432` (Accessed by Django).
- **External**: `localhost:5433` (Exposed for debugging tools like DBeaver).
- **Persistence**: Data stored in `postgres_data` volume.

### Background Task Queue (Celery Worker)

Asynchronous worker process handling background credential dispatch, notifications, and scheduled queue maintenance via Redis.

---

## 4. Core System Features

### Paper Evaluation Workspace

- **Evaluation Viewer**: Full-screen workstation with custom canvas annotation tools (pen, eraser, stroke reset, rotation, and resizable layout panels).
- **Granular Scoring**: Multi-section question grid validating awarded marks against expected schema maximums with real-time score calculation.
- **Reference Material Sidecar**: Live side-by-side inspection of official question papers and answer keys alongside the student's script.
- **Protected Delivery**: Paper scans are never bundled as bulk client downloads; single pages are streamed individually through authenticated endpoints.

### Grievance Review & Resolution

- **Student Submissions**: Students can inspect evaluated scripts and register grievances (categorized as Page Missing, Full Sheet Missing, or General evaluation challenges).
- **Faculty Review**: Assigned teachers and course coordinators review student remarks, verify submitted markings against digitized sheets, and record formal decisions (Accept/Reject) with optional score adjustments.

### Mass Credential Management

- **Bulk Credential Generation**: System administrators can batch-generate randomized credentials filtered by school, stream, semester, or section.
- **Asynchronous Delivery**: Credentials are queued in Redis and delivered via Celery background mail workers.

---

## 5. Admin & Analytics

### Statistics Dashboard

A custom Django Admin dashboard (`/admin/stats/`) provides real-time statistics:

- **Grievance Analytics**: Visualize complaints per course/section.
- **Score Distribution**: Histograms of student performance.
- **Drill-down**: Click on charts to view specific students and their exam papers.

### Interactive Exam Schema Builder

An interactive schema builder widget embedded in the Django Admin form allows administrators to structure exams (sections, questions, and sub-parts with designated mark allocations) that automatically compiles into the validation JSON schema used by the evaluation viewer.

### Bulk Password Management

A dedicated tool in the admin panel to filter students by school, stream, section, or semester and generate credentials in bulk.

### Media Auto-Import for Testing

On startup, the backend auto-links exam assets from `backend/mediafiles`:

- Student answer pages from `backend/mediafiles/papers/<ROLLNO>_<COURSECODE>/...`
- Question papers and answer keys from `backend/mediafiles/exam_docs/`

---

## 6. Authentication, Authorization & Security

For comprehensive documentation on authentication, role-based access control, and security implementation, see **[AUTHENTICATION.md](docs/AUTHENTICATION.md)**.

### Quick Reference

#### Authentication

- Users authenticate with email + password via `POST /api/auth/login/`
- JWT tokens stored in secure HttpOnly cookies (HTTPS-only in production)
- 15-minute access token TTL + 1-day refresh token TTL
- Automatic token rotation with blacklisting on logout

#### Smart Security (University Network Safe)

- Failed login attempts tracked **per-username** (not per-IP) using Redis cache
- Account lockout after 10 consecutive failed attempts (15-minute lockout)
- Progressive delays (2s → 5s → 10s) after 3 failed attempts to slow brute-force attacks
- Locked accounts return **HTTP 403** (invalid credentials remain **HTTP 401**)
- Works reliably in campus networks and NAT environments (no legitimate user blocking)
- Handles 5000+ concurrent users without IP-based collisions

#### Authorization

- Three roles: STUDENT, TEACHER, CONTROLLER
- Role-based API access control via permission classes (IsStudent, IsTeacher, IsController)
- Course-level authorization for statistics and grading
- System Admins (is_staff + is_superuser) access Django Admin panel only

---

## 7. Admin Panel Operations

The Django admin (`http://localhost/admin/`) is the central control hub for the system. It handles:

### User Management

- Full CRUD for Students, Teachers, and System Administrators.
- **Single-click Credential Generation**: Select users and choose "Generate & Email selected credentials" from the actions menu.

### Bulk Password Management Tool

- Located on the Admin Dashboard > "Bulk Password Management".
- Allows bulk password generation for students filtered by School, Stream, Section, or Semester.
- Integrated with Celery for background email delivery.

### Academic Setup & Media Seeding

- Automated CSV imports via `docker/backend/entrypoint.sh` using `Data/test_data/`.
- Automatic media seeding from `Data/Papers` via `python manage.py seed_media_from_data --pages-per-paper 5`.
- Automatic media linking via `python manage.py import_exam_media --overwrite-existing`.
- Course coordinator is a real faculty capability, assigned by linking a teacher to `Course.coordinator`.

### Stats Dashboard

- Real-time evaluation progress, grievance analytics, and score distribution.

> **Note**: The Admin Panel is for System Administrators only. Students & Teachers use the React Frontend (`http://localhost/`).

---

## 8. Background Email & Tasks (Celery)

System-wide notifications (password generation, grievance updates) are handled asynchronously.

- **Dev**: Emails are printed to the docker logs (`docker compose logs backend`).
- **Production**: Configure `EMAIL_BACKEND` (SMTP) via environment variables.

---

## 9. First-Time Setup & Initialization

> [!NOTE]
> The system is in debug/demo mode for the purposes of demonstartion out of the box. There is some pre-seeded data to assist with development and are provided as samples. Kindly do not treat the system in it's current state as a ready-made deployable version, and clean out the database and seeded data if you plan to use it. The **seeded data** is not meant to be redistributed and **is NOT covered by the opensource licenses** that this project may be distributed under, and is strictly not to be used for any purposes other than the demonstration of this system.

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
   - **Test Student**: id = `2305101@kiit.ac.in` / `Check@123` (generate more from the admin dashboard)
   - **Test Teacher**: `kavita.mishra@example.com` / `Check@123` (generate more from the admin dashboard)


For detailed authentication information, see [AUTHENTICATION.md](docs/AUTHENTICATION.md).

---

## Documentation Index

Comprehensive guides and architectural documentation are available in the [`docs/`](docs/) directory:

- [Development Setup & First Boot Guide](docs/SETUP_AND_RUN.md)
- [Authentication & Access Control Architecture](docs/AUTHENTICATION.md)
- [REST API Documentation](docs/API_DOCS.md)
- [Database Entry & Workflows](docs/database_entry.md)
- [Database Schema Reference](docs/database_schema.md)
