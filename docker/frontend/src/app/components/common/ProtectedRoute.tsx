import { Navigate } from "react-router-dom";
import { useUserSession } from "@/app/context/UserSessionContext";

type AllowedRole = "student" | "faculty";

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: AllowedRole[];
  requireCoordinator?: boolean;
  requireController?: boolean;
}

const LoadingSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin">
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25"></circle>
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">Restoring your session...</p>
    </div>
  </div>
);

const ProtectedRoute = ({
  children,
  allowedRoles,
  requireCoordinator = false,
  requireController = false,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useUserSession();

  // Show loading spinner while session is being restored on page refresh
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "faculty" ? "/dashboard/faculty" : "/dashboard/student"} replace />;
  }

  if (requireCoordinator && !user.isCourseCoordinator) {
    return <Navigate to="/dashboard/faculty" replace />;
  }

  if (requireController && !user.isController) {
    return <Navigate to="/dashboard/faculty" replace />;
  }

  return children;
};

export default ProtectedRoute;
