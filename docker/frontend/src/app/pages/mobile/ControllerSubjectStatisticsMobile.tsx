import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import { useUserSession } from "@/app/context/UserSessionContext";
import { fetchCourseStatistics } from "@/app/services/statisticsService";
import { fetchAllSemesters, fetchSubjectsBySemester } from "@/app/services/controllerStatisticsService";

const ControllerSubjectStatisticsMobile = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserSession();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Array<{ course_code: string; title: string }>>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.isController) {
      navigate("/dashboard/faculty");
      return;
    }

    let active = true;

    const loadAllCourses = async () => {
      setLoading(true);
      try {
        const semesters = await fetchAllSemesters();
        const subjectsArrays = await Promise.all(semesters.map((s) => fetchSubjectsBySemester(s.semester)));
        const flat = subjectsArrays.flat().map((s) => ({ course_code: s.courseCode, title: s.courseTitle }));
        if (!active) return;
        setCourses(flat);
        setSelectedCourse(flat[0]?.course_code || "");
      } catch (error) {
        console.error("Failed to load courses:", error);
        toast.error("Failed to load courses");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllCourses();

    return () => {
      active = false;
    };
  }, [user, navigate]);

  useEffect(() => {
    if (!selectedCourse) return;
    let active = true;

    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await fetchCourseStatistics(selectedCourse);
        if (active) setSections(data.sections || []);
      } catch (error) {
        console.error("Failed to load subject stats:", error);
        if (active) setSections([]);
        toast.error("Failed to load statistics");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadStats();
    return () => {
      active = false;
    };
  }, [selectedCourse]);

  const summary = useMemo(() => {
    const totalStudents = sections.reduce((acc, s) => acc + Number(s.totalStudents || 0), 0);
    const checked = sections.reduce((acc, s) => acc + Number(s.checkingProgress || 0), 0);
    const pending = sections.reduce((acc, s) => acc + Number(s.pendingProgress || 0), 0);
    const grievances = sections.reduce((acc, s) => acc + Number(s.grievanceCount || 0), 0);
    return { totalStudents, checked, pending, grievances };
  }, [sections]);

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold">Controller Subject Stats</h1>
          <p className="text-[11px] text-muted-foreground">Global per subject</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/dashboard/faculty")} className="rounded-md border border-border px-2 py-1.5 text-xs">Back</button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={handleLogout} className="rounded-md border border-border px-2 py-1.5 text-xs">Logout</button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">
        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
          <label className="text-xs text-muted-foreground">Subject</label>
          <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            {courses.map((course) => (
              <option key={course.course_code} value={course.course_code}>{course.course_code} - {course.title}</option>
            ))}
          </select>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card p-2"><p className="text-[10px] text-muted-foreground">Students</p><p className="text-lg font-bold">{summary.totalStudents}</p></div>
          <div className="rounded-lg border border-border bg-card p-2"><p className="text-[10px] text-muted-foreground">Checked</p><p className="text-lg font-bold text-primary">{summary.checked}</p></div>
          <div className="rounded-lg border border-border bg-card p-2"><p className="text-[10px] text-muted-foreground">Pending</p><p className="text-lg font-bold text-warning">{summary.pending}</p></div>
          <div className="rounded-lg border border-border bg-card p-2"><p className="text-[10px] text-muted-foreground">Grievances</p><p className="text-lg font-bold text-destructive">{summary.grievances}</p></div>
        </section>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : (
          <section className="space-y-2">
            {sections.map((section) => (
              <article key={section.sectionName} className="rounded-xl border border-border bg-card p-3">
                <p className="font-semibold">Section {section.sectionName}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p>Total: <span className="font-semibold">{section.totalStudents}</span></p>
                  <p>Checked: <span className="font-semibold text-primary">{section.checkingProgress}</span></p>
                  <p>Pending: <span className="font-semibold text-warning">{section.pendingProgress}</span></p>
                  <p>Grievances: <span className="font-semibold text-destructive">{section.grievanceCount}</span></p>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default ControllerSubjectStatisticsMobile;
