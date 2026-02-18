# Database Schema Documentation

This document outlines the PostgreSQL schema used for the University Paper Evaluation System. The schema is designed to handle users, academic structures, course allocations, and the examination process with flexibility for cross-departmental electives.

## Key Relationships Diagram (Mental Model)

```
[School 1] --- [Stream CS] --- [Student 123] --> [Enrollment 50] <--- [Allocation 99] <-- [Course CS302]
                                                   ^                    ^
                                                   |                    |
                                              [Paper 700]          [Teacher 007]
```

## 1. users

The central identity table. All actors (Students, Teachers, Admins) are stored here.

| Attribute       | Type         | Source            | Description                                                                                                                                          |
| :-------------- | :----------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | Integer (PK) | **DB Auto-Gen**   | **User ID**. The master key for any person in the system. <br> _Type: Serial / Auto-Increment_                                                       |
| `university_id` | Varchar(30)  | **Manual Input**  | **Official ID**. The ID printed on ID cards. This must be provided during registration. <br> _Example (Student): `2305128`_ <br> _Unique Constraint_ |
| `email`         | Varchar(100) | **Manual Input**  | Login credential. <br> _Unique Constraint_                                                                                                           |
| `password_hash` | Text         | **App Generated** | Hashed string. DB stores the result, Application generates it.                                                                                       |
| `role`          | Varchar(20)  | **Manual Input**  | Permissions level. <br> _Values: `'STUDENT'`, `'TEACHER'`, `'ADMIN'`_                                                                                |
| `created_at`    | Timestamp    | **DB Default**    | Timestamp. <br> _Default: `CURRENT_TIMESTAMP`_                                                                                                       |

## 2. schools

Top-level academic hierarchy (e.g., School of Electronic Engineering).

| Attribute   | Type         | Source            | Description                                  |
| :---------- | :----------- | :---------------- | :------------------------------------------- |
| `school_id` | Integer (PK) | **DB Auto-Gen**   | **School ID**. Auto-incrementing identifier. |
| `name`      | Varchar(100) | **Manual/Script** | Full name. <br> _Unique Constraint_          |
| `code`      | Varchar(10)  | **Manual/Script** | Short code. <br> _Unique Constraint_         |

## 3. streams

Specific branches within a school (e.g., Computer Science, Mechanical).

| Attribute     | Type         | Source            | Description                                                                      |
| :------------ | :----------- | :---------------- | :------------------------------------------------------------------------------- |
| `stream_id`   | Integer (PK) | **DB Auto-Gen**   | **Stream ID**.                                                                   |
| `school_id`   | Integer (FK) | **Manual/Script** | **Parent School**. Links this stream to its owning school (`schools.school_id`). |
| `name`        | Varchar(100) | **Manual/Script** | Stream name. <br> _Example: `Computer Science & Engineering`_                    |
| `degree_type` | Varchar(20)  | **Manual/Script** | Qualification. <br> _Example: `B.Tech`, `M.Tech`, `Ph.D`_                        |

## 4. students

Extension of the `users` table containing academic specifics for students.

| Attribute          | Type             | Source            | Description                                                             |
| :----------------- | :--------------- | :---------------- | :---------------------------------------------------------------------- |
| `user_id`          | Integer (PK, FK) | **Manual/Script** | **Link to User**. Must match an existing `users.id`.                    |
| `stream_id`        | Integer (FK)     | **Manual/Script** | **Major/Branch**. Which stream (`streams.stream_id`) are they studying? |
| `current_semester` | Integer          | **Manual/Script** | Academic progress. <br> _Default: `1`_                                  |
| `section_name`     | Varchar(10)      | **Manual/Script** | **Home Section**. Their administrative grouping.                        |
| `batch`            | Varchar(10)      | **Manual/Script** | Cohort year. <br> _Example: `2023`_                                     |

## 5. teachers

Extension of the `users` table containing faculty specifics.

| Attribute        | Type             | Source            | Description                                                      |
| :--------------- | :--------------- | :---------------- | :--------------------------------------------------------------- |
| `user_id`        | Integer (PK, FK) | **Manual/Script** | **Link to User**. Same value as `users.id`.                      |
| `school_id`      | Integer (FK)     | **Manual/Script** | **Department**. Which school (`schools.school_id`) employs them? |
| `specialization` | Varchar(100)     | **Manual Input**  | Expertise.                                                       |
| `is_coordinator` | Boolean          | **Manual Input**  | **Privilege Flag**. <br> _Default: `false`_                      |

## 6. academic_sessions

Defines time periods for the university.

| Attribute    | Type         | Source           | Description                                   |
| :----------- | :----------- | :--------------- | :-------------------------------------------- |
| `session_id` | Integer (PK) | **DB Auto-Gen**  | **Session ID**.                               |
| `label`      | Varchar(20)  | **Manual Input** | Display name. <br> _Example: `Spring 2026`_   |
| `is_active`  | Boolean      | **Manual Input** | **Current Term Flag**. <br> _Default: `true`_ |

## 7. courses

The catalog of subjects (Metadata only).

| Attribute     | Type             | Source           | Description                                                                                                          |
| :------------ | :--------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------- |
| `course_code` | Varchar(15) (PK) | **Manual Input** | **Subject Code**. The universal ID for a subject. <br> _Note: This is NOT auto-generated. You must provide `CS302`._ |
| `title`       | Varchar(100)     | **Manual Input** | Book name.                                                                                                           |
| `credits`     | Integer          | **Manual Input** | Cost. <br> _Default: `4`_                                                                                            |
| `course_type` | Varchar(20)      | **Manual Input** | Category. <br> _Constraint: Must be `CORE`, `PE`, or `OE`._                                                          |

## 8. course_allocations

**"The Class Instance"**. A specific offering of a `course` by a `teacher` in a `session`.

| Attribute       | Type             | Source           | Description                                |
| :-------------- | :--------------- | :--------------- | :----------------------------------------- |
| `allocation_id` | Integer (PK)     | **DB Auto-Gen**  | **Class ID**.                              |
| `course_code`   | Varchar(15) (FK) | **Manual Input** | **Subject**. Updates what is being taught. |
| `teacher_id`    | Integer (FK)     | **Manual Input** | **Instructor**. Who is teaching.           |
| `session_id`    | Integer (FK)     | **Manual Input** | **Time**. When is it happening.            |
| `section_name`  | Varchar(10)      | **Manual Input** | **Class Group**.                           |
| `semester`      | Integer          | **Manual Input** | Target semester. <br> _Example: `6`_       |

## 9. enrollments

**"The Roster"**. Connects a `student` to a `course_allocation`.

| Attribute         | Type         | Source           | Description                                                     |
| :---------------- | :----------- | :--------------- | :-------------------------------------------------------------- |
| `enrollment_id`   | Integer (PK) | **DB Auto-Gen**  | **Enrollment ID**.                                              |
| `student_id`      | Integer (FK) | **App Logic**    | Who (`students.user_id`). Populated by mass-enrollment scripts. |
| `allocation_id`   | Integer (FK) | **App Logic**    | Which Class (`course_allocations.allocation_id`).               |
| `enrollment_type` | Varchar(20)  | **App Auto-Gen** | Type of seat. <br> _Default: `'REGULAR'`_                       |
| `status`          | Varchar(20)  | **App Auto-Gen** | State. <br> _Default: `'ACTIVE'`_                               |

## 10. exam_papers

**"The Answer Sheet"**. Connects to an `enrollment`, not just a user.

| Attribute           | Type         | Source                  | Description                                          |
| :------------------ | :----------- | :---------------------- | :--------------------------------------------------- |
| `paper_id`          | Integer (PK) | **DB Auto-Gen**         | **Paper ID**.                                        |
| `enrollment_id`     | Integer (FK) | **Digitization Script** | **Context**. Extracted from folder/filename mapping. |
| `file_path`         | Text         | **Digitization Script** | System path to the file.                             |
| `marks_json`        | JSONB        | **App (Teacher)**       | Detailed scores. <br> _Nullable_                     |
| `total_score`       | Numeric      | **App (Teacher)**       | Result. <br> _Nullable_                              |
| `evaluation_status` | Varchar(20)  | **DB Default**          | Workflow state. <br> _Default: `'PENDING'`_          |

## 11. grievances

Dispute resolution.

| Attribute              | Type         | Source            | Description                                                           |
| :--------------------- | :----------- | :---------------- | :-------------------------------------------------------------------- |
| `id`                   | Integer (PK) | **DB Auto-Gen**   | Unique ID.                                                            |
| `paper_id`             | Integer (FK) | **App (Student)** | **Target**. Which paper (`exam_papers.paper_id`) is being challenged? |
| `student_comment`      | Text         | **App (Student)** | User input.                                                           |
| `assigned_coordinator` | Integer      | **App Logic**     | Auto-assigned based on Course Policy.                                 |
| `status`               | Varchar(20)  | **DB Default**    | Workflow state. <br> _Default: `'OPEN'`_                              |
