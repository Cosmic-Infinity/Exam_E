# Authentication & Access Control Architecture

This document explains how the Exam_E system handles user authentication and role-based access control (RBAC).

---

## **System Overview**

The application uses a **three-layer authentication model**:

1. **JWT Token Authentication** - Stateless identity verification
2. **Role-Based Permission Classes** - REST API endpoint access control
3. **Database Course Lookup** - Fine-grained course-level authorization

---

## **1. Authentication Flow**

### **Login Process**

```
┌─────────────────────────────────────────┐
│ User Login: POST /api/auth/login/       │
│ Body: { email, password }               │
└───────────────────┬─────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │ EmailBackend Authentication│
        │ Look up user by email     │
        │ Validate password         │
        └───────────────┬───────────┘
                        ↓
            ┌──────────────────────────┐
            │ Generate JWT + Claims    │
            │ + university_id          │
            │ + full_name              │
            │ + role (STUDENT/TEACHER/ │
            │        CONTROLLER)       │
            └──────────┬───────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ Set HttpOnly Cookies         │
        │ access_token (15 mins)       │
        │ refresh_token (1 day)        │
        └──────────────────────────────┘
```

**Implementation**: [core/api/auth.py - LoginView](../docker/backend/core/api/auth.py#L25-L84)

### **Authentication Backends**

**[core/api/authentication.py](../docker/backend/core/api/authentication.py)**

#### **EmailBackend**

- Authenticates users by email instead of username
- Maps to Django's `authenticate()` function
- Used by LoginView and other forms

#### **CookieJWTAuthentication**

- Extends DRF's JWTAuthentication
- Reads `access_token` from HttpOnly cookie (preferred for React frontend)
- Falls back to `Authorization: Bearer <token>` header for mobile/Postman clients
- Validates JWT signature and expiration

---

## **2. JWT Token Structure**

### **Token Payload**

```json
{
  "sub": 1,
  "iat": 1708723200,
  "exp": 1708724100,
  "refresh_exp": 1708809600,
  "university_id": "2305128",
  "full_name": "Alice Smith",
  "role": "STUDENT"
}
```

**Key Claims**:

- `role` - User's role (STUDENT, TEACHER, CONTROLLER)
- `university_id` - Institutional ID for audit trails
- `full_name` - Display name for UI

**Implementation**: [core/api/serializers.py - CustomTokenObtainPairSerializer](../docker/backend/core/api/serializers.py#L7-L28)

### **Configuration**

**[config/settings.py - SIMPLE_JWT](../docker/backend/config/settings.py#L130-L145)**

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SECURE': _COOKIE_SECURE,  # True in production (HTTPS only)
    'AUTH_COOKIE_SAMESITE': 'Lax',
}
```

### **Cookie Security**

| Setting         |    Value    |            Purpose             |
| --------------- | :---------: | :----------------------------: |
| **HttpOnly**    |    True     | Prevents JavaScript XSS access |
| **Secure**      | True (prod) |      Only sent over HTTPS      |
| **SameSite**    |     Lax     |     Prevents CSRF attacks      |
| **Access TTL**  |   15 min    |  Minimize exposure if stolen   |
| **Refresh TTL** |    1 day    |   Practical session duration   |

---

## **3. Role-Based Access Control (RBAC)**

### **User Roles**

The system has **3 active roles**:

#### **STUDENT**

- Can access personal data only
- View enrolled courses
- View graded exam papers
- Submit grievances
- **Cannot**: Access statistics, grade papers, manage courses

#### **TEACHER**

- **Base Functionality**:
  - Access assigned course allocations
  - Grade exam papers for their courses
  - Resolve student grievances
- **As Course Coordinator** (if linked via `Course.coordinator_id`):
  - Read-only access to statistics dashboard for that course
  - View course-level grievance metrics
- **Cannot**: View other courses, access global statistics

#### **CONTROLLER** (Controller of Examination)

- **Superset of TEACHER**: Can do everything a TEACHER can do
- **Direct Teaching** (if assigned to courses via `CourseAllocation.teacher`):
  - Grade exam papers for assigned courses
  - Resolve student grievances for assigned courses
  - Access allocated course sections via teacher portal
- **Global Oversight** (always available):
  - Access statistics dashboard for **ALL courses** (not just assigned ones)
  - View system-wide grievance metrics
  - Monitor exam progress across all sections
- **Typical Role**: Examination committee head with oversight authority
- **Key Feature**: Sees ALL courses in statistics dashboard, even when not directly teaching them

#### **SYSTEM ADMIN** (Not a role, but status)

- Identified by: `is_staff=True` + `is_superuser=True` flags
- Access: Django Admin Panel only (`/admin/`)
- Do NOT interact with exam evaluation workflow
- Responsible for: User management, database maintenance, data imports

---

### **Permission Classes**

**[core/api/permissions.py](../docker/backend/core/api/permissions.py)**

#### **IsTeacher**

```python
class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('TEACHER', 'CONTROLLER')
```

**Allows**: TEACHER + CONTROLLER  
**Use Case**: Teacher portal endpoints (grading, allocations)

#### **IsStudent**

```python
class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'STUDENT'
```

**Allows**: STUDENT only  
**Use Case**: Student portal endpoints (results, grievances)

#### **IsController**

```python
class IsController(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'CONTROLLER'
```

**Allows**: CONTROLLER only  
**Use Case**: Global statistics endpoints

---

### **Course-Level Access Control**

Statistics and grading require additional authorization based on course assignment.

**[core/api/stats.py - \_get_api_accessible_courses()](../docker/backend/core/api/stats.py#L11-L21)**

```python
def _get_api_accessible_courses(user):
    """
    Returns courses accessible to user for statistics.
    """
  if user.role == 'CONTROLLER':
        return Course.objects.all()  # See all courses
    elif user.role == 'TEACHER':
        # Only courses where this teacher is the coordinator
        return Course.objects.filter(coordinator=user)
    return Course.objects.none()  # STUDENT: no courses
```

**Access Determination**:

- **CONTROLLER** → ALL courses (global view) + any directly-assigned courses (direct teaching) → Global statistics dashboard
  - Can view statistics for every course in the system
  - If also assigned to teach specific courses, can grade those papers
- **TEACHER** → Courses where `Course.coordinator_id = user_id` (restricted view) + any assigned courses → Course-specific statistics
  - Can only view statistics for courses they explicitly coordinate
  - If assigned to teach specific courses, can grade those papers
- **STUDENT** → No courses → No statistics access
- **DJANGO ADMIN (`is_staff`)** → Admin statistics dashboard and admin stats APIs only (`/admin/stats/*`)

---

## **4. Endpoint Authorization**

### **Authentication Endpoints**

| Endpoint             | Method |   Permission    |  Auth Required   |
| -------------------- | :----: | :-------------: | :--------------: |
| `/api/auth/login/`   |  POST  |      None       |        No        |
| `/api/token/`        |  POST  |      None       |        No        |
| `/api/auth/logout/`  |  POST  | IsAuthenticated |       Yes        |
| `/api/auth/refresh/` |  POST  |       ---       | Cookie or header |
| `/api/me/`           |  GET   | IsAuthenticated |       Yes        |

`/api/token/` accepts `{ "email", "password" }` only.

### **Teacher Portal**

All require `[IsAuthenticated, IsTeacher]`

| Endpoint                               | Method  |       Role(s)       |              Purpose               |
| -------------------------------------- | :-----: | :-----------------: | :--------------------------------: |
| `/api/teacher/allocations/`            |   GET   | TEACHER, CONTROLLER | List courses assigned as teacher\* |
| `/api/teacher/exams/{id}/`             |   GET   | TEACHER, CONTROLLER |       List exams for course        |
| `/api/teacher/papers/`                 |   GET   | TEACHER, CONTROLLER |        List papers to grade        |
| `/api/teacher/paper/{id}/`             | GET/PUT | TEACHER, CONTROLLER |     View/grade specific paper      |
| `/api/teacher/grievances/`             |   GET   | TEACHER, CONTROLLER | List OPEN grievances by filter     |
| `/api/teacher/grievances/stats/`       |   GET   | TEACHER, CONTROLLER | Grievance summary and section load |
| `/api/teacher/grievances/{id}/decision/` |  POST | TEACHER, CONTROLLER | Resolve or reject grievance        |

**Security**:
- Paper access remains filtered by `exam__allocation__teacher = request.user`.
- Grievance list visibility is role-scoped:
  - TEACHER: own sections + grievances assigned to them.
  - TEACHER (course coordinator): all sections for coordinated courses.
  - CONTROLLER: all sections for all courses.
- Grievance content fields (`student_comment`, `grievance_type`, `grievance_type_label`) are returned only for assigned faculty, course coordinators of that course, or controller.
- Grievance decisions are allowed only for assigned faculty.

\*For CONTROLLERs, this shows courses where they are directly assigned as a teacher via `CourseAllocation.teacher`, separate from their global oversight access to all courses' statistics.

### **Student Portal**

All require `[IsAuthenticated, IsStudent]`

| Endpoint                    | Method | Role(s) |          Purpose           |
| --------------------------- | :----: | :-----: | :------------------------: |
| `/api/student/enrollments/` |  GET   | STUDENT |   List enrolled courses    |
| `/api/student/papers/`      |  GET   | STUDENT |     List graded papers     |
| `/api/student/paper/{id}/`  |  GET   | STUDENT | View specific paper result |
| `/api/student/grievances/`  |  GET   | STUDENT | List grievance history      |
| `/api/student/grievance/`   |  POST  | STUDENT |      Submit grievance      |

**Security**: Data filtered by `enrollment__student = request.user`

### **Statistics APIs**

All require `[IsAuthenticated, CanAccessStatistics]` + course access checks for specific course filters

| Endpoint                     | Method |        Role(s)         |          Scope          |
| ---------------------------- | :----: | :--------------------: | :---------------------: |
| `/api/stats/dashboard/data/` |  GET   | TEACHER\* / CONTROLLER | Accessible courses list |
| `/api/stats/subjects/`       |  GET   | TEACHER\* / CONTROLLER |     Course catalog      |
| `/api/stats/sections/`       |  GET   | TEACHER\* / CONTROLLER |     Course sections     |
| `/api/stats/grievances/`     |  GET   | TEACHER\* / CONTROLLER |    Grievance metrics    |
| `/api/stats/scores/`         |  GET   | TEACHER\* / CONTROLLER |   Score distribution    |

\*TEACHER must be course coordinator

Admin dashboard endpoints (Django admin only):
- `/admin/stats/`
- `/admin/stats/api/grievances/`
- `/admin/stats/api/scores/`
- `/admin/stats/api/students/`

Isolation guarantee:
- `/admin/stats/*` endpoints are staff-session endpoints for Django Admin.
- `/api/stats/*` endpoints are frontend application-role endpoints (`CONTROLLER` or coordinator `TEACHER`) and do not reuse admin-only authorization.

---

## **5. Frontend Integration**

### **User Session Context**

**[frontend/src/app/context/UserSessionContext.tsx](../docker/frontend/src/app/context/UserSessionContext.tsx)**

```tsx
interface UserSession {
  universityId: string;
  role: "student" | "faculty"; // Derived role
  fullName: string;
  backendRole?: string; // Raw: STUDENT | TEACHER | CONTROLLER
  isCourseCoordinator?: boolean; // Derived from backend coordinator mapping
  isController?: boolean; // backendRole === "CONTROLLER"
}
```

Current behavior (March 2026):
- On app load, frontend restores `sessionStorage` state first for fast UX.
- It then validates against backend via `GET /api/me/`.
- If `/api/me/` returns `401`, frontend treats it as "no active session", clears stale sessionStorage, and redirects users through normal login flow.

### **Protected Routes**

**[frontend/src/App.tsx](../docker/frontend/src/App.tsx)**

```tsx
<ProtectedRoute allowedRoles={["faculty"]} requireCoordinator>
  <StatisticsPage />
</ProtectedRoute>
```

**Route Guards**:

- Check `user.role` before rendering
- Redirect unauthorized users to appropriate dashboard
- Show/hide features based on `isCourseCoordinator` / `isController`

- Route paths are shared between desktop and mobile; `App.tsx` selects mobile components dynamically based on device heuristics.

---

## **6. Security Measures**

### **Token Security**

- **HttpOnly Cookies**: Prevents client-side script access (XSS mitigation)  
- **Secure Flag**: Enforces HTTPS transmission in production environments  
- **SameSite**: Mitigates Cross-Site Request Forgery (CSRF)  
- **Short TTL**: Limits access token lifetime to 15 minutes  
- **Refresh Rotation**: Issues new refresh tokens upon each refresh cycle  
- **Blacklist**: Explicitly revokes active tokens on user logout  

### **Request Validation**

- **Role in JWT Claims**: Avoids database lookups on standard authenticated requests  
- **Permission Classes**: Django REST framework enforces RBAC at the view layer  
- **Course Lookups**: Enforces coordinator-level verification for subject analytics  
- **User Isolation**: Scopes record queries directly to `request.user`

### **Login Abuse Protection (Shared-Network Safe)**

The login endpoint uses account-based protection in `core/api/auth_security.py` instead of strict per-IP throttling. This avoids blocking legitimate users behind campus NAT or shared Wi-Fi.

Current behavior:

- Failed attempts are tracked per email/username in Redis
- Account lockout starts after 10 consecutive failures
- Lockout duration is 15 minutes (auto-expiry)
- Progressive response delays begin after 3 failures: 2s, 5s, then 10s
- Successful login clears both failure counters and lock status

HTTP responses during login:

- `200`: Login successful
- `400`: Missing email or password
- `401`: Invalid credentials
- `403`: Account temporarily locked (both desktop and mobile clients handle this as lockout feedback)

### **Database Constraints**

**[docker/init_db.sql - users table](../docker/init_db.sql#L388)**

```sql
CONSTRAINT users_role_check CHECK (
    role IN ('STUDENT', 'TEACHER', 'CONTROLLER')
)
```

---

## **7. Authorization Workflow Example**

### **Scenario: Teacher grading a paper**

```
1. Frontend calls: PUT /api/teacher/paper/101/
   With: JWT access_token in HttpOnly cookie

2. CookieJWTAuthentication:
   ├─ Extract cookie
   ├─ Validate signature
   ├─ Check expiration
   └─ Return user object + token

3. IsAuthenticated + IsTeacher:
   ├─ Verify user.is_authenticated
   ├─ Verify user.role in ('TEACHER', 'CONTROLLER')
   └─ Continue to view

4. TeacherPaperDetailView.get_queryset():
   └─ Filter: exam__allocation__teacher = request.user
   └─ Prevents teacher accessing other's papers

5. Business Logic:
   ├─ Grade the paper
  ├─ Save v3 marks_json (expected marks + awarded marks), total_score
  ├─ Normalize blank awarded inputs to 0 on save
   └─ Update evaluation_status

6. Response: 200 OK with updated paper data
```

---

## **8. Login Flow (Step-by-Step)**

### **User Perspective**

```
1. User enters email + password
2. Frontend: POST /api/auth/login/
3. Backend: Validates credentials
4. Backend: Generates JWT token with claims
5. Backend: Sets HttpOnly cookies
6. Frontend: Stores session in sessionStorage
7. Frontend: Redirects to dashboard (student/faculty)
8. Dashboard: Calls GET /api/me/ to confirm role
9. Dashboard: Renders role-appropriate UI
```

### **Backend Processing**

```python
# [auth.py - LoginView.post()]
user = authenticate(request, username=email, password=password)
if user is None or not user.is_active:
    return 401 Unauthorized

refresh = RefreshToken.for_user(user)
refresh['university_id'] = user.university_id
refresh['full_name'] = user.full_name
refresh['role'] = user.role  # ← Role embedded in JWT

response = Response({
    'role': user.role,  # ← Also returned in body to frontend
    'university_id': user.university_id,
    'full_name': user.full_name,
})
_set_auth_cookies(response, str(refresh.access_token), str(refresh))
return response
```

---

## **9. Refresh Token Rotation**

To prevent token theft, refresh tokens are automatically rotated:

```python
SIMPLE_JWT = {
    'ROTATE_REFRESH_TOKENS': True,      # New token on each refresh
    'BLACKLIST_AFTER_ROTATION': True,   # Invalidate old token
}
```

**Rotation Flow**:

```
1. Frontend calls: POST /api/auth/refresh/
   With: refresh_token cookie

2. Backend validates refresh token

3. Backend generates new refresh token

4. Backend blacklists old refresh token

5. Backend returns new access_token + refresh_token

6. Frontend updates cookies with new tokens
```

---

## **10. Configuration Reference**

### **Settings**

**[config/settings.py](../docker/backend/config/settings.py)**

```python
# Authentication backends (tried in order)
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'core.api.authentication.EmailBackend',
]

# REST Framework defaults
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.api.authentication.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}
```

### **CORS & Security**

```python
CORS_ALLOWED_ORIGINS = ['http://localhost:8080']
CSRF_TRUSTED_ORIGINS = ['http://localhost']
CORS_ALLOW_CREDENTIALS = True  # Allow cookies with CORS

# Production security headers
SECURE_SSL_REDIRECT = True (if DEBUG=False)
SECURE_HSTS_SECONDS = 31536000
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
```

---

## **11. Troubleshooting**

### **Issue: "Permission denied" on stats endpoint**

**Cause**: TEACHER accessing stats for course they don't coordinate

**Fix**: Ensure `Course.coordinator_id` is set for this teacher in Django Admin

### **Issue: Token expired/invalid**

**Cause**: Access token expired (15 min) or tampered

**Fix**: Frontend automatically calls `POST /api/auth/refresh/` to get new access token

### **Issue: CORS errors accessing API**

**Cause**: Frontend origin not in `CORS_ALLOWED_ORIGINS`

**Fix**: Add frontend URL to settings or docker-compose env

### **Issue: Cookies not being set**

**Cause**:

- SECURE flag too strict in development
- SameSite policy blocking cookie storage

**Fix**: Set `COOKIE_SECURE=0` in development, ensure frontend is same origin or Lax SameSite

---

## **CONTROLLER's Dual Role System**

### **Overview**

The CONTROLLER role embodies a dual responsibility model within the examination administration system:

1. **Direct Teaching Authority** (Course-Level)
   - CONTROLLERs can be assigned as teachers to specific courses via `CourseAllocation.teacher = controller_user`
   - When assigned to a course, they inherit all TEACHER capabilities for that course:
     - Grade exam papers for the course
     - Resolve student grievances for the course
     - View exam details and student submissions
   - Access: `/api/teacher/allocations/` endpoint filters by `teacher=request.user`, including CONTROLLER assignments

2. **Global Oversight Authority** (System-Level)
   - CONTROLLERs always have access to the institution-wide statistics dashboard
   - Can view examination metrics for **ALL courses**, regardless of direct teaching assignments
   - Permission: Bypasses the `Course.coordinator_id` filter that restricts TEACHERs
   - Provides examination committee-level visibility across the entire institution

### **Implementation Details**

**Permission Classes** → `IsTeacher` allows both TEACHER and CONTROLLER roles:

```python
class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('TEACHER', 'CONTROLLER')
```

**Course Access Logic** → Two separate mechanisms:

```python
# Teacher endpoints: Filter by direct assignment
CourseAllocation.objects.filter(teacher=request.user)  # Works for CONTROLLER too

# Statistics endpoints: CONTROLLER gets all courses
def _get_accessible_courses(user):
    if user.role == 'CONTROLLER':
        return Course.objects.all()
    elif user.role == 'TEACHER':
        return Course.objects.filter(coordinator=user)
```

### **Example Scenario**

A CONTROLLER named "Dr. Smith" who examines 5 courses:

| Action                              | Result                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| Assigned as teacher to Courses A, B | Can grade papers for A, B via `/api/teacher/allocations/` |
| View statistics dashboard           | Can see metrics for ALL 5 courses (A, B, C, D, E)         |
| Resolve grievances                  | Can resolve for A, B (direct assignment)                  |
| Monitor exam progress               | Can see progress for entire system (global oversight)     |

### **Design Rationale**

- **Why dual role?** Allows examination committees to maintain both course-specific evaluation duties AND institution-wide monitoring
- **Why not merge with TEACHER?** TEACHER role limited to course coordinators for privacy; CONTROLLER always has global view
- **Why allow CourseAllocation assignment?** Reduces need for separate User type; leverages existing permission infrastructure

---

## **Key Principles**

1. **Stateless Authentication** - No session table needed
2. **Role in Token** - No database lookup on every request
3. **Layered Authorization** - Permission class + database lookup
4. **Least Privilege** - Each role has minimum required permissions
5. **Defense in Depth** - Multiple security mechanisms (cookies, CSRF, rate limits, role checks)

---

## **File References**

| File                                                                                              |                Purpose                |
| ------------------------------------------------------------------------------------------------- | :-----------------------------------: |
| [core/api/authentication.py](../docker/backend/core/api/authentication.py)                           |      JWT + Cookie auth backends       |
| [core/api/permissions.py](../docker/backend/core/api/permissions.py)                                 |        RBAC permission classes        |
| [core/api/auth.py](../docker/backend/core/api/auth.py)                                               |    Login, logout, token endpoints     |
| [core/api/serializers.py](../docker/backend/core/api/serializers.py)                                 |       JWT payload customization       |
| [core/api/teacher.py](../docker/backend/core/api/teacher.py)                                         |       Teacher portal endpoints        |
| [core/api/student.py](../docker/backend/core/api/student.py)                                         |       Student portal endpoints        |
| [core/api/stats.py](../docker/backend/core/api/stats.py)                                             | Statistics APIs + course access logic |
| [config/settings.py](../docker/backend/config/settings.py)                                           |       JWT + CORS configuration        |
| [config/urls.py](../docker/backend/config/urls.py)                                                   |         API route definitions         |
| [frontend/src/app/context/UserSessionContext.tsx](../docker/frontend/src/app/context/UserSessionContext.tsx) |      Frontend user session state      |
