# Database Entry Strategy & Workflows

This document outlines the workflows for populating the `Exam_E` database, specifically tailored for a university administration model where students are pre-enrolled and exam papers are digitized centrally.

---

## 🔐 0. Role Configuration in Data Entry

| User Type | `role` | `is_staff` | Description |
| :--- | :--- | :--- | :--- |
| **Student** | `STUDENT` | `False` | Application User. |
| **Teacher** | `TEACHER` | `False` | Standard Faculty. Viewing stats requires Course Coordinator link. |
| **Course Coordinator** | `TEACHER` | `False` | **Linked to Course via `coordinator_id`**. See below. |
| **Controller** | `CONTROLLER`| `False` | Faculty with Global Stats View. Can also teach courses. |
| **System Admin** | `COORDINATOR`| `True` | **Technical Role**. Accesses Django Admin / Data Tools. |

### Assigning Course Coordinators
The `Course` model now has a `coordinator` field (ForeignKey to User).
1.  **Via Admin Panel**: Go to `Courses`, select a course, and pick a Teacher from the "Coordinator" dropdown (Controllers also appear here).
2.  **Via Script**: Ensure the `Course` table is updated with the `user_id` of the teacher in the `coordinator_id` column.

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

## 5. Exam Paper Digitization

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
    - **Linkage**: Finds the active `exam_id` (e.g., Midsem) based on strict configuration or user input.
    - **Upload**: Uploads either the PDF or the list of image paths to storage (S3/MinIO/Local).
    - **Database**: Inserts row into `exam_papers` with `file_path` (as JSON array or PDF path) and `status='PENDING'`.

---

## 6. Evaluation & Results

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
