# 1. The Core Philosophy

"Optimize for Speed & Security, Not Raw Compute." Since you are a small team with a hard deadline, choose tools that handle the heavy lifting (Admin panels, Auth, Security) for you. Do not reinvent the wheel.


# 2. The Recommended Stack

| Component   | Choice             | Why for your team?                                                                 |
|-------------|--------------------|------------------------------------------------------------------------------------|
| Backend     | Python (Django)    | The built-in Admin Interface saves ~30% of dev time. It handles the "Coordinator" roles (viewing students, assigning papers) out-of-the-box. |
| API Layer   | Django Ninja       | It uses Type Hints (Standard Python 3.6+). It validates data strictness like Java but writes as fast as Python. Highly performant and async-capable. |
| Frontend    | React (TypeScript) | Essential for the complex "Paper Checking" UI. TypeScript prevents runtime bugs, keeping your "Core CS" strictness alive in the browser. |
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

