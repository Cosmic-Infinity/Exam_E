# Exam_E API Documentation

This document outlines the REST APIs exposed by the Django backend for consumption by the React frontend.

---

## 0. Role & Permission System

The application uses a **Hierarchical Role System**.

### User Roles (`User.role`)

1.  **`STUDENT`**: Can only access their own data, exams, and results.
2.  **`TEACHER`**: The base role for all faculty members.
    - **Core Functionality**: Can access assigned course allocations, upload marks, and resolve grievances for their sections.
    - **As Course Coordinator**: If a Teacher is linked to a `Course` (via the `coordinator_id` field), they gain **read-only access** to the Statistics Dashboard for that specific course.
3.  **`CONTROLLER`** (Controller of Examination):
    - **Superset of Teacher**: Has all the capabilities of a Teacher (can teach courses, grade papers).
    - **Global View**: Has global read-only access to the Statistics Dashboard for **all courses**.
    - **API Access**: Can access all Teacher APIs (via `IsTeacher` permission) and all Statistics APIs.

### Note on System Administration

System administration (user management, database configuration) is handled exclusively via the **Django Admin Panel** (`/admin`). **Only users with `is_staff=True` and `is_superuser=True` flags** have access to this panel, regardless of their role. These system administrators do not interact with the exam evaluation workflow directly.

### Django Flags

- **`is_staff`**: Grants access to the **Django Admin Panel** (`/admin`).
  - **Teachers/Controllers**: `False` by default. They use the frontend portals.
  - **System Admin**: `True`. Only for technical DB maintenance.

---

## 1. Authentication APIs

### `POST /api/auth/login/`

Authenticates a user and sets an `HttpOnly` cookie containing the JWT access and refresh tokens.

- **Input**:
  ```json
  {
    "email": "admin@kiit.ac.in",
    "password": "securepassword"
  }
  ```
- **Output (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "university_id": "0000",
    "full_name": "System Admin",
    "role": "TEACHER",
    "is_course_coordinator": false,
    "is_controller": false
  }
  ```

### `GET /api/me/`

Returns the profile information of the currently authenticated user.

- **Auth Required**: Yes
- **Output (200 OK)**:
  ```json
  {
    "id": 1,
    "university_id": "0000",
    "full_name": "System Admin",
    "email": "admin@kiit.ac.in",
    "role": "TEACHER",
    "is_active": true,
    "date_joined": "2026-02-20T12:00:00Z",
    "is_course_coordinator": false,
    "is_controller": false
  }
  ```

---

## 2. Teacher Portal APIs

### `GET /api/teacher/allocations/`

Fetches a list of all active course sections assigned to the currently logged-in teacher. This is the data needed for the Teacher's "Home Screen".

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
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

### `GET /api/teacher/exams/{allocation_id}/`

Fetches a list of all exams (e.g., Midsem, Endsem) associated with a specific course allocation.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
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
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Input**: `exam_id` (as a query parameter)
- **Output (200 OK)**:
  ```json
  [
    {
      "paper_id": 101,
      "student_university_id": "2305128",
      "student_name": "Alice Smith",
      "total_score": null,
      "evaluation_status": "PENDING",
      "has_grievance": true
    },
    {
      "paper_id": 102,
      "student_university_id": "2305129",
      "student_name": "Bob Jones",
      "total_score": "28.50",
      "evaluation_status": "COMPLETED",
      "has_grievance": false
    }
  ]
  ```

### `GET /api/teacher/paper/{paper_id}/`

Fetches the full details of a specific paper, including all page images, question paper PDF, answer key PDF, and the current marks JSON.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Input**: `paper_id` (in the URL path)
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "student_university_id": "2305128",
    "student_name": "Alice Smith",
    "pages": [
      "/api/teacher/paper/101/page/1/",
      "/api/teacher/paper/101/page/2/",
      "/api/teacher/paper/101/page/3/"
    ],
    "page_markings": [
      {
        "page_index": 1,
        "api_path": "/api/teacher/paper/101/markings/1/",
        "updated_at": "2026-03-22T10:14:30.125394+00:00",
        "updated_by": 21
      }
    ],
    "question_paper_path": "/api/teacher/paper/101/question-paper/",
    "answer_key_path": "/api/teacher/paper/101/answer-key/",
    "marks_json": null,
    "total_score": null,
    "evaluation_status": "PENDING",
    "has_grievance": true,
    "grievance_text": "Question 3(b) not evaluated.",
    "grievance_date": 45,
    "question_paper_schema": [
      { "q_no": 1, "parts": [1, 1, 1, 1, 1] },
      { "q_no": 2, "parts": [2, 3] }
    ],
    "exam_total_marks": 30
  }
  ```

### `GET /api/review/paper/{paper_id}/`

Fetches full paper details for **read-only statistics drill-down** (controller/coordinator use-case).

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Access Scope**:
  - `CONTROLLER`: all papers
  - `TEACHER` (including coordinators): own section papers, assigned-grievance papers, and coordinated-course papers
- **Input**: `paper_id` (in the URL path)
- **Output (200 OK)**: Same shape as `GET /api/teacher/paper/{paper_id}/`

### `GET /api/review/paper/{paper_id}/page/{page_index}/`

Fetches one answer-sheet page image for read-only review access.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`

### `GET /api/review/paper/{paper_id}/question-paper/`

Fetches question paper file for read-only review access.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`

### `GET /api/review/paper/{paper_id}/answer-key/`

Fetches answer key file for read-only review access.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`

### `GET /api/review/paper/{paper_id}/markings/`

Fetches markings index metadata for the paper in read-only mode.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`

### `GET /api/review/paper/{paper_id}/markings/{page_index}/`

Fetches markings JSON payload for one page in read-only mode.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`

### `GET /api/teacher/paper/{paper_id}/markings/`

Returns the marking manifest for a paper. Each entry is a page-level marking JSON saved by faculty.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "count": 2,
    "markings": [
      {
        "page_index": 1,
        "api_path": "/api/teacher/paper/101/markings/1/",
        "updated_at": "2026-03-22T10:14:30.125394+00:00",
        "updated_by": 21
      },
      {
        "page_index": 2,
        "api_path": "/api/teacher/paper/101/markings/2/",
        "updated_at": "2026-03-22T10:18:11.992045+00:00",
        "updated_by": 21
      }
    ]
  }
  ```

### `GET /api/teacher/paper/{paper_id}/markings/{page_index}/`

Returns the exact stored markings payload for one paper page.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "page_index": 1,
    "markings": {
      "strokes": [
        {
          "tool": "tick",
          "color": "#16a34a",
          "points": [[45, 80], [58, 94]]
        }
      ]
    },
    "updated_by": 21,
    "updated_at": "2026-03-22T10:14:30.125394+00:00"
  }
  ```

If no markings exist yet for that page, this endpoint still returns `200 OK` with an empty payload:

```json
{
  "paper_id": 101,
  "page_index": 2,
  "markings": null,
  "updated_by": null,
  "updated_at": null
}
```

### `PUT /api/teacher/paper/{paper_id}/markings/{page_index}/`

Creates or replaces the markings JSON for one page.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Input**:
  ```json
  {
    "markings": {
      "strokes": [
        {
          "tool": "cross",
          "color": "#dc2626",
          "points": [[10, 20], [20, 30], [20, 20], [10, 30]]
        }
      ]
    }
  }
  ```
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "page_index": 1,
    "storage_path": "media/papers/2305128_CS302/markings/page_1.json",
    "updated_at": "2026-03-22T10:20:44.515930+00:00",
    "updated_by": 21
  }
  ```

Stored file location pattern:

- `backend/mediafiles/papers/<ROLLNO>_<COURSECODE>/markings/page_<N>.json`
- DB index path: `exam_papers.markings_index`

### `GET /api/teacher/grievances/?filter={my_section|other_section|all}`

Returns OPEN grievances visible to the logged-in faculty/controller.

- `my_section`: grievances raised on papers from sections taught by the logged-in user.
- `other_section`: visible grievances outside sections taught by the logged-in user.
- `all`: union of all grievances visible to the logged-in user.

Visibility rules:

- `TEACHER` (non-coordinator): can list grievances from own sections and grievances explicitly assigned to them.
- `TEACHER` (course coordinator): can also list grievances from all sections of coordinated courses.
- `CONTROLLER`: can list grievances across all courses and sections.

Detail-field rules:

- `student_comment`, `grievance_type`, `grievance_type_label` are visible only to:
  - assigned faculty,
  - course coordinator of that grievance's course,
  - controller.
- For other visible users, those fields are returned as `null`.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Output (200 OK)**:
  ```json
  [
    {
      "id": 45,
      "paper_id": 101,
      "status": "OPEN",
      "student_comment": "Question 3(b) not evaluated.",
      "student_university_id": "2305128",
      "student_name": "Alice Smith",
      "subject_code": "CS302",
      "subject_title": "Database Management Systems",
      "section_name": "A",
      "original_faculty_id": 21,
      "original_faculty_name": "Dr. Kumar",
      "assigned_faculty_id": 23,
      "assigned_faculty_name": "Dr. Das",
      "grievance_type": "PAGE_MISSING",
      "grievance_type_label": "Page Missing",
      "assignment_status": "ASSIGNED_TO_YOU",
      "can_resolve": true
    }
  ]
  ```

### `GET /api/teacher/grievances/stats/`

Returns grievance summary cards and section-wise load distribution for the user's visibility scope.

Visibility scope follows the same rules as `GET /api/teacher/grievances/`.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Output (200 OK)**:
  ```json
  {
    "assigned_open_count": 4,
    "to_resolve_count": 4,
    "resolved_count": 12,
    "rejected_count": 1,
    "visible_open_count": 6,
    "total_visible_count": 17,
    "by_section": [
      {
        "section_name": "A",
        "total": 9,
        "open": 3,
        "resolved": 5,
        "rejected": 1
      }
    ]
  }
  ```

### `POST /api/teacher/grievances/{grievance_id}/decision/`

Accepts or rejects an OPEN grievance.

- Decision is allowed only for:
  - the assigned faculty (`assigned_faculty` DB column).

If a grievance is unassigned or assigned to another faculty, decision APIs return `403 Forbidden`.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Input**:
  ```json
  {
    "status": "RESOLVED",
    "marks_json": { "sections": [] },
    "total_score": 27.5
  }
  ```

For rejection:

  ```json
  {
    "status": "REJECTED"
  }
  ```

- **Output (200 OK)**:
  ```json
  {
    "id": 45,
    "status": "RESOLVED",
    "assigned_faculty_id": 23
  }
  ```
## 3. Statistics APIs (Controllers & Course Coordinators)

These APIs power the dashboards for Controllers (global view) and Course Coordinators—TEACHER users with assigned courses (course-specific view).

Admin analytics endpoints reside under `/admin/stats/` and are isolated from frontend `/api/stats/` endpoints.

### `GET /api/stats/dashboard/data/`

Returns the list of courses accessible to the current user for the dashboard dropdown.

- **Auth Required**: Yes
- **Role Required**: `CONTROLLER` or `TEACHER` (assigned as course coordinator)
- **Output (200 OK)**:
  ```json
  {
    "courses": [
      { "course_code": "CS302", "title": "Database Management Systems" },
      { "course_code": "CS401", "title": "Artificial Intelligence" }
    ]
  }
  ```

### `GET /api/stats/subjects/`

Returns a high-level overview of all subjects the user has access to, including checking progress.

- **Auth Required**: Yes
- **Role Required**: `CONTROLLER` or `TEACHER` (assigned as course coordinator)
- **Input**: None
- **Output (200 OK)**:
  ```json
  {
    "subjects": [
      {
        "course_code": "CS302",
        "title": "DBMS",
        "total_students": 120,
        "checked": 45,
        "pending": 75,
        "grievances": 2
      }
    ]
  }
  ```

### `GET /api/stats/sections/?course_code={code}`

Drills down into a specific course to show progress per section.

- **Auth Required**: Yes
- **Role Required**: `CONTROLLER` or `TEACHER` (assigned as course coordinator)
- **Input**: `course_code` (query param)
- **Output (200 OK)**:
  ```json
  {
    "sections": [
      {
        "allocation_id": 10,
        "section_name": "A",
        "teacher__full_name": "Dr. Smith",
        "total_students": 60,
        "checked": 60,
        "pending": 0,
        "grievances": 0
      }
    ]
  }
  ```

### `GET /api/stats/scores/?course_code={code}`

Returns histogram data for score distribution.

- **Auth Required**: Yes
- **Role Required**: `CONTROLLER` or `TEACHER` (assigned as course coordinator)
- **Input**: `course_code` (optional query param)
- **Output (200 OK)**:
  ```json
  {
    "distribution": [0, 2, 5, 10, 20, 15, 5, 2, 1, 0],
    "labels": ["0-10", "10-20", ... "90-100"],
    "meta": { "count": 60, "avg": 45.5 }
  }
  ```

### `GET /api/stats/grievances/?course_code={code}`

Returns grievance statistics.

- **Auth Required**: Yes
- **Role Required**: `CONTROLLER` or `TEACHER` (assigned as course coordinator)
- **Input**: `course_code` (optional query param)
- **Output (200 OK)**:
  ```json
  {
    "chart_data": [
      { "label": "A", "count": 5 },
      { "label": "B", "count": 2 }
    ],
    "label_type": "Section"
  }
  ```


### `PUT /api/teacher/paper/{paper_id}/`

Updates the marks and evaluation status for a specific paper.

- **Auth Required**: Yes
- **Role Required**: `TEACHER` or `CONTROLLER`
- **Input**:
  ```json
  {
    "marks_json": {
      "template_version": 3,
      "generated_from_schema": true,
      "sections": [
        {
          "section_index": 1,
          "type": "COMPULSORY",
          "questions": [
            {
              "q_no": 1,
              "expected_total": 5,
              "awarded_total": 4,
              "parts": [
                { "part_no": 1, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 2, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 3, "expected_marks": 1, "awarded_marks": 0 },
                { "part_no": 4, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 5, "expected_marks": 1, "awarded_marks": 1 }
              ]
            }
          ]
        }
      ]
    },
    "total_score": "4.00",
    "evaluation_status": "COMPLETED"
  }
  ```
- **Notes**:
  - `expected_marks` values come from the question paper schema and must not be edited during grading.
  - `awarded_marks` is initially `null` on ungraded papers.
  - On save, frontend converts any blank teacher input to `0` and sends explicit numeric values.
- **Output (200 OK)**: Returns the updated paper object.

---

## 4. Student Portal APIs

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

Fetches the full details of a specific paper, including all page images, question paper PDF, answer key PDF, and the marks JSON, so the student can review their grading.

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
    "pages": [
      "/api/student/paper/102/page/1/",
      "/api/student/paper/102/page/2/",
      "/api/student/paper/102/page/3/"
    ],
    "page_markings": [
      {
        "page_index": 1,
        "api_path": "/api/student/paper/102/markings/1/",
        "updated_at": "2026-03-22T10:14:30.125394+00:00",
        "updated_by": 21
      }
    ],
    "question_paper_path": "/api/student/paper/102/question-paper/",
    "answer_key_path": "/api/student/paper/102/answer-key/",
    "marks_json": {
      "template_version": 3,
      "generated_from_schema": true,
      "sections": [
        {
          "section_index": 1,
          "type": "COMPULSORY",
          "questions": [
            {
              "q_no": 1,
              "expected_total": 5,
              "awarded_total": 4,
              "parts": [
                { "part_no": 1, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 2, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 3, "expected_marks": 1, "awarded_marks": 0 },
                { "part_no": 4, "expected_marks": 1, "awarded_marks": 1 },
                { "part_no": 5, "expected_marks": 1, "awarded_marks": 1 }
              ]
            },
            {
              "q_no": 2,
              "expected_total": 5,
              "awarded_total": 4.5,
              "parts": [
                { "part_no": 1, "expected_marks": 2, "awarded_marks": 2 },
                { "part_no": 2, "expected_marks": 3, "awarded_marks": 2.5 }
              ]
            }
          ]
        }
      ]
    },
    "total_score": "28.50",
    "evaluation_status": "COMPLETED",
    "question_paper_schema": [
      { "q_no": 1, "parts": [1, 1, 1, 1, 1] },
      { "q_no": 2, "parts": [2, 3] }
    ]
  }
  ```

### `GET /api/student/paper/{paper_id}/markings/`

Returns read-only marking manifest for a student's own completed paper.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "count": 1,
    "markings": [
      {
        "page_index": 1,
        "api_path": "/api/student/paper/101/markings/1/",
        "updated_at": "2026-03-22T10:14:30.125394+00:00",
        "updated_by": 21
      }
    ]
  }
  ```

### `GET /api/student/paper/{paper_id}/markings/{page_index}/`

Returns read-only teacher annotation payload for one page.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 101,
    "page_index": 1,
    "markings": {
      "strokes": [
        {
          "tool": "cross",
          "color": "#dc2626",
          "points": [[10, 20], [20, 30], [20, 20], [10, 30]]
        }
      ]
    },
    "updated_by": 21,
    "updated_at": "2026-03-22T10:14:30.125394+00:00"
  }
  ```

If no teacher markings exist for that page, this endpoint still returns `200 OK` with an empty payload:

```json
{
  "paper_id": 101,
  "page_index": 2,
  "markings": null,
  "updated_by": null,
  "updated_at": null
}
```

### `POST /api/student/grievance/`

Allows a student to raise a grievance (re-evaluation request) for a specific paper.

Multiple grievances are allowed for the same paper (for example, one for missing pages and another for unchecked questions). Exact duplicate open comments for the same paper are rejected.

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

### `GET /api/student/grievances/?paper={paper_id}`

Returns grievance history for the logged-in student.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Query Params**:
  - `paper` (optional): filters to a specific paper
- **Output (200 OK)**:
  ```json
  [
    {
      "id": 12,
      "paper": 102,
      "student_comment": "[Pages Missing: 3,5] Pages are not visible.",
      "status": "OPEN"
    },
    {
      "id": 15,
      "paper": 102,
      "student_comment": "Q5 seems unchecked.",
      "status": "RESOLVED"
    }
  ]
  ```

---

### `GET /api/student/papers/`

Lists all graded and released exam papers for the currently authenticated student.

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Input**: None (Uses the user's session/token)
- **Output (200 OK)**:
  ```json
  [
    {
      "paper_id": 1,
      "exam": {
        "exam_id": 1,
        "exam_type": "ENDSEM",
        "total_marks": 100,
        "passing_marks": 40,
        "course_code": "CS201",
        "course_title": "Machine Learning"
      },
      "total_score": 78,
      "evaluation_status": "COMPLETED"
    }
  ]
  ```

**Visibility Rules**:
- Only papers with `evaluation_status = 'COMPLETED'` are shown
- Only papers belonging to the student's enrollments are shown

### `GET /api/student/paper/<int:pk>/`

Retrieves full details of a specific paper including all page images, marks breakdown, and exam information (read-only).

- **Auth Required**: Yes
- **Role Required**: `STUDENT`
- **Input**: Paper ID in URL path
- **Output (200 OK)**:
  ```json
  {
    "paper_id": 1,
    "exam": {
      "exam_id": 1,
      "exam_type": "ENDSEM",
      "total_marks": 100,
      "passing_marks": 40,
      "course_code": "CS201",
      "course_title": "Machine Learning"
    },
    "pages": [
      "papers/2205101_CS201/page1.jpg",
      "papers/2205101_CS201/page2.jpg",
      "papers/2205101_CS201/page3.jpg"
    ],
    "marks_json": {
      "template_version": 3,
      "generated_from_schema": true,
      "sections": [
        {
          "section_index": 1,
          "type": "COMPULSORY",
          "questions": [
            {
              "q_no": 1,
              "expected_total": 20,
              "awarded_total": 15,
              "parts": [
                { "part_no": 1, "expected_marks": 20, "awarded_marks": 15 }
              ]
            }
          ]
        }
      ]
    },
    "total_score": 78,
    "evaluation_status": "COMPLETED",
    "question_paper_schema": null,
    "question_paper_path": null,
    "answer_key_path": null
  }
  ```

**Note on `pages` Field**:
- Contains an array of relative file paths to JPEG images
- Images are served via `/media/` path: `http://localhost:8000/media/papers/2205101_CS201/page1.jpg`
- Order in array determines display sequence in frontend
