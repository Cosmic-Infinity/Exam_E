import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import { useUserSession } from "@/app/context/UserSessionContext";
import { fetchAllSemesters, fetchSectionsByCourse, fetchSubjectsBySemester } from "@/app/services/controllerStatisticsService";
import type { SemesterData, SubjectData, SectionStatistics } from "@/app/services/controllerStatisticsService";

type ViewLevel = "semesters" | "subjects" | "sections";

const ControllerStatisticsMobile = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserSession();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<ViewLevel>("semesters");
  const [loading, setLoading] = useState(false);
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [sections, setSections] = useState<SectionStatistics[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(null);

  const formatSemesterLabel = (semester: number | null) => {
    if (semester === null) return "Data not available";
    return semester === 0 ? "Data not available" : `Semester ${semester}`;
  };

  useEffect(() => {
    if (!user?.isController) {
      navigate("/dashboard/faculty");
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAllSemesters();
        if (active) setSemesters(data);
      } catch (error) {
        console.error("Failed to load semesters:", error);
        toast.error("Failed to load semester data");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  const openSemester = async (semester: number) => {
    setLoading(true);
    try {
      const list = await fetchSubjectsBySemester(semester);
      setSelectedSemester(semester);
      setSubjects(list);
      setView("subjects");
    } catch (error) {
      console.error("Failed to load subjects:", error);
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const openSubject = async (subject: SubjectData) => {
    setLoading(true);
    try {
      const list = await fetchSectionsByCourse(subject.courseCode);
      setSelectedSubject(subject);
      setSections(list);
      setView("sections");
    } catch (error) {
      console.error("Failed to load sections:", error);
      toast.error("Failed to load sections");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleBack = () => {
    if (view === "sections") {
      setView("subjects");
      setSelectedSubject(null);
      return;
    }
    if (view === "subjects") {
      setView("semesters");
      setSelectedSemester(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold">Controller Statistics</h1>
          <p className="text-[11px] text-muted-foreground">{view === "semesters" ? "Semester view" : view === "subjects" ? formatSemesterLabel(selectedSemester) : selectedSubject?.courseCode}</p>
        </div>
        <div className="flex items-center gap-2">
          {view !== "semesters" && <button onClick={handleBack} className="rounded-md border border-border px-2 py-1.5 text-xs">Back</button>}
          <button onClick={() => navigate("/dashboard/faculty")} className="rounded-md border border-border px-2 py-1.5 text-xs">Home</button>
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

      <main className="px-4 py-4 space-y-3 pb-24">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}

        {!loading && view === "semesters" && semesters.map((semester) => (
          <button key={semester.semester} onClick={() => openSemester(semester.semester)} className="w-full text-left rounded-xl border border-border bg-card p-3">
            <p className="font-semibold">{formatSemesterLabel(semester.semester)}</p>
            <p className="text-xs text-muted-foreground mt-1">Courses: {semester.totalCourses} • Students: {semester.totalStudents}</p>
          </button>
        ))}

        {!loading && view === "subjects" && subjects.map((subject) => (
          <button key={subject.courseCode} onClick={() => openSubject(subject)} className="w-full text-left rounded-xl border border-border bg-card p-3">
            <p className="font-mono text-primary text-sm font-semibold">{subject.courseCode}</p>
            <p className="text-sm">{subject.courseTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">Sections: {subject.sectionsCount ?? "Data not available"} • Students: {subject.totalStudents} • Grievances: {subject.totalGrievances}</p>
          </button>
        ))}

        {!loading && view === "sections" && sections.map((section) => (
          <article key={section.sectionName} className="rounded-xl border border-border bg-card p-3">
            <p className="font-semibold">Section {section.sectionName}</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <p>Total: <span className="font-semibold">{section.totalStudents}</span></p>
              <p>Checking: <span className="font-semibold text-primary">{section.checkingProgress}</span></p>
              <p>Marked: <span className="font-semibold text-success">{section.markingProgressAvailable ? section.markingProgress : "Data not available"}</span></p>
              <p>Pending: <span className="font-semibold text-warning">{section.pendingProgress}</span></p>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
};

export default ControllerStatisticsMobile;
