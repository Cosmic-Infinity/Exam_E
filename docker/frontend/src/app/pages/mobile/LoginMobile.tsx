import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { useUserSession } from "@/app/context/UserSessionContext";
import { useTheme } from "@/app/context/ThemeContext";
import AuthService from "@/app/services/authService";

const LoginMobile = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUserSession();
  const { theme, setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await AuthService.login(email, password);
      const userRole = data.role === "TEACHER" || data.role === "CONTROLLER" ? "faculty" : "student";

      setUser({
        universityId: data.university_id,
        role: userRole,
        fullName: data.full_name,
        backendRole: data.role,
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
    <div className="min-h-screen bg-background text-foreground px-4 py-6 flex flex-col">
      <div className="flex justify-end">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/10">
          <div className="text-center mb-5">
            <img src="/KIIT_logo.svg" alt="KIIT Logo" className="w-14 h-14 mx-auto mb-2 object-contain" />
            <h1 className="text-xl font-bold">KIIT Exam Portal</h1>
            <p className="text-xs text-muted-foreground mt-1">Mobile access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email-mobile" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="email-mobile"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kiit.ac.in"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password-mobile" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="password-mobile"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginMobile;
