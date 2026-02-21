# Backend Requirements for Course Coordinator Statistics Feature

## Overview
This document outlines the backend API endpoints and data structures required to fully support the Course Coordinator Statistics feature in the frontend. The frontend is designed to work with these endpoints to display section-wise evaluation metrics.

## Current Status
- **Frontend Implementation**: ✅ Complete
- **Backend Integration**: ⚠️ Partial (using existing endpoints where available)
- **Recommended Backend Enhancements**: 📋 Listed below

---

## Frontend Feature Description
When a user with `is_coursecoordinator=true` logs in, they see a "Statistics" button on the Faculty Dashboard. Clicking this button navigates to the Statistics Page which displays:

1. **Course Selector**: Dropdown to select from accessible courses
2. **Section Overview Table**: Shows each section with:
   - Total students enrolled
   - Checking progress (papers being reviewed)
   - Marking progress (papers marked)
   - Grievance count
3. **Expandable Section Details**: Shows:
   - Detailed statistics cards for checking, marking, and grievance progress
   - Progress bars with percentages
   - Grievance details table with student info and grievance types

---

## Current Backend Integration

### Existing Endpoints Being Used

#### 1. `/api/stats/dashboard/data/` (GET)
**Purpose**: Fetch list of accessible courses for the coordinator
**Current Response**:
```json
{
  "courses": [
    {
      "course_code": "CS101",
      "title": "Introduction to Programming"
    }
  ]
}
```
**Status**: ✅ Working

#### 2. `/api/stats/grievances/?course_code=CS101` (GET)
**Purpose**: Fetch grievance statistics grouped by section
**Current Response**:
```json
{
  "by_course": [],
  "chart_data": [
    {
      "label": "Section A",
      "count": 5
    }
  ],
  "label_type": "Section"
}
```
**Status**: ✅ Working (partially - returns section-wise grievance count)

#### 3. `/api/stats/scores/?course_code=CS101` (GET)
**Purpose**: Fetch score distribution data
**Status**: ✅ Working

#### 4. `/api/stats/students/?course_code=CS101&min=0&max=100` (GET)
**Purpose**: Fetch students in a specific score range
**Status**: ✅ Working

---

## Recommended Backend Enhancements

### ⭐ Priority 1: Section-wise Paper Status Statistics Endpoint

**Recommended Path**: `GET /api/stats/sections/?course_code=CS101`

**Purpose**: Get comprehensive section-wise statistics including paper evaluation status

**Recommended Response Structure**:
```json
{
  "course_code": "CS101",
  "course_title": "Introduction to Programming",
  "sections": [
    {
      "section_name": "Section A",
      "total_enrolled": 60,
      "papers_by_status": {
        "PENDING": 15,
        "IN_PROGRESS": 30,
        "COMPLETED": 15,
        "REVALUATION": 0
      },
      "grievance_count": 5,
      "grievance_details": [
        {
          "student_id": "STU001",
          "student_name": "Aarav Kumar",
          "student_roll": "001",
          "grievance_type": "Marking Error",
          "grievance_id": 123,
          "status": "OPEN"
        }
      ]
    }
  ]
}
```

**Implementation Notes**:
- Use `CourseAllocation.section_name` to group students
- Count students in each `ExamPaper.evaluation_status`
- Join with `Grievance` table to get grievance details
- Filter by `coordinator` (from `Course` or `User.role`)

**Security**: Only coordinator of the course should access this endpoint

---

### ⭐ Priority 2: Enhanced Grievance Details Endpoint

**Recommended Enhancement**: Extend `GET /api/stats/grievances/?course_code=CS101` to include student details

**Additional Response Fields**:
```json
{
  "chart_data": [
    {
      "label": "Section A",
      "count": 5,
      "details": [
        {
          "grievance_id": 123,
          "student_id": "STU001",
          "student_name": "Aarav Kumar",
          "grievance_type": "Marking Error",
          "status": "OPEN"
        }
      ]
    }
  ]
}
```

---

### Reference: Relevant Django Models

```python
# From core/models.py

class CourseAllocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.DO_NOTHING)
    section_name = models.CharField(max_length=10)  # "Section A", "Section B"
    session = models.ForeignKey(AcademicSession, on_delete=models.DO_NOTHING)
    teacher = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    semester = models.IntegerField()

class ExamPaper(models.Model):
    paper_id = models.AutoField(primary_key=True)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.DO_NOTHING)
    exam = models.ForeignKey('Exam', on_delete=models.DO_NOTHING)
    evaluation_status = models.CharField(max_length=20, choices=[
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REVALUATION', 'Revaluation')
    ])

class Grievance(models.Model):
    id = models.AutoField(primary_key=True)
    paper = models.ForeignKey(ExamPaper, on_delete=models.DO_NOTHING)
    student_comment = models.TextField()
    assigned_coordinator = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    status = models.CharField(max_length=20, choices=[
        ('OPEN', 'Open'),
        ('RESOLVED', 'Resolved'),
        ('REJECTED', 'Rejected')
    ])

class Course(models.Model):
    course_code = models.CharField(max_length=15, primary_key=True)
    title = models.CharField(max_length=100)
    coordinator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

class Enrollment(models.Model):
    enrollment_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    allocation = models.ForeignKey(CourseAllocation, on_delete=models.DO_NOTHING)
```

---

## Frontend Service Implementation

The frontend uses `/src/services/statisticsService.ts` with the following functions:

- `fetchAccessibleCourses()` - Uses `/api/stats/dashboard/data/`
- `fetchCourseStatistics(courseCode)` - Aggregates data from multiple endpoints
- `fetchGrievanceStats(courseCode)` - Uses `/api/stats/grievances/`
- `fetchScoresData(courseCode)` - Uses `/api/stats/scores/`
- `fetchStudentsInRange(courseCode, min, max)` - Uses `/api/stats/students/`

---

## Frontend Feature Features

### Implemented ✅
1. Course selector dropdown
2. Section-wise statistics table
3. Expandable section details with:
   - Total students count
   - Checking progress with progress bar
   - Marking progress with progress bar
   - Grievance count
   - Grievance details table
4. Theme toggle and logout functionality
5. Loading states and error handling
6. Permission check for course coordinators

### Current Limitations 🔄
- Uses mock data for paper evaluation status (PENDING, IN_PROGRESS, COMPLETED)
- Grievance details are generated from mock data
- Section names are extracted from existing endpoints

---

## Testing and Validation

### Manual Testing Steps
1. Login as a user with `is_coursecoordinator=true`
2. Navigate to Faculty Dashboard
3. Click "Statistics" button
4. Select different courses from dropdown
5. Click "View Details" on any section
6. Verify progress bars and grievance details display correctly

### Postman/API Testing
```bash
# Test course list endpoint
GET /api/stats/dashboard/data/
Headers: Authentication (cookie-based)

# Test grievances endpoint
GET /api/stats/grievances/?course_code=CS101
Headers: Authentication

# Test scores endpoint
GET /api/stats/scores/?course_code=CS101
Headers: Authentication
```

---

## Security Considerations

1. **Permission Checks**: Only coordinators of a course should see stats for that course
2. **Use Field-Level Filtering**: Filter queries by coordinator from Course model or User role
3. **Rate Limiting**: Consider rate limiting on stats endpoints
4. **Audit Logging**: Optional - log access to sensitive statistics

---

## Dependencies

- Django REST Framework (existing)
- Database models: Course, CourseAllocation, ExamPaper, Grievance, Enrollment, User
- Frontend: React Router, TypeScript, Tailwind CSS

---

## Future Enhancements

1. **Export to CSV/PDF**: Allow coordinators to export section statistics
2. **Time-based Charts**: Show grading progress over time
3. **Comparison**: Compare statistics across sections
4. **Email Notifications**: Alert coordinator about pending grievances
5. **Analytics Dashboard**: Add charts and visualizations using Chart.js or D3.js
6. **Bulk Operations**: Allow coordinators to bulk-approve or reject grievances

---

## Notes

- The frontend currently uses mock data for paper evaluation status breakdown
- Real data integration will require the recommended backend enhancements
- All endpoints require `IsAuthenticated` permission
- Use `@permission_classes([IsAuthenticated])` for all new endpoints
