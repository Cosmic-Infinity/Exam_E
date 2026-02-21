# 📡 Exam_E API Documentation

This document outlines the REST APIs exposed by the Django backend for consumption by the React frontend.

---

## 🔐 0. Role & Permission System

The application uses a **Hierarchical Role System**.

### User Roles (`User.role`)

1.  **`STUDENT`**: Can only access their own data, exams, and results.
2.  **`TEACHER`**: The base role for all faculty members.
    - **Core Functionality**: Can access assigned course allocations, upload marks, and resolve grievances for their sections.
    - **As Course Coordinator**: If a Teacher is linked to a `Course` (via the `coordinator` field), they gain **read-only access** to the Statistics Dashboard for that specific course.
3.  **`CONTROLLER`** (Controller of Examination):
    - **Superset of Teacher**: Has all the capabilities of a Teacher (can teach courses, grade papers).
    - **Global View**: Has global read-only access to the Statistics Dashboard for **all courses**.
4.  **`COORDINATOR`**: Legacy role for System Admins.

### Django Flags

- **`is_staff`**: Grants access to the **Django Admin Panel** (`/admin`).
  - **Teachers**: `False` by default. They use the React Teacher Portal.
  - **Controller**: `False` by default. They use the React Portal.
  - **System Admin**: `True`. Only for technical DB maintenance.

---

## 1. Authentication APIs

### `POST /api/auth/login/`

Authenticates a user and sets an `HttpOnly` cookie containing the JWT access and refresh tokens.

- **Input**:
  ```json
  {
    "email": "teacher@uni.edu",
    "password": "securepassword"
  }
  ```
- **Output (200 OK)**:
  ```json
  {
    "detail": "Successfully logged in."
  }
  ```

### `GET /api/me/`

Returns the profile information of the currently authenticated user.

- **Auth Required**: Yes
- **Output (200 OK)**:
  ```json
  {
    "id": 1,
    "university_id": "T-1001",
    "full_name": "Dr. John Doe",
    "email": "teacher@uni.edu",
    "role": "TEACHER",
    "is_active": true,
    "is_staff": false,
    "is_verified": true,
    "date_joined": "2026-02-20T12:00:00Z"
  }
  ```

---

## 2. Teacher Portal APIs

### `GET /api/teacher/allocations/`

Fetches a list of all active course sections assigned to the currently logged-in teacher. This is the data needed for the Teacher's "Home Screen".

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `COORDINATOR`
- **Input**: None (Uses the user's session/token)
- **Output (200 OK)**:
  ```json
  [
    {
      "allocation_id": 1,
      "course": {
        "course_code": "CS302",
        "title": "Database Management Systems",
        "credits": 4,
        "course_type": "CORE"
      },
      "section_name": "A",
      "semester": 5,
      "session": {
        "session_id": 1,
        "label": "2024-2025",
        "is_active": true
      }
    },
    {
      "allocation_id": 2,
      "course": {
        "course_code": "CS401",
        "title": "Artificial Intelligence",
        "credits": 4,
        "course_type": "PE"
      },
      "section_name": "B",
      "semester": 7,
      "session": {
        "session_id": 1,
        "label": "2024-2025",
        "is_active": true
      }
    }
  ]
  ```

### `GET /api/teacher/allocations/{allocation_id}/exams/`

Fetches a list of all exams (e.g., Midsem, Endsem) associated with a specific course allocation.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `COORDINATOR`
- **Input**: `allocation_id` (in the URL path)
- **Output (200 OK)**:
  ```json
  [
    {
      "exam_id": 1,
      "exam_type": "MIDSEM",
      "total_marks": 30,
      "passing_marks": 10,
      "is_active": true,
      "created_at": "2026-02-20T14:30:00Z"
    },
    {
      "exam_id": 2,
      "exam_type": "ENDSEM",
      "total_marks": 50,
      "passing_marks": 15,
      "is_active": true,
      "created_at": "2026-02-20T14:35:00Z"
    }
  ]
  ```

### `GET /api/teacher/papers/?exam_id={id}`

Fetches a lightweight list of all student papers for a specific exam. This is used to populate the grading list/table.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `COORDINATOR`
- **Input**: `exam_id` (as a query parameter)
- **Output (200 OK)**:
  ```json
  [
    {
      "paper_id": 101,
      "student_university_id": "2305128",
      "student_name": "Alice Smith",
      "total_score": null,
      "evaluation_status": "PENDING"
    },
    {
      "paper_id": 102,
      "student_university_id": "2305129",
      "student_name": "Bob Jones",
      "total_score": "28.50",
      "evaluation_status": "COMPLETED"
    }
  ]
  ```

### `GET /api/teacher/paper/{paper_id}/`

Fetches the full details of a specific paper, including the file path to the scanned image and the current marks JSON.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `COORDINATOR`
- **Input**: `paper_id` (in the URL path)
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "student_university_id": "2305128",
    "student_name": "Alice Smith",
    "file_path": "/static/papers/2305128_CS302/page1.jpg",
    "marks_json": null,
    "total_score": null,
    "evaluation_status": "PENDING",
    "question_paper_schema": [
      { "q_no": 1, "parts": [1, 1, 1, 1, 1] },
      { "q_no": 2, "parts": [2, 3] }
    ],
    "exam_total_marks": 30
  }
  ```

### `PUT /api/teacher/paper/{paper_id}/`

Updates the marks and evaluation status for a specific paper.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `COORDINATOR`
- **Input**:
  ```json
  {
    "marks_json": {
      "q1": { "p1": 1, "p2": 1, "p3": 0, "p4": 1, "p5": 1 },
      "q2": { "p1": 2, "p2": 2.5 }
    },
    "total_score": "8.50",
    "evaluation_status": "COMPLETED"
  }
  ```
- **Output (200 OK)**: Returns the updated paper object.

---

## 3. Student Portal APIs

### `GET /api/student/enrollments/`

Fetches a list of all courses the student is currently enrolled in for the active session.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Output (200 OK)**:
  ```json
  [
    {
      "enrollment_id": 1,
      "allocation": {
        "allocation_id": 1,
        "course": {
          "course_code": "CS302",
          "title": "Database Management Systems",
          "credits": 4,
          "course_type": "CORE"
        },
        "section_name": "A",
        "semester": 5,
        "teacher_name": "Dr. John Doe"
      },
      "enrollment_type": "REGULAR",
      "status": "ACTIVE"
    }
  ]
  ```

### `GET /api/student/papers/`

Fetches a list of all _graded and released_ papers for the logged-in student.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Output (200 OK)**:
  ```json
  [
    {
      "paper_id": 102,
      "exam": {
        "exam_id": 1,
        "exam_type": "MIDSEM",
        "total_marks": 30,
        "passing_marks": 10,
        "course_code": "CS302",
        "course_title": "Database Management Systems"
      },
      "total_score": "28.50",
      "evaluation_status": "COMPLETED"
    }
  ]
  ```

### `GET /api/student/paper/{paper_id}/`

Fetches the full details of a specific paper, including the scanned image URL and the marks JSON, so the student can review their grading.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Input**: `paper_id` (in the URL path)
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 102,
    "exam": {
      "exam_id": 1,
      "exam_type": "MIDSEM",
      "total_marks": 30,
      "passing_marks": 10,
      "course_code": "CS302",
      "course_title": "Database Management Systems"
    },
    "file_path": "/static/papers/2305129_CS302/page1.jpg",
    "marks_json": {
      "q1": { "p1": 1, "p2": 1, "p3": 0, "p4": 1, "p5": 1 },
      "q2": { "p1": 2, "p2": 2.5 }
    },
    "total_score": "28.50",
    "evaluation_status": "COMPLETED",
    "question_paper_schema": [
      { "q_no": 1, "parts": [1, 1, 1, 1, 1] },
      { "q_no": 2, "parts": [2, 3] }
    ]
  }
  ```

### `POST /api/student/grievance/`

Allows a student to raise a grievance (re-evaluation request) for a specific paper.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Input**:
  ```json
  {
    "paper": 102,
    "student_comment": "I believe Q2 part 2 was marked incorrectly. I used the alternative method taught in class."
  }
  ```
- **Output (201 Created)**:
  ```json
  {
    "id": 1,
    "paper": 102,
    "student_comment": "I believe Q2 part 2 was marked incorrectly. I used the alternative method taught in class.",
    "status": "OPEN"
  }
  ```

---

## 5. Analytics & Statistics APIs

These endpoints provide data for the dashboard visualizations. They are primarily designed for the Admin/Staff dashboard but can be consumed by the frontend for coordinator views.

### `GET /api/stats/dashboard/data/`

Returns the list of courses the user is authorized to view stats for.

- **Auth**: `CONTROLLER`, `COORDINATOR`, or `TEACHER` (if course coordinator).
- **Output**:
  ```json
  { "courses": [{ "course_code": "CS101", "title": "Intro to CS" }] }
  ```

### `GET /api/stats/grievances/`

Returns grievance statistics.

- **Query Params**: `course_code` (Optional. If omitted, returns aggregate of all accessible courses).
- **Output**:
  ```json
  {
    "by_course": [{ "label": "CS101", "count": 5 }],
    "chart_data": [{ "label": "Section A", "count": 2 }],
    "label_type": "Section"
  }
  ```

### `GET /api/stats/scores/`

Returns score distribution histograms.

- **Query Params**: `course_code` (Optional).
- **Output**:
  ```json
  {
    "distribution": [0, 2, 5, 10, ...],
    "labels": ["0-10", "10-20", ...],
    "meta": { "count": 50, "avg": 75.5 }
  }
  ```

### `GET /api/stats/students/`

Drill down to see students in a specific score range.

- **Query Params**: `course_code`, `min`, `max`.
- **Output**:
  ```json
  { "students": [{ "name": "John", "score": 85, "paper_id": 101 }] }
  ```
