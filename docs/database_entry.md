# Database Entry Strategy & Workflows

This document outlines the workflows for populating the `Exam_E` database, specifically tailored for a university administration model where students are pre-enrolled and exam papers are digitized centrally.

---

## 0. Role Configuration in Data Entry

| User Type | `role` | `is_staff` | Description |
| :--- | :--- | :--- | :--- |
| **Student** | `STUDENT` | `False` | Application User. |
| **Teacher** | `TEACHER` | `False` | Standard Faculty. Viewing stats requires Course Coordinator link. |
| **Course Coordinator** | `TEACHER` | `False` | Faculty capability linked via `Course.coordinator_id`; grants stats access for assigned courses only. |
| **Controller** | `CONTROLLER`| `False` | Faculty with Global Stats View. Can also teach courses. |


### Assigning Course Coordinators
A **Course Coordinator** is a `TEACHER` user assigned to manage a course's statistics and grievances. The `Course` model has a `coordinator_id` field (ForeignKey to User).
This coordinator capability is not imported from CSV teacher data and must be assigned explicitly:
1. **Via Django Admin Panel**: Go to `Courses`, select a course, and select a Teacher in the "Coordinator" dropdown. This sets the `Course.coordinator_id` field.
2. **Via Database**: Ensure the `Course` table is updated with the `user_id` of the teacher in the `coordinator_id` column.

---

## 1. Initial Setup (Admin Dashboard)

The Data Import Tool in the Django Admin Panel enables browser-based bulk CSV ingestion for academic records.

### Data Import Order & Requirements

The following table details the necessary CSV columns for each data type. Bold fields are required for the system to function correctly.

| Order  | Data Type                 | Required Columns                                                                 | Description & Requirements                                                                 |
| :----- | :------------------------ | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **1.** | **Students**              | **Roll No**, **Name**, **Stream**, **Degree**, **Section**, **School Code**      | Creates User & Student profiles. School Code (e.g., CSE) links the stream to the school.   |
| **2.** | **Teachers**              | **Emp ID**, **Name**, **Email**, **School Code**                                 | Creates User & Teacher profiles. Emp ID becomes the institutional login ID.                |
| **3.** | **Courses**               | **Course Code**, **Title**, **Credits**, **Type**                                | Defines the course catalog. Type must be `CORE`, `PE`, or `OE`.                            |
| **4.** | **Allocations**           | **Course Code**, **Teacher ID**, **Session**, **Section**, **Semester**          | Maps a teacher to a specific class section (e.g., `CS101` Section `A`).                  |
| **5.** | **Enrollments**           | **Roll No**, **Course Code**, **Session**, **Section**                           | Maps students to allocations. Must match the Section used in Allocations.                 |

- **School Code in Students CSV**: Provide the `School Code` column (e.g., `CSE`, `MECH`) explicitly to ensure accurate school-to-stream association.
- **Session Creation**: The importer automatically creates new Academic Sessions (e.g., "2024-2025") if they do not yet exist.

### Handling Multiple Sections
If a course (e.g., `CS32003`) has multiple sections (e.g., `HPC1` to `HPC9`), ensure CSV records specify distinct sections:
1. **Allocation**: Create rows for each section (`HPC1`...`HPC9`) mapped to the designated Teacher ID.
2. **Enrollment**: Specify the assigned section (e.g., `HPC1`) for each student in the `Section` column.

---

## 2. Exam Configuration (Per Session)

Before papers can be uploaded, the corresponding Exam Event must be defined.

| Table     | Attributes                       | Configuration Method                                                                                                                            |
| :-------- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **exams** | `exam_type`, `marks`, `metadata` | **Django Admin Dashboard**: Navigate to `/admin/core/exam/` -> Add Exam. Define total marks, passing criteria, and upload question schema.       |

---

## 3. Exam Paper Digitization & Linking

Students do not upload papers. A dedicated department digitizes them, and page paths are attached directly to `exam_papers.pages`.

### Ground-Truth Storage
- `exam_papers.pages` is the primary paper file-path source.
- Auto-linking maps folders named `ROLLNO_COURSECODE` under `backend/mediafiles/papers` to matching enrollments.
- Question papers and answer keys are linked from `backend/mediafiles/exam_docs` into `Exam.question_paper_path` / `Exam.answer_key_path`.
- Faculty page annotations are stored per page as JSON under `backend/mediafiles/papers/<ROLLNO>_<COURSECODE>/markings/page_<N>.json`, and indexed in `exam_papers.markings_index`.

---

## 4. Storage Architecture: `Data/` vs `mediafiles/`

The system uses a partitioned storage approach:

| Directory | Purpose | Handling |
| :--- | :--- | :--- |
| **`Data/`**  | Academic CSV seed files and bootstrap content. | Used by import scripts (`import_academic_data`, `import_students`, `bulk_enroll`). |
| **`mediafiles/`** | Ground-truth media storage for application assets. | Auto-link source for papers (`mediafiles/papers`) and exam docs (`mediafiles/exam_docs`), plus regular uploads. |

---

## 5. Evaluation & Results

Data is generated dynamically during the grading and grievance review process:

| Table                    | Trigger                        | Source                                       |
| :----------------------- | :----------------------------- | :------------------------------------------- |
| **exam_papers (update)** | Faculty grades a paper         | Frontend sends `marks_json` (`expected_*` + `awarded_*`) & `total_score`. Blank part inputs normalize to `0` on save. |
| **grievances**           | Student challenges an evaluation | Frontend sends `paper_id`, grievance category, and student comment. |

---

## 6. Manual Import Command Reference

Imports run automatically on startup inside the backend Docker container (`entrypoint.sh`). If you need to re-run them manually, execute the following commands inside the `backend` container:

```bash
# 1. Base Data (Schools, Streams)
python scripts/import_academic_data.py --founders "Data/test_data/0. schools_streams.csv"

# 2. Faculty & Catalog
python scripts/import_academic_data.py --teachers "Data/test_data/2_teachers.csv"
python scripts/import_academic_data.py --courses "Data/test_data/3_courses.csv"

# 3. Schedule (Allocations)
python scripts/import_academic_data.py --allocations "Data/test_data/4_allocations.csv"

# 4. Students
python scripts/import_students.py "Data/test_data/1_students.csv"

# 5. Enrollments (Linking Students to Classes)
python scripts/bulk_enroll.py --csv "Data/test_data/5_enrollments.csv" --session "2024-2025"

# 6. Seed extra paper/doc files into mediafiles from Data/Papers and link by enrollments
python manage.py seed_media_from_data --pages-per-paper 5 --assign-missing-teachers --overwrite-existing

# 7. (Optional) Re-link media files only
python manage.py import_exam_media --overwrite-existing
```
