import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { UserSessionProvider } from "./context/UserSessionContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import StatisticsPage from "./pages/StatisticsPage";
import ControllerStatisticsPage from "./pages/ControllerStatisticsPage";
import EvaluationViewer from "./pages/EvaluationViewer";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";


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

          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </UserSessionProvider>
  </QueryClientProvider>
);

export default App;
