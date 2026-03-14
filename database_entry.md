# Database Entry Strategy & Workflows

This document outlines the workflows for populating the `Exam_E` database, specifically tailored for a university administration model where students are pre-enrolled and exam papers are digitized centrally.

---

## 🔐 0. Role Configuration in Data Entry

| User Type | `role` | `is_staff` | Description |
| :--- | :--- | :--- | :--- |
| **Student** | `STUDENT` | `False` | Application User. |
| **Teacher** | `TEACHER` | `False` | Standard Faculty. Viewing stats requires Course Coordinator link. |
| **Course Coordinator** | `TEACHER` | `False` | **Real faculty capability** linked via `Course.coordinator_id`; grants stats access for assigned courses only. |
| **Controller** | `CONTROLLER`| `False` | Faculty with Global Stats View. Can also teach courses. |


### Assigning Course Coordinators
A **Course Coordinator** is a `TEACHER` user assigned to manage a course's statistics and grievances. The `Course` model has a `coordinator_id` field (ForeignKey to User).
This coordinator capability is **not imported from CSV teacher data** and must be assigned explicitly.
1.  **Via Django Admin Panel**: Go to `Courses`, select a course, and select a Teacher in the "Coordinator" dropdown. This will set the `Course.coordinator_id` field.
2.  **Via Script**: Ensure the `Course` table is updated with the `user_id` of the teacher in the `coordinator_id` column.

---

## 🛠 Technical Guide: How to Run the Imports

The system now runs these imports **automatically** on startup inside the Docker container (`entrypoint.sh`). If you need to re-run them manually, use the following commands inside the `backend` container:

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

# 7. (Optional) Re-link only, if mediafiles were edited manually
python manage.py import_exam_media --overwrite-existing
```

---

## 1. Initial Setup (Admin Dashboard)

_The "Data Import Tool" in the Django Admin Panel replaces command-line scripts for most data entry tasks._

### Data Import Order & Requirements

The following table details the necessary CSV columns for each data type. **Bold fields are MANDATORY** for the system to function correctly in production.

| Order  | Data Type                 | Required Columns                                                                 | Description & Critical Notes                                                                 |
| :----- | :------------------------ | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **1.** | **Students**              | **Roll No**, **Name**, **Stream**, **Degree**, **Section**, **School Code**      | Creates User & Student profiles. **School Code** (e.g., CSE) is vital to link the stream correctly. |
| **2.** | **Teachers**              | **Emp ID**, **Name**, **Email**, **School Code**                                 | Creates User & Teacher profiles. **Emp ID** becomes the login ID.                            |
| **3.** | **Courses**               | **Course Code**, **Title**, **Credits**, **Type**                                | Defines the catalog. **Type** must be `CORE`, `PE`, or `OE`.                                 |
| **4.** | **Allocations**           | **Course Code**, **Teacher ID**, **Session**, **Section**, **Semester**          | **The Master Schedule**. Maps a teacher to a specific class section (e.g., `CS101` Section `A`). |
| **5.** | **Enrollments**           | **Roll No**, **Course Code**, **Session**, **Section**                           | Maps students to allocations. **Must match** the Section used in Allocations.                |

> **Important**:
> *   **School Code in Students CSV**: While the importer can guess the school from the stream name, it is **strongly recommended** to provide the `School Code` column (e.g., `CSE`, `MECH`) explicitly to prevent data integrity issues.
> *   **Session Creation**: The importer automatically creates new Academic Sessions (e.g., "2024-2025") if they don't exist in the system.

### Handling Multiple Sections
If a course (e.g., `CS32003`) has multiple sections (e.g., `HPC1` to `HPC9`), simply ensure your CSVs are specific:
1.  **Allocation**: Create 9 rows, one for each section (`HPC1`...`HPC9`) checking against the Teacher ID.
2.  **Enrollment**: Specify the exact section (`HPC1`) for each student in the `Section` column.

---

## 2. Exam Configuration (Per Session)

_Before papers can be uploaded, the "Exam Event" must be created._

| Table     | What to Feed                     | How to Feed                                                                                                                                     |
| :-------- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **exams** | `exam_type`, `marks`, `metadata` | **Django Admin Dashboard** <br> Navigate to `http://localhost:8000/admin/` -> Exams -> Add Exam. Define marks and upload JSON schema if needed. |

## 5. Exam Paper Digitization & Linking

_Students do not upload papers. A dedicated department digitizes them, and page paths are attached directly to `exam_papers.pages`._

### Ground-Truth Storage
- `exam_papers.pages` is the only paper file-path source.
- Deprecated single-path fallbacks are removed.
- Auto-linking maps folders named `ROLLNO_COURSECODE` under `backend/mediafiles/papers` to matching enrollments.
- Question papers and answer keys are linked from `backend/mediafiles/exam_docs` into `Exam.question_paper_path` / `Exam.answer_key_path`.

## 6. Storage Strategy: `Data/` vs `mediafiles/`

The system uses a hybrid storage approach to handle large volumes of scanned answer sheets efficiently:

| Directory | Purpose | Handling |
| :--- | :--- | :--- |
| **`Data/`**  | Academic CSV seed files and other non-media bootstrap content. | Used by import scripts (`import_academic_data`, `import_students`, `bulk_enroll`). |
| **`mediafiles/`** | Ground-truth media storage for testing/import flow. | Auto-link source for papers (`mediafiles/papers`) and exam docs (`mediafiles/exam_docs`), plus regular Django uploads. |

> **Key Takeaway**: CSV data comes from `Data/test_data`, while paper/doc linking comes from `backend/mediafiles`.

---

## 6. Evaluation & Results

_Generated dynamically during the grading process._

| Table                    | Trigger                        | Source                                       |
| :----------------------- | :----------------------------- | :------------------------------------------- |
| **exam_papers (update)** | **Teacher** grades a paper     | Frontend sends v3 `marks_json` (`expected_*` + `awarded_*`) & `total_score`. Blank part inputs are normalized to `0` on save. |
| **grievances**           | **Student** challenges a grade | Frontend sends `paper_id` & `comment`.       |

## Summary of Required Scripts

1.  ✅ `scripts/import_students.py`: Registers Users & Student Profiles from CSV.
2.  ✅ `scripts/import_academic_data.py`: Multi-purpose importer for Schools/Streams, Teachers, Courses, and Allocations.
3.  ❌ `scripts/assign_core.py`: Enrolls a whole semester into a subject.
4.  ❌ `scripts/assign_elective.py`: Enrolls a CSV list of students into a subject.
5.  ❌ `scripts/upload_scanned_papers.py`: Digitization dept tool to parse filenames and populate `exam_papers`.

---

## 🛠 Technical Guide: How to Run the Imports

### Prerequisites

1.  **Python 3.x** installed on your host machine.
2.  **PostgreSQL Driver** installed:
    ```bash
    pip install psycopg2-binary
    ```
3.  **Database Running**: The Docker container must be up.
    ```bash
    cd docker
    docker compose up -d
    cd ..
    ```

### Command Reference

**1. Foundational Data (Schools & Streams)**

```bash
python scripts/import_academic_data.py --founders Data/schools_streams.csv
```

**2. Faculty Data**

```bash
python scripts/import_academic_data.py --teachers Data/teachers.csv
```

**3. Course Catalog**

```bash
python scripts/import_academic_data.py --courses Data/courses.csv
```

**4. Student Data (Bulk Import)**

```bash
# Windows
Get-ChildItem Data/23*.csv | ForEach-Object { python scripts/import_students.py $_.FullName }

# Linux/Mac
for f in Data/23*.csv; do python3 scripts/import_students.py "$f"; done
```

**5. Allocations (The Schedule)**

```bash
python scripts/import_academic_data.py --allocations Data/allocations.csv
```

### Troubleshooting

- **Error connecting to database**: Ensure port `5433` is not blocked and the container is running (`docker ps`).
- **ModuleNotFoundError: No module named 'psycopg2'**: Run `pip install psycopg2-binary`.
