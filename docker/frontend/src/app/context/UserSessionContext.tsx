import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AuthService from "@/app/services/authService";

/** Context managing client-side authenticated user session state. */

export interface UserSession {
  universityId: string;
  role: "student" | "faculty";
  fullName: string;
  backendRole?: string; // Stores original backend role (TEACHER, CONTROLLER, STUDENT)
  isCourseCoordinator?: boolean; // Provided by backend auth/me endpoints
  isController?: boolean; // Provided by backend auth/me endpoints
}

interface UserSessionContextType {
  user: UserSession | null;
  setUser: (user: UserSession | null) => void;
  isLoggedIn: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user session from sessionStorage on mount (cleared when browser closes)
  // and validate it against backend cookie session.
  useEffect(() => {
    const restoreAndValidate = async () => {
      const storedSession = sessionStorage.getItem("userSession");

      // Immediately restore from sessionStorage if it exists
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          setUserState(parsed);
        } catch (e) {
          console.error("Failed to parse stored session", e);
        }
      }

      // Validate with backend in the background
      try {
        const me = await AuthService.getCurrentUser();
        if (!me) {
          sessionStorage.removeItem("userSession");
          setUserState(null);
          return;
        }

        const userRole = me.role === "TEACHER" || me.role === "CONTROLLER" ? "faculty" : "student";

        setUserState({
          universityId: me.university_id,
          fullName: me.full_name,
          role: userRole,
          backendRole: me.role,
          isCourseCoordinator: Boolean(me.is_course_coordinator),
          isController: Boolean(me.is_controller),
        });
      } catch (e) {
        console.error("Failed to validate user session with backend", e);
        // If validation fails, clear everything
        sessionStorage.removeItem("userSession");
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAndValidate();
  }, []);

  const setUser = useCallback((newUser: UserSession | null) => {
    setUserState(newUser);
    if (newUser) {
      sessionStorage.setItem("userSession", JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem("userSession");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (e) {
      console.error("Backend logout failed", e);
    } finally {
      setUser(null);
    }
  }, []);

  return <UserSessionContext.Provider value={{ user, setUser, isLoggedIn: !!user, isLoading, logout }}>{children}</UserSessionContext.Provider>;
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
};
