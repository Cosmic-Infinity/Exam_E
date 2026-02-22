import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserSession } from "@/context/UserSessionContext";
import ThemeToggle from "@/components/ThemeToggle";
import AuthService from "@/services/authService";


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
      const response = await fetch("/api/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      const data = await response.json();

      // Convert role from TEACHER to student/faculty
      const userRole = data.role === "TEACHER" || data.role === "COORDINATOR" || data.role === "CONTROLLER" ? "faculty" : "student";

      setUser({
        universityId: data.university_id,
        role: userRole,
        fullName: data.full_name,
        backendRole: data.role, // Store backend role to determine permissions on dashboard
      });

      toast.success(`Welcome, ${userRole === "faculty" ? "Faculty" : "Student"}!`);
      navigate(userRole === "faculty" ? "/dashboard/faculty" : "/dashboard/student");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred. Please try again.");
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 mb-2">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
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
                  <p className="text-xs text-muted-foreground">Use @kiit.ac.in or @faculty.kiit.ac.in</p>
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
                <p className="text-center text-xs text-muted-foreground">
                  Protected portal. Unauthorized access is prohibited.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
