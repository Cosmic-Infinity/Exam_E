import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import { useUserSession } from "@/app/context/UserSessionContext";
import { getAllScripts, getFacultyGrievanceStats } from "@/app/services/evaluationService";
import { fetchAccessibleCourses } from "@/app/services/statisticsService";
import type { AnswerScript } from "@/app/types/evaluation";

const FacultyDashboardMobile = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserSession();
  const { theme, setTheme } = useTheme();
  const [scripts, setScripts] = useState<AnswerScript[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "graded">("all");
  const [hasCoordinatedCourses, setHasCoordinatedCourses] = useState(false);
  const [assignedGrievanceCount, setAssignedGrievanceCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const [allScripts, stats] = await Promise.all([getAllScripts(), getFacultyGrievanceStats()]);
        if (active) {
          setScripts(Array.isArray(allScripts) ? allScripts : []);
          setAssignedGrievanceCount(Number(stats.visible_open_count || 0));
        }
      } catch (error) {
        console.error("Failed to load faculty data:", error);
        if (active) setScripts([]);
        toast.error("Failed to load dashboard");
      }
    };

    const loadCoordinatorFlag = async () => {
      if (user.backendRole !== "TEACHER") return;
      try {
        const data = await fetchAccessibleCourses();
        if (active) setHasCoordinatedCourses(Boolean(data?.courses?.length));
      } catch {
        if (active) setHasCoordinatedCourses(false);
      }
    };

    load();
    loadCoordinatorFlag();

    return () => {
      active = false;
    };
  }, [user, navigate]);

  const filteredScripts = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return scripts.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!lower) return true;
      return [s.studentName, s.rollNo, s.subjectCode, s.section].filter(Boolean).some((v) => String(v).toLowerCase().includes(lower));
    });
  }, [scripts, query, statusFilter]);

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  if (!user) return null;

  const assigned = scripts.length;
  const graded = scripts.filter((s) => s.status === "graded").length;
  const pending = scripts.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold">{user.fullName || "Faculty Dashboard"}</h1>
            <p className="text-[11px] text-muted-foreground font-mono">ID: {user.universityId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={handleLogout} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Assigned</p>
            <p className="text-xl font-bold text-primary">{assigned}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Graded</p>
            <p className="text-xl font-bold text-success">{graded}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-warning">{pending}</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => navigate("/dashboard/faculty/grievances")}
              className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm font-medium text-destructive"
            >
              Grievance Management ({assignedGrievanceCount})
            </button>
            {hasCoordinatedCourses && (
              <button onClick={() => navigate("/dashboard/statistics")} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary">
                Course Statistics
              </button>
            )}
            {user.isController && (
              <>
                <button onClick={() => navigate("/dashboard/controller-subject-statistics")} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary">
                  Subject Statistics
                </button>
                <button onClick={() => navigate("/dashboard/controller-statistics")} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary">
                  Controller Statistics
                </button>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, roll, subject"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setStatusFilter("all")} className={`rounded-md px-2 py-2 text-xs ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              All
            </button>
            <button onClick={() => setStatusFilter("pending")} className={`rounded-md px-2 py-2 text-xs ${statusFilter === "pending" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              Pending
            </button>
            <button onClick={() => setStatusFilter("graded")} className={`rounded-md px-2 py-2 text-xs ${statusFilter === "graded" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              Graded
            </button>
          </div>
        </section>

        <section className="space-y-2">
          {filteredScripts.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{s.studentName || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{s.rollNo} {s.section ? `• Sec ${s.section}` : ""}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] uppercase ${s.status === "graded" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                  {s.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-primary text-sm">{s.subjectCode}</p>
                <button
                  onClick={() => navigate(`/evaluation/${s.subjectCode.toLowerCase()}?role=faculty&mode=${s.status === "pending" ? "fresh" : "graded"}&roll=${s.rollNo}`)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  {s.status === "pending" ? "Evaluate" : "View"}
                </button>
              </div>
            </article>
          ))}

          {filteredScripts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No scripts found for current filter.</p>}
        </section>
      </main>
    </div>
  );
};

export default FacultyDashboardMobile;
