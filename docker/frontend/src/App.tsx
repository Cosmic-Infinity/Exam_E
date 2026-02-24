import { Toaster } from "@/app/components/ui/toaster";
import { Toaster as Sonner } from "@/app/components/ui/sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./app/context/ThemeContext";
import { UserSessionProvider, useUserSession } from "./app/context/UserSessionContext";
import Login from "./app/pages/auth/Login";
import StudentDashboard from "./app/pages/dashboard/StudentDashboard";
import FacultyDashboard from "./app/pages/dashboard/FacultyDashboard";
import StatisticsPage from "./app/pages/dashboard/StatisticsPage";
import ControllerStatisticsPage from "./app/pages/dashboard/ControllerStatisticsPage";
import EvaluationViewer from "./app/pages/evaluation/EvaluationViewer";
import NotFound from "./app/pages/NotFound";
import ProtectedRoute from "./app/components/common/ProtectedRoute";


const queryClient = new QueryClient();

// Loading component shown while session is being restored
const SessionLoadingScreen = () => (
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

// Routes wrapper that checks loading state
const AppRoutes = () => {
  const { isLoading } = useUserSession();

  if (isLoading) return <SessionLoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/dashboard/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/faculty"
        element={
          <ProtectedRoute allowedRoles={["faculty"]}>
            <FacultyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/statistics"
        element={
          <ProtectedRoute allowedRoles={["faculty"]} requireCoordinator>
            <StatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/controller-statistics"
        element={
          <ProtectedRoute allowedRoles={["faculty"]} requireController>
            <ControllerStatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/evaluation/:subjectId"
        element={
          <ProtectedRoute allowedRoles={["student", "faculty"]}>
            <EvaluationViewer />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserSessionProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </UserSessionProvider>
  </QueryClientProvider>
);

export default App;
