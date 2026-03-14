```markdown
# Current Development Status & Roadmap

> **Last Updated:** March 14, 2026  
> **Summary:** Core exam data pipeline is complete. The system now supports schema-driven marks-template auto-generation for exam papers, course-table coordinator authority, and secure file serving for question papers and answer keys.

---

## 🚀 Recent Progress (March 6, 2026)

1.  **Infrastructure & File Serving** ✅:
    - **Digital Asset Serving**: configured Django (`urls.py`) to serve the `/Data/` directory securely in development mode, resolving "damaged file" errors on download.
    - **Frontend Viewer**: Updated `EvaluationViewer` to correctly handle file paths and gracefully display "No answer sheet found" states.
    - **Zero-Touch Entrypoint**: Updated `entrypoint.sh` to run the import pipeline (`import_academic_data`, `import_students`, `bulk_enroll`) automatically on container start.
2.  **Admin Experience** ✅:
    - **Visual Debugging**: Added image previews to the Django Admin `ExamPaper` list view to quickly verify correct file linking.

## 🚀 Recent Progress (March 14, 2026)

1.  **Schema-to-Marks Automation** ✅:
    - Added Celery-driven auto generation of `ExamPaper.marks_json` templates whenever `Exam.question_paper_schema` is created/updated.
    - Generation uses active enrollments for the exact exam allocation (course + section + session), with enrollment data as source of truth.
    - Updated marks template to **v3** shape with `expected_marks` + nullable `awarded_marks` and question totals.
    - Expected values are copied from exam schema; awarded values start as `null` for unchecked papers.
2.  **Coordinator Source of Truth** ✅:
    - `Course.coordinator` is now the only coordinator authority.
    - Legacy `Teacher.is_coordinator` paths were removed.
3.  **Deprecated Contract Cleanup** ✅:
    - Removed deprecated `ExamPaper.file_path`; `pages` is now the only paper asset source.
    - Removed legacy marks compatibility paths (`q1/p1` root shape) in favor of section-based `marks_json`.
4.  **Frontend Evaluation Upgrade** ✅:
    - Marks table is now dynamically built from schema-driven parts instead of fixed columns.
    - UI displays awarded/expected (`x/max`) at part and question totals.
    - On teacher save, blank part inputs are normalized to `0` before API update.

### ⚠️ Current Limitations
- Automatic exam-paper linking from legacy subject-folder mapping has been removed.

---

## 1. Authentication System


The authentication system is **fully functional** and secure.

### ✅ Resolved Issues

| Issue                   | Status | Resolution                                                                                                   |
| :---------------------- | :----- | :------------------------------------------------------------------------------------------------------------ |
| **Fake Logout**         | Fixed  | Logout now calls `/api/auth/logout/` to invalidate the server-side session.                                   |
| **No Route Protection** | Fixed  | `ProtectedRoute` component now wraps all sensitive routes in `App.tsx`.                                       |
| **No Token Refresh**    | Fixed  | `AuthService` automatically catches 401 errors, refreshes the token, and retries the request.                 |
| **Stale Sessions**      | Fixed  | `UserSessionContext` verifies session validity with `/api/me/` on application mount.                          |

---

## 2. Controller Statistics Feature

A hierarchical view for the **Controller of Examinations** to monitor evaluation progress institution-wide.

### 🟢 Status

- **Frontend**: ✅ Complete. `ControllerStatisticsPage.tsx` is fully integrated with backend APIs.
- **Backend**: ✅ Complete. Endpoints `/api/stats/subjects/` (overview) and `/api/stats/sections/` (drill-down) are live.

---

## 3. Course Coordinator Statistics Feature

A dashboard for **Course Coordinators** to track evaluation progress for their specific subjects.

### 🟢 Status

- **Frontend**: ✅ Complete. `StatisticsPage.tsx` displays section-wise overview using real data.
- **Backend**: ✅ Complete. Endpoint `/api/stats/sections/?course_code=XYZ` serves filtered data.

---

## 📋 Immediate Action Plan

**Priority 1: Evaluation Workflow Polish**

- [ ] Stress test the evaluation flow with multiple concurrent users.
- [ ] Verify grievance submission and handling flow (Student -> Teacher).

**Priority 2: UI/UX Refinements**

- [ ] Add loading skeletons for smoother data fetching transitions.
- [ ] Implement robust error boundaries for API failures.

## Note

DO NOT GRAB RESOURCES FROM THE INTERNET
treat the system as embedded, and preload/cache all resources at development/build time. all such resources are to be served by the backend, preferably through nginx.
