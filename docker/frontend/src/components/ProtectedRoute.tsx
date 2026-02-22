import { Navigate } from "react-router-dom";
import { useUserSession } from "@/context/UserSessionContext";

type AllowedRole = "student" | "faculty";

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: AllowedRole[];
  requireCoordinator?: boolean;
  requireController?: boolean;
}

const ProtectedRoute = ({
  children,
  allowedRoles,
  requireCoordinator = false,
  requireController = false,
}: ProtectedRouteProps) => {
  const { user } = useUserSession();

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
