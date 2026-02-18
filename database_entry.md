# Database Entry Strategy & Workflows

This document outlines the workflows for populating the `Exam_E` database, specifically tailored for a university administration model where students are pre-enrolled and exam papers are digitized centrally.

## 1. Initial Setup (Admin / Scripts)

_These tables form the structural backbone and must be populated first. Order matters._

| Order  | Table                     | What to Feed                                | How to Feed                                                                                                                       |
| :----- | :------------------------ | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| **1.** | **schools** & **streams** | `school_code`, `stream_name`, `degree_type` | **`scripts/import_academic_data.py --founders Data/schools_streams.csv`** <br> Loads the official list of University Departments. |
| **2.** | **courses**               | `course_code`, `title`, `credits`           | **`scripts/import_academic_data.py --courses Data/courses.csv`** <br> Loads the Course Catalog.                                   |
| **3.** | **teachers**              | `emp_id`, `name`, `specialization`          | **`scripts/import_academic_data.py --teachers Data/teachers.csv`** <br> Creates Users & Teacher Profiles.                         |
| **4.** | **users** & **students**  | `university_id` (Roll No), `full_name`      | **`scripts/import_students.py`** (Bulk CSV Import) <br> Link students to the existing streams.                                    |
| **5.** | **academic_sessions**     | `label` (e.g., "Spring 2026")               | **Auto-generated** by Allocation Import (next step).                                                                              |
| **6.** | **course_allocations**    | `course_code`, `teacher_id`, `session`      | **`scripts/import_academic_data.py --allocations Data/allocations.csv`** <br> The "Master Schedule".                              |

**3. Mass Enrollment Workflows**

```bash
python scripts/bulk_enroll.py --csv Data/enrollments.csv --session "Spring 2026"
```

- **Format**: CSV with `Roll No`, `Subject Code`, `Section`, `Type` (Optional).
- **Logic**: Enrolls student into the allocation matching Subject + Section + Session. `Type` defaults to 'REGULAR' (e.g., use 'BACKLOG' for re-exams).
- **Works for**: Both core courses and electives.

---

## 3. Exam Paper Digitization

_Students do not upload papers. A dedicated department digitizes and maps them._

### Workflow

1.  **Scanning**: Physical answer sheets are scanned page-by-page.
2.  **Naming Convention**: Folders must be named logically, e.g., `ROLLNO_COURSECODE`.
    - Example Folder: `2305128_CS302`
    - Example Content: `page1.jpg`, `page2.jpg`, `page3.jpg`.
3.  **Bulk Upload**:
    - **Script**: Scans directory.
    - **Parsing**: Extracts `ROLLNUMBER` and `COURSECODE` from the folder name.
    - **Conversion (Optional)**: Converts images to a single PDF (Frontend can display PDF easier) or keeps as image list.
    - **Lookup**: Finds the active `enrollment_id` for that Student + Course combo.
    - **Upload**: Uploads either the PDF or the list of image paths to storage (S3/MinIO/Local).
    - **Database**: Inserts row into `exam_papers` with `file_path` (as JSON array or PDF path) and `status='PENDING'`.

---

## 4. Evaluation & Results

_Generated dynamically during the grading process._

| Table                    | Trigger                        | Source                                       |
| :----------------------- | :----------------------------- | :------------------------------------------- |
| **exam_papers (update)** | **Teacher** grades a paper     | Frontend sends `marks_json` & `total_score`. |
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
