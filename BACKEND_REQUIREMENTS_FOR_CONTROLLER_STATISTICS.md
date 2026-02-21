# Backend Requirements for Controller Statistics Feature

## Overview
This document outlines the backend API endpoints and data structures required to fully support the Controller Statistics feature in the frontend. Controllers have institution-wide access to view statistics organized hierarchically by semester, subject, and section.

## Current Status
- **Frontend Implementation**: ✅ Complete
- **Backend Integration**: ⚠️ Partial (using existing endpoints where available + mock data fallback)
- **Recommended Backend Enhancements**: 📋 Listed below

---

## Frontend Feature Description
When a user with `role='CONTROLLER'` logs in, they see a "Controller Statistics" button on the Faculty Dashboard. Clicking this button navigates to the Controller Statistics Page which displays data in the following hierarchy:

### Level 1: Semesters
Users see a grid of semesters showing:
- Semester number
- Total courses
- Total students
- Number of subjects

### Level 2: Subjects (by Semester)
After selecting a semester, users see a table of all subjects/courses for that semester with:
- Course code
- Course title
- Number of sections
- Total students enrolled
- Total grievances count

### Level 3: Sections (by Subject)
After selecting a subject, users see a table of sections for that subject with:
- Section name
- Total students
- Checking progress (count and percentage)
- Marking progress (count and percentage)
- Grievance count

### Level 4: Details (by Section)
Expanding a section shows:
- Detailed progress statistics cards with progress bars
- Grievance details table with:
  - Student ID
  - Student name
  - Roll number
  - Grievance type

---

## Current Backend Integration

### Existing Endpoints Being Used

#### 1. `/api/stats/grievances/?course_code=CS101` (GET)
**Status**: ✅ Working - Reused for sections/grievances data

#### 2. `/api/stats/scores/?course_code=CS101` (GET)
**Status**: ✅ Working - Reused for evaluation status data

#### 3. `/api/stats/students/?course_code=CS101&min=0&max=100` (GET)
**Status**: ✅ Working - Reused for student details

---

## Recommended New Endpoints

### ⭐ Priority 1: Semesters Endpoint

**Path**: `GET /api/stats/semesters/`

**Purpose**: Fetch all semesters with their statistics (Controller only)

**Required Response Structure**:
```json
[
  {
    "semester": 1,
    "totalCourses": 5,
    "totalStudents": 300,
    "subjectsCount": 5
  },
  {
    "semester": 2,
    "totalCourses": 5,
    "totalStudents": 280,
    "subjectsCount": 5
  }
]
```

**Implementation Notes**:
- Should only be accessible to Controllers (`user.role == 'CONTROLLER'`)
- Count `Course` objects grouped by `CourseAllocation.semester`
- Count `Enrollment` objects per semester
- Get subject count from distinct `Course` objects per semester

**Sample Django Query**:
```python
from django.db.models import Count, Q
from core.models import CourseAllocation, AcademicSession

allocations = CourseAllocation.objects.filter(
    session__is_active=True
).values('semester').annotate(
    totalCourses=Count('course', distinct=True),
    totalStudents=Count('enrollment', distinct=True),
    subjectsCount=Count('course', distinct=True)
)
```

---

### ⭐ Priority 2: Subjects by Semester Endpoint

**Path**: `GET /api/stats/semesters/:semester/subjects/`

**Purpose**: Fetch all subjects/courses for a specific semester with statistics

**Required Response Structure**:
```json
[
  {
    "courseCode": "CS101",
    "courseTitle": "Introduction to Programming",
    "semester": 1,
    "sectionsCount": 3,
    "totalStudents": 90,
    "totalGrievances": 3
  },
  {
    "courseCode": "CS102",
    "courseTitle": "Data Structures",
    "semester": 1,
    "sectionsCount": 3,
    "totalStudents": 87,
    "totalGrievances": 2
  }
]
```

**Implementation Notes**:
- Filter `CourseAllocation` by semester
- Get distinct courses
- Count sections per course
- Count enrolled students per course
- Count grievances per course

**Sample Django Query**:
```python
from django.db.models import Count, Q
from core.models import CourseAllocation, Grievance, AcademicSession

semester = 1
allocations = CourseAllocation.objects.filter(
    semester=semester,
    session__is_active=True
).values(
    'course__course_code',
    'course__title'
).annotate(
    sectionsCount=Count('section_name', distinct=True),
    totalStudents=Count('enrollment', distinct=True),
    totalGrievances=Count('enrollment__paper__grievance', distinct=True)
).order_by('course__course_code')
```

---

### ⭐ Priority 3: Sections by Course Endpoint (Enhancement)

**Recommended Enhancement**: Extend existing `/api/stats/grievances/?course_code=CS101` 

**Add to Response**:
```json
{
  "chart_data": [
    {
      "label": "Section A",
      "count": 5,
      "totalStudents": 60,
      "checkingProgress": 45,
      "markingProgress": 30,
      "pendingProgress": 15,
      "grievanceDetails": [
        {
          "studentId": "STU001",
          "studentName": "Aarav Kumar",
          "rollNo": "001",
          "grievanceType": "Marking Error",
          "grievanceId": 123,
          "status": "OPEN"
        }
      ]
    }
  ]
}
```

**Implementation Notes**:
- Join `ExamPaper.evaluation_status` with `CourseAllocation.section_name`
- Group by section
- Count papers by status
- Include detailed grievance info

---

## Reference: Relevant Django Models

```python
# Key relationships for semester data:
# Course -> CourseAllocation (has semester field)
# CourseAllocation -> Enrollment -> ExamPaper -> Grievance
# CourseAllocation -> section_name (Section identifier)

class CourseAllocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.DO_NOTHING)
    section_name = models.CharField(max_length=10)
    session = models.ForeignKey(AcademicSession, on_delete=models.DO_NOTHING)
    semester = models.IntegerField()  # KEY: Semester identifier

class Enrollment(models.Model):
    enrollment_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    allocation = models.ForeignKey(CourseAllocation, on_delete=models.DO_NOTHING)

class ExamPaper(models.Model):
    paper_id = models.AutoField(primary_key=True)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.DO_NOTHING)
    evaluation_status = models.CharField(max_length=20, choices=[
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REVALUATION', 'Revaluation')
    ])

class Grievance(models.Model):
    id = models.AutoField(primary_key=True)
    paper = models.ForeignKey(ExamPaper, on_delete=models.DO_NOTHING)
    status = models.CharField(max_length=20)
```

---

## Frontend Service Implementation

The frontend uses `/src/services/controllerStatisticsService.ts` with the following functions:

- `fetchAllSemesters()` - Gets list of semesters (to be: `GET /api/stats/semesters/`)
- `fetchSubjectsBySemester(semester)` - Gets courses for a semester (to be: `GET /api/stats/semesters/{semester}/subjects/`)
- `fetchSectionsByCourse(courseCode)` - Gets sections (uses existing `/api/stats/grievances/`)
- `generateMockSemesters()` - Fallback mock data
- `generateMockSubjects(semester)` - Fallback mock data
- `generateMockSections()` - Fallback mock data

---

## Frontend Feature Features

### Implemented ✅
1. Hierarchical navigation: Semester → Subject → Section → Details
2. Breadcrumb navigation showing current location
3. Semester grid view with statistics
4. Subject table view with sorting
5. Section table view with detailed metrics
6. Expandable section details with:
   - Progress bars for checking and marking
   - Percentage calculations
   - Grievance count
   - Detailed grievance table
7. Permission check for Controllers only
8. Return to Faculty Dashboard functionality
9. Loading states and error handling
10. Fallback to mock data if backend endpoints unavailable

### Current Limitations 🔄
- Uses mock data for semester and subject hierarchy
- Paper evaluation status is generated from mock data
- Grievance details are generated from mock data

---

## API Endpoint Summary

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/stats/semesters/` | GET | ⚠️ Recommended | Fetch all semesters |
| `/api/stats/semesters/{semester}/subjects/` | GET | ⚠️ Recommended | Fetch subjects by semester |
| `/api/stats/grievances/?course_code=...` | GET | ✅ Existing | Fetch grievances (reused for sections) |
| `/api/stats/scores/?course_code=...` | GET | ✅ Existing | Fetch score distribution |

---

## Security Considerations

1. **Controller-Only Access**: Only users with `role='CONTROLLER'` should access these endpoints
2. **Institution-Wide Data**: Controllers can view all courses and sections
3. **Use Role-Based Filtering**: In views, ensure `user.role == 'CONTROLLER'` before returning data
4. **Audit Logging**: Optional - log controller access to sensitive institution data
5. **Rate Limiting**: Consider rate limiting on aggregation endpoints

---

## Django Implementation Example

```python
# core/api/stats.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count
from ..models import CourseAllocation, AcademicSession

class IsController(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'CONTROLLER'
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsController])
def list_semesters(request):
    """
    GET /api/stats/semesters/
    Returns all semesters with statistics
    """
    allocations = CourseAllocation.objects.filter(
        session__is_active=True
    ).values('semester').annotate(
        totalCourses=Count('course_id', distinct=True),
        totalStudents=Count('enrollment', distinct=True),
        subjectsCount=Count('course_id', distinct=True)
    ).order_by('semester')
    
    return Response(list(allocations))

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsController])
def list_subjects_by_semester(request, semester):
    """
    GET /api/stats/semesters/{semester}/subjects/
    Returns courses/subjects for a specific semester
    """
    allocations = CourseAllocation.objects.filter(
        semester=semester,
        session__is_active=True
    ).values(
        courseCode='course__course_code',
        courseTitle='course__title',
    ).annotate(
        sectionsCount=Count('section_name', distinct=True),
        totalStudents=Count('enrollment', distinct=True),
        totalGrievances=Count('enrollment__paper__grievance', distinct=True),
        semester=F('semester')
    ).order_by('course__course_code')
    
    return Response([
        {
            'courseCode': item['courseCode'],
            'courseTitle': item['courseTitle'],
            'semester': item['semester'],
            'sectionsCount': item['sectionsCount'],
            'totalStudents': item['totalStudents'],
            'totalGrievances': item['totalGrievances'],
        }
        for item in allocations
    ])
```

---

## Testing and Validation

### Manual Testing Steps
1. Login as a user with `role='CONTROLLER'`
2. Navigate to Faculty Dashboard
3. Click "Controller Statistics" button
4. Verify semesters are displayed
5. Click on a semester to see subjects
6. Click on a subject to see sections
7. Click "View Details" on a section to see detailed statistics

### API Testing Examples
```bash
# Test semesters endpoint
curl -X GET http://localhost:8000/api/stats/semesters/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Test subjects by semester
curl -X GET http://localhost:8000/api/stats/semesters/1/subjects/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Future Enhancements

1. **Comparison View**: Compare statistics across semesters
2. **Export Functionality**: Export semester/subject statistics to CSV/PDF
3. **Trend Analysis**: Show trends over time (multiple academic sessions)
4. **Detailed Filters**: Filter by course type, school, stream
5. **Performance Alerts**: Alert for sections with high grievance count
6. **Comparative Metrics**: Show performance metrics compared to institution average
7. **Customizable Reports**: Allow controllers to generate custom reports

---

## Notes

- Frontend currently uses mock data and will gracefully fall back if backend endpoints are unavailable
- The feature is designed to work incrementally - existing endpoints are reused where possible
- All endpoints require the Controller permission check
- Consider caching semester/subject data as they change infrequently
- The hierarchical structure mirrors the academic organization (Semester → Course → Section → Student)
