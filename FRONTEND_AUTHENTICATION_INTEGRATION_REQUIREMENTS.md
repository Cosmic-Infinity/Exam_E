# Frontend Authentication Integration Analysis & Requirements

## Current Implementation Status

### ✅ What's Working

1. **Backend Authentication System**
   - EmailBackend for email-based authentication
   - CookieJWTAuthentication for reading tokens from cookies
   - LoginView endpoint returns: `role`, `university_id`, `full_name`
   - HttpOnly cookies for access & refresh tokens
   - Token refresh mechanism via CookieTokenRefreshView
   - LogoutView clears cookies and blacklists tokens
   - MeView for fetching current user profile
   - Password change endpoint

2. **Frontend Session Management**
   - UserSessionContext stores user data in sessionStorage
   - Login page sends email + password to backend
   - User data persists during session
   - Logout clears session data
   - Theme toggle and route navigation working

3. **API Integration**
   - Login endpoint: `POST /api/auth/login/` ✅
   - Logout endpoint: `POST /api/auth/logout/` ✅ (not fully integrated)
   - Token refresh: `POST /api/auth/refresh/` ✅ (not integrated)
   - MeView endpoint: `GET /api/me/` ✅ (not integrated)
   - Password change: POST `/api/auth/password/change/` ✅ (not integrated)

---

## 🔴 Critical Issues Found

### Issue #1: Missing `is_coursecoordinator` in Login Response

**Problem:** Frontend expects `is_coursecoordinator` flag from backend LoginView, but backend doesn't return it.

**Current Backend Code (auth.py lines 65-76):**
```python
response = Response({
    'message': 'Login successful',
    'university_id': user.university_id,
    'full_name': user.full_name,
    'role': user.role,
})
```

**Frontend Expects (Login.tsx line 48):**
```tsx
isCourseCoordinator: data.is_coursecoordinator || false,
```

**Impact:** Course Coordinator Statistics button won't work properly

**Status:** ⚠️ NEEDS BACKEND UPDATE (but user said not to modify backend - see solution below)

---

### Issue #2: Incomplete Logout Implementation

**Problem:** Frontend logout only clears sessionStorage, doesn't call backend logout endpoint to invalidate tokens.

**Current Code (StudentDashboard.tsx line 65-69):**
```tsx
const handleLogout = () => {
  toast.dismiss();
  logout();  // Only clears context, doesn't call backend
  toast.success("Logged out successfully");
  navigate("/");
};
```

**What Should Happen:**
1. Call `POST /api/auth/logout/` to clear backend cookies
2. Clear frontend session storage
3. Redirect to login page

**Impact:** Tokens remain valid even after logout, security risk

**Status:** ❌ NEEDS FRONTEND FIX

---

### Issue #3: No Token Refresh on API Calls

**Problem:** If access token expires during a session, frontend doesn't automatically refresh it.

**Backend Provides:** `POST /api/auth/refresh/` endpoint

**Frontend Has:** No mechanism to intercept 401 errors and refresh tokens

**Impact:** Users get logged out unexpectedly without clear error message

**Status:** ❌ NEEDS FRONTEND IMPLEMENTATION

---

### Issue #4: No Protected Route Component

**Problem:** Any page can be accessed even if user isn't logged in.

**Example:** User can visit `/dashboard/faculty` directly without logging in first.

**Frontend Has:** No route protection wrapper

**Impact:** Unauthorized access to protected pages

**Status:** ❌ NEEDS FRONTEND IMPLEMENTATION

---

### Issue #5: No Session Recovery on Page Reload

**Problem:** User data loads from sessionStorage but no verification with backend.

**Current Code (UserSessionContext line 40-46):**
```tsx
useEffect(() => {
  const storedSession = sessionStorage.getItem("userSession");
  if (storedSession) {
    try {
      setUserState(JSON.parse(storedSession));  // No backend verification
    } catch (e) {
      console.error("Failed to restore user session", e);
    }
  }
}, []);
```

**What Should Happen:**
1. Load session from sessionStorage
2. Call `GET /api/me/` to verify session is still valid
3. If invalid (401), redirect to login

**Impact:** Stale session data, user thinks they're still logged in

**Status:** ⚠️ RECOMMENDED IMPLEMENTATION

---

### Issue #6: API Calls Don't Handle Auth Errors

**Problem:** No uniform error handling for 401/403 responses from API.

**Current Approach:** Each service makes individual fetch calls without error handling

**What Should Happen:**
- Global interceptor/middleware to handle auth errors
- Automatically redirect to login on 401
- Show user-friendly error messages

**Impact:** Authorization errors are silent or show generic messages

**Status:** ⚠️ RECOMMENDED IMPLEMENTATION

---

## ✅ Solutions & Front-End Changes

### Solution #1: Handle Missing `is_coursecoordinator` Flag

**Problem:** Backend doesn't return this flag in LoginView

**Frontend Solution (NOT waiting for backend):**
Instead of expecting `is_coursecoordinator` from LoginView, query `/api/me/` after login to fetch coordinates from teacher profile.

**Changes Needed:**
```typescript
// In Login.tsx handleLogin function:
setTimeout(async () => {
  const meResponse = await fetch("/api/me/", {
    credentials: "include"
  });
  if (meResponse.ok) {
    const userData = await meResponse.json();
    // userData.teacher_profile.is_coordinator would be available here
  }
}, 300);
```

**Recommended file:** Create `/src/services/authService.ts` for centralized auth operations

---

### Solution #2: Integrate Proper Logout

**Changes Needed in ALL dashboard pages:**

Replace all current handleLogout implementations with:
```typescript
const handleLogout = async () => {
  try {
    // Call backend logout to invalidate cookies
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Continue with local logout even if backend fails
  }
  
  // Clear local session
  logout();
  
  // Redirect
  toast.success("Logged out successfully");
  navigate("/");
};
```

**Files to Update:**
- `src/pages/StudentDashboard.tsx`
- `src/pages/FacultyDashboard.tsx`
- `src/pages/StatisticsPage.tsx`
- `src/pages/ControllerStatisticsPage.tsx`

---

### Solution #3: Implement Token Refresh

**New File: `/src/services/authService.ts`**

```typescript
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh/", {
      method: "POST",
      credentials: "include",  // Sends refresh_token cookie
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

export async function apiCall(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  // If 401, try refreshing token and retry
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(url, {
        ...options,
        credentials: "include",
      });
    }
  }

  // If still 401 after refresh, redirect to login
  if (response.status === 401) {
    window.location.href = "/";
  }

  return response;
}
```

**Update all services and components to use `apiCall()` helper instead of direct `fetch()`**

---

### Solution #4: Add Protected Route Component

**New File: `/src/components/ProtectedRoute.tsx`**

```typescript
import { Navigate } from "react-router-dom";
import { useUserSession } from "@/context/UserSessionContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "faculty";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isLoggedIn, user } = useUserSession();

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

**Update App.tsx routes:**
```tsx
<Route 
  path="/dashboard/student" 
  element={
    <ProtectedRoute requiredRole="student">
      <StudentDashboard />
    </ProtectedRoute>
  } 
/>
```

---

### Solution #5: Implement Session Verification on App Load

**Update `/src/context/UserSessionContext.tsx`**

```typescript
const [isVerifying, setIsVerifying] = useState(true);

useEffect(() => {
  const verifySession = async () => {
    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      try {
        setUserState(JSON.parse(storedSession));
        
        // Verify with backend
        const response = await fetch("/api/me/", {
          credentials: "include",
        });
        
        if (!response.ok) {
          // Session invalid, clear it
          setUserState(null);
          sessionStorage.removeItem("userSession");
        }
      } catch (e) {
        console.error("Failed to verify session", e);
        setUserState(null);
      }
    }
    setIsVerifying(false);
  };

  verifySession();
}, []);

// Show loading screen while verifying
if (isVerifying) {
  return <LoadingScreen />;
}
```

---

### Solution #6: Add Global Error Handling

**New File: `/src/lib/apiInterceptor.ts`**

```typescript
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  // Handle 401 - unauthorized
  if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch("/api/auth/refresh/", {
      method: "POST",
      credentials: "include",
    });

    if (refreshResponse.ok) {
      // Retry original request with new token
      return fetch(url, {
        ...options,
        credentials: "include",
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = "/";
      throw new Error("Session expired");
    }
  }

  // Handle 403 - forbidden
  if (response.status === 403) {
    throw new Error("You don't have permission to access this resource");
  }

  return response;
}
```

---

## 📋 Recommended Backend Changes (If Required)

If you can update the backend later, these changes would improve the system:

### 1. Include `is_coursecoordinator` in LoginView Response

**File:** `/core/api/auth.py` (LoginView)

```python
# Add after line 62 (after user authentication)
is_coursecoordinator = False
if hasattr(user, 'teacher_profile') and user.teacher_profile:
    is_coursecoordinator = user.teacher_profile.is_coordinator

# Then extend response
response = Response({
    'message': 'Login successful',
    'university_id': user.university_id,
    'full_name': user.full_name,
    'role': user.role,
    'is_coursecoordinator': is_coursecoordinator,  # ADD THIS
})
```

### 2. Verify Token Expiry Handling

Backend already handles this via `CookieJWTAuthentication`, just ensure frontend calls refresh properly.

### 3. Add CORS Headers (If Needed)

Ensure backend has proper CORS configuration for credentials:
```python
CORS_ALLOW_CREDENTIALS = True
```

---

## 🎯 Front-End Integration Checklist

### Phase 1: Critical (Security & Functionality)
- [ ] Create `/src/services/authService.ts` with `apiCall()` helper
- [ ] Update logout implementations in all dashboards
- [ ] Create `/src/components/ProtectedRoute.tsx`
- [ ] Update `App.tsx` routes with ProtectedRoute wrapper
- [ ] Update all API calls to use `apiCall()` instead of `fetch()`

### Phase 2: Important (User Experience)
- [ ] Implement session verification in `UserSessionContext`
- [ ] Create loading screen component
- [ ] Add token refresh mechanism
- [ ] Add 401 error handling globally

### Phase 3: Nice-to-Have
- [ ] Form validation improvements
- [ ] Remember email on login page
- [ ] Session expiry warning (optional)
- [ ] Improved error messages for auth failures

---

## 📁 Files That Will Be Created/Modified

### New Files to Create:
1. `/src/services/authService.ts`
2. `/src/components/ProtectedRoute.tsx`
3. `/src/lib/apiInterceptor.ts`
4. `/src/components/LoadingScreen.tsx`

### Files to Modify:
1. `/src/context/UserSessionContext.tsx`
2. `/src/App.tsx`
3. `/src/pages/StudentDashboard.tsx`
4. `/src/pages/FacultyDashboard.tsx`
5. `/src/pages/StatisticsPage.tsx`
6. `/src/pages/ControllerStatisticsPage.tsx`
7. `/src/services/evaluationService.ts`
8. `/src/services/statisticsService.ts`
9. `/src/services/controllerStatisticsService.ts`

---

## 🔗 Current API Endpoints Available

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/auth/login/` | POST | ❌ | ✅ Frontend OK, needs `is_coursecoordinator` |
| `/api/auth/logout/` | POST | ✅ | ⚠️ Frontend not calling it |
| `/api/auth/refresh/` | POST | ❌ | ❌ Frontend not implemented |
| `/api/me/` | GET | ✅ | ⚠️ Frontend not using it |
| `/api/auth/password/change/` | POST | ✅ | ❌ Not implemented in frontend |

---

## 🛡️ Security Improvements Summary

| Issue | Current | Recommended | Priority |
|-------|---------|-------------|----------|
| Logout | Only clears frontend | Calls backend + frontend | 🔴 Critical |
| Session expiry | No refresh | Auto-refresh on 401 | 🟠 High |
| Unprotected routes | Anyone can access | Route guards | 🔴 Critical |
| Token validation | Only on page load | Continuous verification | 🟠 High |
| Error handling | Silent failures | User-friendly messages | 🟡 Medium |

---

## Questions for Clarification

1. **Should we implement all changes or prioritize some?**
   - Recommended priority: Phase 1 (critical fixes) first

2. **Do you want session timeout warnings?**
   - Not required, but recommended for UX

3. **Should we add "Remember me" functionality?**
   - Optional, can be added later

4. **Any specific styling for loading/error states?**
   - Use existing theme via Tailwind CSS

5. **Should password change be exposed in UI?**
   - Currently backend supports it, not in frontend

---

## Testing Recommendations

After implementing changes:

1. Test login/logout cycle
2. Test page refresh preserves session
3. Test 401 error handling with token expiry simulation
4. Test accessing protected routes without login
5. Test cross-component navigation
6. Test with network disconnection scenarios
7. Test on different browsers

---

## Notes

- All changes are frontend-only as requested
- Backend authentication system is solid, just needs frontend integration
- No modifications to backend authentication or auth.py
- All API endpoints already exist and are functional
- Frontend just needs to properly use and handle them
