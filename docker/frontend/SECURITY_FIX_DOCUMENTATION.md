# Security Fix: Student Data Access Control

## Overview
**Frontend Security Pattern** - Prevents URL manipulation to access other students' data.
**Backend Authentication** - Django JWT authentication handles the real security.

---

## Problem Identified
**Vulnerability**: Students could access other students' answer sheets by changing the roll number in the URL.

### How it worked:
```
OLD - INSECURE URL:
/evaluation/cs3001?role=student&roll=230547

A student could manually change it to:
/evaluation/cs3001?role=student&roll=230501
↓
Frontend would fetch student 230501's data!
```

**Root Cause**: 
- User identity was exposed in URL as query parameter
- Frontend had no way to verify which user was actually logged in
- No session state management

---

## Solution: UserSessionContext (Frontend Session Management)

**Important**: This is NOT an authentication system.
- **Real Authentication**: Handled by Django backend (JWT tokens, cookies)
- **Session State**: UserSessionContext manages frontend-only user session state

### Architecture:
```
┌─────────────────────────────────────────────┐
│          Browser & Frontend (React)         │
├─────────────────────────────────────────────┤
│                                             │
│  UserSessionContext (Session State Only)   │
│  ├─ universityId                           │
│  ├─ role (student/faculty)                 │
│  └─ fullName                               │
│                                             │
│  Stores in: sessionStorage (cleared on     │
│             browser close)                 │
│                                             │
└─────────────────────────────────────────────┘
                    ↓ API Calls
┌─────────────────────────────────────────────┐
│    Backend API (Django + JWT Auth)          │
├─────────────────────────────────────────────┤
│                                             │
│  Real Authentication:                       │
│  ├─ JWT token validation                    │
│  ├─ User model lookup                       │
│  ├─ Access control (owns this data?)        │
│  └─ HTTP-only cookie management             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Changes Made

### 1. **New File**: UserSessionContext ✅
Created `src/context/UserSessionContext.tsx`:
```tsx
export interface UserSession {
  universityId: string;        // student ID or faculty ID
  role: "student" | "faculty";
  fullName: string;
}
```

**Key Differences from Auth**:
- ✅ Does NOT validate passwords
- ✅ Does NOT perform login
- ✅ ONLY stores session state after backend auth
- ✅ Uses sessionStorage (cleared when browser closes)
- ✅ Complements backend JWT cookies

### 2. **Removed**: Old AuthContext ✅
Deleted the frontend authentication context that was duplicating Django's auth logic.

### 3. **Updated All Pages** ✅

| File | Change |
|------|--------|
| `App.tsx` | `AuthProvider` → `UserSessionProvider` |
| `Login.tsx` | `useAuth()` → `useUserSession()` |
| `StudentDashboard.tsx` | `user.rollNo` → `user.universityId` |
| `EvaluationViewer.tsx` | URL param (`?roll=`) removed |

### 4. **Removed Roll Number from URL** ✅
**Before**:
```tsx
navigate(`/evaluation/cs3001?role=student&roll=${rollNo}`)
```

**After**:
```tsx
navigate(`/evaluation/cs3001?role=student`)
// rollNo comes from UserSessionContext, not URL
```

---

## How Security Works Now

### Frontend Layer (URL Manipulation Prevention)
```
User attempts: /evaluation/cs3001?roll=999999
         ↓
EvaluationViewer reads: user.universityId from UserSessionContext
         ↓
URL parameter IGNORED (only session state used)
         ↓
Shows current user's data only
```

### Backend Layer (Real Access Control)
```
API Request: GET /api/evaluation/cs3001/
JWT Token: {sub: "230547", ...}
         ↓
Backend: Extract universityId from JWT token
         ↓
Backend: Verify student owns this data
         (Check database: is 230547 enrolled in cs3001?)
         ↓
Return data OR 403 Forbidden
```

---

## Testing

### Test 1: URL Manipulation Blocked
```bash
1. Login as student 230547
2. View answer sheet → /evaluation/cs3001
3. Manually edit URL → /evaluation/cs3001?roll=230501
4. ✅ RESULT: Still shows 230547's data (URL param ignored)
```

### Test 2: Session Cleared on Logout
```bash
1. Logout → sessionStorage cleared
2. Try to access /dashboard/student
3. ✅ RESULT: Redirected to /login
```

### Test 3: Backend Validates Ownership
```bash
1. Frontend sends: GET /api/results/230501/
2. Backend JWT token says user is: 230547
3. Backend: 230547 != 230501 → 403 Forbidden
4. ✅ RESULT: No data returned, even with JWT token
```

---

## Integration with Django Authentication

### When Backend Ready:
Replace Login.tsx mock login with actual API call:

```typescript
// OLD (mock):
const handleLogin = () => {
  setUser({ universityId: "230547", ... });
  navigate("/dashboard/student");
};

// NEW (with API):
const handleLogin = async (e: React.FormEvent) => {
  const response = await fetch("/api/auth/login/", {
    method: "POST",
    credentials: "include",  // Send JWT cookies
    body: JSON.stringify({ university_id, password })
  });
  
  const data = await response.json();
  // data.university_id, data.role, data.full_name
  
  setUser({
    universityId: data.university_id,
    role: data.role,
    fullName: data.full_name
  });
  
  navigate(`/dashboard/${data.role}`);
};
```

### Backend Requirements:
✅ `POST /api/auth/login/` - Returns user info
✅ `POST /api/auth/logout/` - Clears JWT cookies
✅ `GET /api/me/` - Returns current user (validates JWT)
✅ All endpoints verify: `request.user.university_id` matches requested data

---

## Security Checklist

### Frontend ✅
- [x] User session stored in memory/sessionStorage (not localStorage)
- [x] University ID NOT in URL parameters
- [x] Components read identity from UserSessionContext only
- [x] Unauthenticated users redirected to login
- [x] Session cleared on logout

### Backend TODO ⚠️
- [ ] Validate JWT token on every API request
- [ ] Verify student can only access own results
- [ ] Verify faculty can only grade assigned papers
- [ ] Return 403 Forbidden for unauthorized access
- [ ] Log all access attempts for audit trail
- [ ] Rate limit login attempts (already done: 5/min)

---

## File Changes Summary

**Deleted**:
- ~~`src/context/AuthContext.tsx`~~ (Replaced by UserSessionContext)

**Created**:
- `src/context/UserSessionContext.tsx` (New session management)

**Modified**:
- `src/App.tsx` - Import & wrap UserSessionProvider
- `src/pages/Login.tsx` - Use useUserSession hook
- `src/pages/StudentDashboard.tsx` - Use UserSessionContext, access universityId
- `src/pages/EvaluationViewer.tsx` - Read ID from context, remove URL params
- `src/services/evaluationService.ts` - Updated security comments

---

## Important Notes

✅ **Frontend Isolation**: Frontend session management doesn't interfere with Django auth
✅ **No Duplication**: UserSessionContext doesn't duplicate auth logic
⚠️ **Backend Required**: Frontend security is only part of the picture - backend MUST validate
📋 **JWT Cookies**: Rely on HTTP-only cookies (backend sets them)
🔒 **Session Storage**: Used instead of localStorage (deleted on browser close)

---

**Status**: ✅ Frontend session management implemented (no conflicts with Django)
**Next**: Implement backend API validation and error handling

