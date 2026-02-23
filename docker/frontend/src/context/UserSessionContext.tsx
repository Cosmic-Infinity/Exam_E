import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AuthService from "@/services/authService";

/**
 * UserSessionContext
 *
 * NOT an authentication system - Backend (Django) handles real authentication via JWT
 * This only manages frontend user session state after successful backend login.
 *
 * Purpose:
 * - Stores logged-in user info (university_id, role, full_name)
 * - Prevents passing user data through URL parameters
 * - Ensures authenticated components have access to current user
 *
 * Do NOT:
 * - Implement login/password validation here
 * - Store passwords
 * - Replace backend authentication
 */

export interface UserSession {
  universityId: string;
  role: "student" | "faculty";
  fullName: string;
  backendRole?: string; // Stores original backend role (TEACHER, CONTROLLER, STUDENT)
  isCourseCoordinator?: boolean; // Determined on dashboard load, not at login
  isController?: boolean; // Determined on dashboard load, not at login
}

interface UserSessionContextType {
  user: UserSession | null;
  setUser: (user: UserSession | null) => void;
  isLoggedIn: boolean;
  logout: () => Promise<void>;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserSession | null>(null);

  // Load user session from sessionStorage on mount (cleared when browser closes)
  // and validate it against backend cookie session.
  useEffect(() => {
    const restoreAndValidate = async () => {
      const storedSession = sessionStorage.getItem("userSession");
      if (!storedSession) return;

      try {
        JSON.parse(storedSession); // basic parse validation

        const me = await AuthService.getCurrentUser();
        const userRole = me.role === "TEACHER" || me.role === "CONTROLLER" ? "faculty" : "student";

        setUserState({
          universityId: me.university_id,
          fullName: me.full_name,
          role: userRole,
          backendRole: me.role,
          isCourseCoordinator: me.role === "TEACHER",
          isController: me.role === "CONTROLLER",
        });
      } catch (e) {
        console.error("Failed to restore/validate user session", e);
        sessionStorage.removeItem("userSession");
        setUserState(null);
      }
    };

    restoreAndValidate();
  }, []);

  const setUser = (newUser: UserSession | null) => {
    setUserState(newUser);
    if (newUser) {
      sessionStorage.setItem("userSession", JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem("userSession");
    }
  };

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (e) {
      console.error("Backend logout failed", e);
    } finally {
      setUser(null);
    }
  }, []);

  return <UserSessionContext.Provider value={{ user, setUser, isLoggedIn: !!user, logout }}>{children}</UserSessionContext.Provider>;
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
};
