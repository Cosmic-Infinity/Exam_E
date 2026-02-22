# 🎓 Exam Evaluation System (Exam_E)

> **Quick Start**: Go to [SETUP_AND_RUN.md](SETUP_AND_RUN.md) for first-boot instructions.

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

Entry Point: https://paper-portal.uni.edu (Resolved internally).

Nginx (Port 443):

Rule A: Request for /static/papers/student_1.jpg -> Serve directly from disk. (Zero Python involvement).

Rule B: Request for /api/login -> Forward to Gunicorn (Port 8000).

Application (Django/Gunicorn): Runs 9-10 worker processes. Handles logic, auth, and DB queries.

Database (Postgres): Runs on Port 5433 (Blocked from outside). Accessible only by Django.

Celery Worker: A separate background process that wakes up to send emails or shuffle grievances.


# 4. Implementation Strategy by Feature

Auth & Security:

Use Django Allauth or built-in Auth.

JWT (JSON Web Tokens) for stateless student login.

Rotation: A simple Python script that generates random strings, hashes them with bcrypt, and updates the User table.

Paper Evaluation (The Hard Part):

Frontend: React loads the JPG. Use a library like react-zoom-pan-pinch.

Data: Teachers submit "Marks" and "Comments". These are JSON payloads sent to Django.

Constraint: Do not let teachers "download" the whole bundle. Stream images one by one.

Grievance System:

Submission: Student flags a question index.

Distribution: A nightly Celery task queries all Grievance objects with status='OPEN' and randomly assigns them to a Teacher in the Subject pool.

Mass Mailing:

Trigger: Coordinator clicks "Send Passwords" in Admin Panel.

Action: Django adds 5,000 tasks to Redis. Celery workers pick them up one by one and talk to the Google Workspace SMTP server.


# 5. Admin & Analytics

**Dashboard**: A custom Django Admin dashboard (`/admin/stats/`) provides real-time statistics:
- **Grievance Analytics**: Visualize complaints per course/section.
- **Score Distribution**: Histograms of student performance.
- **Drill-down**: Click on charts to view specific students and their exam papers.

**Exam Builder**: A visual drag-and-drop interface within the Admin panel allows Coordinators to define complex exam structures (Sections, Questions, Parts) without writing raw JSON.


# 6. Authentication — Current Implementation

## How It Works

Users log in with their **university ID + password** (not email). On successful login, two secure HttpOnly cookies are set — an access token (15 min) and a refresh token (1 day). The React frontend never sees the raw tokens; they travel only via cookies.

```
POST /api/auth/login/         → sets access_token + refresh_token cookies
POST /api/auth/logout/        → blacklists refresh token, clears cookies
POST /api/auth/refresh/       → issues a new access_token from the refresh cookie
POST /api/auth/password/change/ → change password (logged-in users only)
GET  /api/me/                 → returns logged-in user's profile
POST /api/token/              → header-based JWT login (Postman / mobile)
POST /api/token/refresh/      → header-based token refresh
```

## Roles

Every user has one of three roles. Each API view can be locked to a role using a permission class:

| Role | Permission class | Access |
|---|---|---|
| `COORDINATOR` | `IsCoordinator` | System Admin access (User management, Config) |
| `CONTROLLER` | `IsController` | Global statistics view + Teacher capabilities |
| `TEACHER` | `IsTeacher` | Teaching-related views |
| `STUDENT` | `IsStudent` | Student-facing views |
| COORDINATOR or TEACHER | `IsCoordOrTeacher` | Combined |

*(Note: System Administrators are superusers with full access but do not use a specific 'ADMIN' role application-side.)*

## Token Details

| Setting | Value |
|---|---|
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 1 day |
| Token rotation | Enabled — old refresh token is blacklisted on every refresh |
| Storage | HttpOnly cookies (not localStorage) |
| Custom claims in payload | `university_id`, `full_name`, `role` |

## Security Settings

| Setting | Dev | Production |
|---|---|---|
| `SECRET_KEY` | Set via env var — app refuses to start without it | Same |
| `DEBUG` | `DEBUG=1` via docker-compose | `DEBUG=0` |
| `COOKIE_SECURE` | `0` (HTTP) | `1` (HTTPS only) |
| `HTTPS redirect` | Off | On (`SECURE_SSL_REDIRECT`) |
| `HSTS` | Off | 1 year, subdomains + preload |
| `CORS` | `http://localhost:3000` | Set via `CORS_ALLOWED_ORIGINS` env var |
| Login rate limit | 5 attempts / minute / IP | Same |

## Admin Panel

The Django admin (`/admin/`) is the central control hub for the system. It handles:

- **User Management**:
  - Full CRUD for Students, Teachers, and Staff.
  - Role management and custom permissions.
  - Password generation & credential distribution.
- **Bulk Password Management Tool**:
  - Located on the Admin Dashboard.
  - Allows bulk password generation for students filtered by School, Stream, Section, or Semester.
  - Integrated with Celery for background email delivery.
- **Academic Setup**:
  - Automated CSV imports via the Data Import tool or startup scripts.
  - Coordination logic: Assigning teachers to manage courses via the **Teachers** admin interface.
- **Stats Dashboard**:
  - Real-time evaluation progress, grievance analytics, and score distribution.

> **Note**: The Admin Panel is exposed only for administration. The main application (Paper Checking, Grievances, etc.) runs in the React Frontend as separate portals for Students, Teachers, and Controllers.

## Background Email (Celery)

System-wide notifications (password generation, grievance updates) are handled asynchronoulsy by Celery workers + Redis.

- **Dev**: Emails print to the terminal (Console Backend).
- **Production**: Configure `EMAIL_BACKEND` (SMTP) via environment variables.

## First-Time Setup (Nuke & Boot)

The system is now **fully automated**. 

1. **Clean Start**: To reset everything (schema, data, and users):
   ```bash
   docker compose down -v
   ```
2. **Build and Start**:
   ```bash
   docker compose up --build
   ```

Wait for the terminal to finish the import logs. You can then log in to the admin panel with:
- **Email**: `admin@kiit.ac.in`
- **Password**: `admin`

---

## What Is NOT Done Yet

| Missing feature | Notes |
|---|---|
| **Logout from all devices** | Logout currently only invalidates the current session's refresh token |
| **React frontend auth** | Auth context, protected routes, and silent refresh logic are currently being integrated |

