import React, { createContext, useContext, useState, useEffect } from "react";

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
  backendRole?: string; // Stores original backend role (TEACHER, COORDINATOR, CONTROLLER, STUDENT)
  isCourseCoordinator?: boolean; // Determined on dashboard load, not at login
  isController?: boolean; // Determined on dashboard load, not at login
}

interface UserSessionContextType {
  user: UserSession | null;
  setUser: (user: UserSession | null) => void;
  isLoggedIn: boolean;
  logout: () => void;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserSession | null>(null);

  // Load user session from sessionStorage on mount (cleared when browser closes)
  useEffect(() => {
    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      try {
        setUserState(JSON.parse(storedSession));
      } catch (e) {
        console.error("Failed to restore user session", e);
      }
    }
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
    // Backend handles JWT cookie cleanup via logout endpoint
  };

  return (
    <UserSessionContext.Provider value={{ user, setUser, isLoggedIn: !!user, logout }}>
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
