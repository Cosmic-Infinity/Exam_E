# Frontend Authentication Implementation Guide

## Quick Start Overview

The backend authentication system is **solid and complete**. The frontend just needs to:
1. ✅ Actually use the logout endpoint (currently doesn't)
2. ✅ Implement token refresh on 401 errors
3. ✅ Protect routes from unauthorized access
4. ✅ Handle session verification on app load

This guide provides ready-to-use code for each component.

---

## Step 1: Create Auth Service Layer

**File: `/src/services/authService.ts`**

```typescript
/**
 * Centralized authentication service
 * Handles token refresh, API calls with auth, logout
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  university_id: string;
  full_name: string;
  role: string;
  is_coursecoordinator?: boolean;
}

/**
 * Refresh access token using refresh_token cookie
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh/", {
      method: "POST",
      credentials: "include", // Sends refresh_token cookie
    });

    return response.ok;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return false;
  }
}

/**
 * Perform login
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch("/api/auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  return response.json();
}

/**
 * Perform logout - invalidates tokens on backend
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Continue anyway, will clear frontend session
  }
}

/**
 * Get current user profile from backend
 */
export async function getCurrentUser() {
  const response = await fetch("/api/me/", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return response.json();
}

/**
 * Make API call with automatic token refresh on 401
 */
export async function apiCall(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  // If 401 and we haven't retried, try refreshing token
  if (response.status === 401 && retryCount === 0) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry original request with new token
      return apiCall(url, options, retryCount + 1);
    } else {
      // Refresh failed, need to login again
      return response;
    }
  }

  return response;
}

/**
 * Change password
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ message: string }> {
  const response = await fetch("/api/auth/password/change/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Password change failed");
  }

  return response.json();
}
```

---

## Step 2: Update Login Page

**File: `/src/pages/Login.tsx`**

```typescript
// CHANGE: Import authService instead of making direct fetch
import * as authService from "@/services/authService";
import { useUserSession } from "@/context/UserSessionContext";

// ... existing imports ...

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // CHANGE: Use authService.login()
    const data = await authService.login({
      email,
      password,
    });

    // Determine if user is controller (from role === 'CONTROLLER')
    const userRole = 
      data.role === "TEACHER" || 
      data.role === "COORDINATOR" || 
      data.role === "CONTROLLER" 
        ? "faculty" 
        : "student";
    
    const isController = data.role === "CONTROLLER";

    // For is_coursecoordinator, fetch from /api/me/ if needed
    let isCourseCoordinator = data.is_coursecoordinator || false;
    
    // If backend doesn't return it, fetch from me endpoint
    if (!data.is_coursecoordinator && userRole === "faculty") {
      try {
        const userProfile = await authService.getCurrentUser();
        isCourseCoordinator = 
          userProfile.teacher_profile?.is_coordinator || false;
      } catch (error) {
        console.warn("Could not fetch course coordinator status");
      }
    }

    setUser({
      universityId: data.university_id,
      role: userRole,
      fullName: data.full_name,
      isCourseCoordinator,
      isController,
    });

    toast.success(`Welcome, ${userRole === "faculty" ? "Faculty" : "Student"}!`);
    navigate(userRole === "faculty" ? "/dashboard/faculty" : "/dashboard/student");
  } catch (error) {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : "Login failed";
    toast.error(message);
  } finally {
    setLoading(false);
  }
};
```

---

## Step 3: Create Protected Route Component

**File: `/src/components/ProtectedRoute.tsx`**

```typescript
import { Navigate } from "react-router-dom";
import { useUserSession } from "@/context/UserSessionContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "faculty";
  requiredCoordinator?: boolean;
  requiredController?: boolean;
}

/**
 * Wrapper component to protect routes from unauthorized access
 * Redirects to login if user is not authenticated or doesn't have required role
 */
export function ProtectedRoute({
  children,
  requiredRole,
  requiredCoordinator,
  requiredController,
}: ProtectedRouteProps) {
  const { isLoggedIn, user } = useUserSession();

  // Not logged in - redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  // Check role requirement
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Check coordinator requirement
  if (requiredCoordinator && !user?.isCourseCoordinator) {
    return <Navigate to="/" replace />;
  }

  // Check controller requirement
  if (requiredController && !user?.isController) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

---

## Step 4: Create Loading Screen Component

**File: `/src/components/LoadingScreen.tsx`**

```typescript
import React from "react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 border border-primary/20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Loading
          </h2>
          <p className="text-sm text-muted-foreground">
            Verifying your session...
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 5: Update UserSessionContext

**File: `/src/context/UserSessionContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import * as authService from "@/services/authService";

export interface UserSession {
  universityId: string;
  role: "student" | "faculty";
  fullName: string;
  isCourseCoordinator?: boolean;
  isController?: boolean;
}

interface UserSessionContextType {
  user: UserSession | null;
  setUser: (user: UserSession | null) => void;
  isLoggedIn: boolean;
  logout: () => void;
  isInitializing: boolean;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(
  undefined
);

export const UserSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUserState] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // On mount, recover session and verify with backend
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Load from sessionStorage
        const storedSession = sessionStorage.getItem("userSession");
        if (storedSession) {
          try {
            const parsedUser = JSON.parse(storedSession);
            setUserState(parsedUser);

            // Verify session is still valid with backend
            try {
              await authService.getCurrentUser();
              // Session is valid, continue with loaded user
            } catch (error) {
              console.warn("Session no longer valid, clearing");
              setUserState(null);
              sessionStorage.removeItem("userSession");
            }
          } catch (e) {
            console.error("Failed to parse stored session", e);
            sessionStorage.removeItem("userSession");
          }
        }
      } catch (error) {
        console.error("Failed to initialize session", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, []);

  const setUser = (newUser: UserSession | null) => {
    setUserState(newUser);
    if (newUser) {
      sessionStorage.setItem("userSession", JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem("userSession");
    }
  };

  const logout = () => {
    setUser(null);
  };

  // Show loading screen while initializing
  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <UserSessionContext.Provider
      value={{ user, setUser, isLoggedIn: !!user, logout, isInitializing }}
    >
      {children}
    </UserSessionContext.Provider>
  );
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
};
```

---

## Step 6: Update App.tsx with Protected Routes

**File: `/src/App.tsx`**

```typescript
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { UserSessionProvider } from "./context/UserSessionContext";
import { ProtectedRoute } from "./components/ProtectedRoute"; // NEW
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import StatisticsPage from "./pages/StatisticsPage";
import ControllerStatisticsPage from "./pages/ControllerStatisticsPage";
import EvaluationViewer from "./pages/EvaluationViewer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserSessionProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/" element={<Login />} />

              {/* Protected routes - Student */}
              <Route
                path="/dashboard/student"
                element={
                  <ProtectedRoute requiredRole="student">
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes - Faculty */}
              <Route
                path="/dashboard/faculty"
                element={
                  <ProtectedRoute requiredRole="faculty">
                    <FacultyDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes - Course Coordinator */}
              <Route
                path="/dashboard/statistics"
                element={
                  <ProtectedRoute requiredRole="faculty" requiredCoordinator>
                    <StatisticsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes - Controller */}
              <Route
                path="/dashboard/controller-statistics"
                element={
                  <ProtectedRoute requiredRole="faculty" requiredController>
                    <ControllerStatisticsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected evaluation route */}
              <Route
                path="/evaluation/:subjectId"
                element={
                  <ProtectedRoute>
                    <EvaluationViewer />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </UserSessionProvider>
  </QueryClientProvider>
);

export default App;
```

---

## Step 7: Update Logout in All Dashboards

**Pattern for all dashboard files:**

```typescript
// Replace existing handleLogout with this:
const handleLogout = async () => {
  try {
    // Call backend logout to invalidate tokens
    await authService.logout();
  } catch (error) {
    console.error("Logout error:", error);
    // Continue with local logout even if backend fails
  }

  // Clear local session
  logout();

  // Show success message and redirect
  toast.success("Logged out successfully");
  navigate("/");
};
```

**Files to update:**
- `src/pages/StudentDashboard.tsx` (line ~65)
- `src/pages/FacultyDashboard.tsx` (line ~33)
- `src/pages/StatisticsPage.tsx` (line ~82)
- `src/pages/ControllerStatisticsPage.tsx` (line ~131)

---

## Step 8: Update Service Layers to Use apiCall

**Example: `/src/services/evaluationService.ts`**

```typescript
// Update all fetch calls to use authService.apiCall()

// BEFORE:
// const response = await fetch(`/api/teacher/papers/`);

// AFTER:
import * as authService from "./authService";

const response = await authService.apiCall(
  `/api/teacher/papers/`,
  { method: "GET" }
);

// The apiCall() function will:
// 1. Make the request with credentials
// 2. If 401, refresh token automatically
// 3. Retry the request
// 4. Return the response
```

---

## Summary of Changes

| File | Type | Change | Lines |
|------|------|--------|-------|
| `/src/services/authService.ts` | NEW | Centralized auth service | ~150 |
| `/src/components/ProtectedRoute.tsx` | NEW | Route protection | ~40 |
| `/src/components/LoadingScreen.tsx` | NEW | Loading UI | ~30 |
| `/src/context/UserSessionContext.tsx` | MODIFY | Add session verification | +50 |
| `/src/App.tsx` | MODIFY | Add protected routes | +20 |
| `/src/pages/Login.tsx` | MODIFY | Use authService | +15 |
| `/src/pages/*Dashboard.tsx` | MODIFY | Use authService.logout() | +3 each |
| `/src/services/evaluationService.ts` | MODIFY | Use apiCall() | +5 |
| `/src/services/statisticsService.ts` | MODIFY | Use apiCall() | +5 |
| `/src/services/controllerStatisticsService.ts` | MODIFY | Use apiCall() | +5 |

---

## Testing Checklist

```
✓ Login with valid credentials
✓ Login with invalid credentials shows error
✓ Logout clears session and cookies
✓ Page refresh preserves session
✓ Invalid session redirects to login
✓ Accessing /dashboard/student as student works
✓ Accessing /dashboard/faculty as faculty works
✓ Accessing /dashboard/faculty as student redirects
✓ Accessing /dashboard/statistics as coordinator works
✓ Accessing /dashboard/controller-statistics as controller works
✓ Token refresh works on 401
✓ Network error during logout handled gracefully
```

---

## Known Limitations

1. **Backend doesn't return `is_coursecoordinator` in LoginView**
   - Frontend workaround: Fetch from `/api/me/` endpoint
   - Recommended backend fix: Include in LoginView response

2. **Session storage cleared on browser close**
   - This is intentional for security
   - Can be changed to localStorage if needed

3. **No session timeout warning**
   - Not critical, can be added later
   - Would require tracking last activity time

4. **Password change not exposed in UI**
   - Backend endpoint exists
   - Can be added to profile page if needed

---

## Next Steps

1. Create the new files (authService, ProtectedRoute, LoadingScreen)
2. Update UserSessionContext with session verification
3. Update App.tsx with protected routes
4. Update Login.tsx to use authService
5. Update all dashboard logout handlers
6. Update all service layers to use apiCall()
7. Test each change thoroughly
8. Deploy to staging for QA

All code is provided above - just copy and adapt to your styling preferences!
