import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserSession } from "@/app/context/UserSessionContext";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import AuthService from "@/app/services/authService";


const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUserSession();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await AuthService.login(email, password);

      // Convert role from TEACHER to student/faculty
      const userRole = data.role === "TEACHER" || data.role === "CONTROLLER" ? "faculty" : "student";

      setUser({
        universityId: data.university_id,
        role: userRole,
        fullName: data.full_name,
        backendRole: data.role, // Store backend role to determine permissions on dashboard
        isCourseCoordinator: Boolean(data.is_course_coordinator),
        isController: Boolean(data.is_controller),
      });

      toast.success(`Welcome, ${userRole === "faculty" ? "Faculty" : "Student"}!`);
      navigate(userRole === "faculty" ? "/dashboard/faculty" : "/dashboard/student");
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Theme toggle — top right */}
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/* Centered login */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-xs space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <img src="/KIIT_logo.svg" alt="KIIT Logo" className="w-14 h-14 mx-auto mb-2 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">KIIT Exam Portal</h1>
            <p className="text-sm text-muted-foreground">Sign in with your institutional email</p>
          </div>

          {/* Portrait-style login box: min-h > width */}
          <form onSubmit={handleLogin} className="space-y-0">
            <div className="rounded-xl border border-border bg-card shadow-lg shadow-black/10 flex flex-col" style={{ minHeight: "360px" }}>
              <div className="flex-1 px-7 pt-8 pb-6 space-y-5 flex flex-col justify-center">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kiit.ac.in"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">Use your official institutional email ID.</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </div>

              <div className="px-7 py-4 border-t border-border rounded-b-xl bg-muted/20">
                <p className="text-center text-xs text-muted-foreground">Protected portal. Unauthorized access is prohibited.</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
