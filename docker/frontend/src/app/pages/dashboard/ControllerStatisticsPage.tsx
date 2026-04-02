import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import { useUserSession } from "@/app/context/UserSessionContext";
import { fetchStudentsInRange, type StudentStats } from "@/app/services/statisticsService";
import { getFacultyGrievances, type FacultyGrievanceItem } from "@/app/services/evaluationService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  fetchAllSemesters,
  fetchSubjectsBySemester,
  fetchSectionsByCourse,
  type SemesterData,
  type SubjectData,
  type SectionStatistics,
} from "@/app/services/controllerStatisticsService";

type ViewLevel = "semesters" | "subjects" | "sections" | "details";

interface SectionDetail extends SectionStatistics {
  courseCode: string;
  courseTitle: string;
}

type ChartModalMode = "checking" | "grievances" | "unchecked";

type ChartModalRow = {
  name: string;
  university_id: string;
  section: string;
  score?: number;
  paper_id?: number;
  grievanceComment?: string;
};

const ControllerStatisticsPage = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserSession();
  const [viewLevel, setViewLevel] = useState<ViewLevel>("semesters");
  const [loading, setLoading] = useState(false);

  // Data states
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [sections, setSections] = useState<SectionStatistics[]>([]);

  // Navigation states
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [sectionDetailsMap, setSectionDetailsMap] = useState<Map<string, SectionDetail>>(
    new Map()
  );
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartModalTitle, setChartModalTitle] = useState("Section Details");
  const [chartModalRows, setChartModalRows] = useState<ChartModalRow[]>([]);
  const [chartModalMode, setChartModalMode] = useState<ChartModalMode>("checking");
  const [chartModalMessage, setChartModalMessage] = useState<string | null>(null);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");

  const formatSemesterLabel = (semester: number) =>
    semester === 0 ? "Data not available" : `Semester ${semester}`;

  const aggregateChecked = useMemo(
    () => sections.reduce((acc, section) => acc + (section.checkingProgress || 0), 0),
    [sections]
  );
  const aggregateStudents = useMemo(
    () => sections.reduce((acc, section) => acc + (section.totalStudents || 0), 0),
    [sections]
  );
  const aggregateCheckedPct = aggregateStudents > 0 ? Math.round((aggregateChecked / aggregateStudents) * 100) : 0;

  const filteredSections = useMemo(() => {
    if (selectedSectionFilter === "all") {
      return sections;
    }

    return sections.filter((section) => section.sectionName === selectedSectionFilter);
  }, [sections, selectedSectionFilter]);

  // Fetch and set permission flags from backend role on mount
  useEffect(() => {
    if (user?.backendRole) {
      // Controllers are not course coordinators - they have global view
      setUser({
        ...user,
        isCourseCoordinator: false,
        isController: user.backendRole === "CONTROLLER",
      });
    }
  }, [user?.backendRole, setUser]);

  // Load semesters on mount
  useEffect(() => {
    const loadSemesters = async () => {
      try {
        setLoading(true);
        const data = await fetchAllSemesters();
        setSemesters(data);
      } catch (error) {
        console.error("Failed to load semesters:", error);
        toast.error("Failed to load semester data");
      } finally {
        setLoading(false);
      }
    };

    if (user?.isController) {
      loadSemesters();
    } else {
      navigate("/dashboard/faculty");
    }
  }, [user, navigate]);

  const handleSemesterClick = async (semester: number) => {
    try {
      setLoading(true);
      setSelectedSemester(semester);
      const data = await fetchSubjectsBySemester(semester);
      setSubjects(data);
      setViewLevel("subjects");
    } catch (error) {
      console.error("Failed to load subjects:", error);
      toast.error("Failed to load subjects for this semester");
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = async (subject: SubjectData) => {
    try {
      setLoading(true);
      setSelectedSubject(subject);
      const [data, studentsResp, grievanceRows] = await Promise.all([
        fetchSectionsByCourse(subject.courseCode),
        fetchStudentsInRange(subject.courseCode, 0, 100),
        getFacultyGrievances("all"),
      ]);

      const students = (studentsResp as { students?: StudentStats[] })?.students || [];
      setAllStudents(students);

      const courseGrievances = grievanceRows.filter(
        (item: FacultyGrievanceItem) => item.subject_code?.toLowerCase() === subject.courseCode.toLowerCase()
      );

      const grievanceMap = new Map<string, Array<{ studentId: string; studentName: string; grievanceType: string; rollNo: string; grievanceComment: string }>>();
      courseGrievances.forEach((item) => {
        const section = item.section_name || "Data not available";
        if (!grievanceMap.has(section)) {
          grievanceMap.set(section, []);
        }
        grievanceMap.get(section)?.push({
          studentId: item.student_university_id,
          studentName: item.student_name,
          grievanceType: item.grievance_type_label || "General",
          rollNo: item.student_university_id,
          grievanceComment: item.student_comment || "Data not available",
        });
      });

      setSections(
        data.map((section) => ({
          ...section,
          grievanceDetails: grievanceMap.get(section.sectionName) || [],
          grievanceDetailsAvailable: true,
        }))
      );
      setExpandedSection(null);
      setSectionDetailsMap(new Map());
      setViewLevel("sections");
    } catch (error) {
      console.error("Failed to load sections:", error);
      toast.error("Failed to load sections for this subject");
    } finally {
      setLoading(false);
    }
  };

  const handleExpandSection = async (sectionName: string) => {
    if (expandedSection === sectionName) {
      setExpandedSection(null);
      return;
    }

    if (sectionDetailsMap.has(sectionName)) {
      setExpandedSection(sectionName);
      return;
    }

    try {
      setLoading(true);
      const section = sections.find((s) => s.sectionName === sectionName);
      if (!section || !selectedSubject) {
        toast.error("Section or subject data not found");
        return;
      }

      const sectionDetail: SectionDetail = {
        ...section,
        courseCode: selectedSubject.courseCode,
        courseTitle: selectedSubject.courseTitle,
      };

      const newDetailsMap = new Map(sectionDetailsMap);
      newDetailsMap.set(sectionName, sectionDetail);
      setSectionDetailsMap(newDetailsMap);
      setExpandedSection(sectionName);
    } catch (error) {
      toast.error("Failed to load section details");
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

  const handleViewScript = (row: { university_id: string; paper_id?: number }) => {
    if (!selectedSubject?.courseCode) return;
    const paperSuffix = row.paper_id ? `&paper_id=${row.paper_id}` : "";
    navigate(`/evaluation/${selectedSubject.courseCode}?roll=${row.university_id}&mode=graded&role=faculty&readOnly=1${paperSuffix}`);
  };

  const openChartModal = (
    mode: ChartModalMode,
    title: string,
    rows: ChartModalRow[],
    message: string | null = null
  ) => {
    setChartModalMode(mode);
    setChartModalTitle(title);
    setChartModalRows(rows);
    setChartModalMessage(message);
    setChartModalOpen(true);
  };

  const handleSectionMetricClick = (metric: "checking" | "grievances" | "unchecked", sectionName: string) => {
    if (!sectionName) return;

    if (metric === "checking") {
      const rows = allStudents
        .filter((student) => student.section === sectionName)
        .map((student) => ({
          name: student.name,
          university_id: student.university_id,
          section: student.section,
          score: student.score,
          paper_id: student.paper_id,
        }));

      openChartModal("checking", `${sectionName} - Checked Copies`, rows, rows.length === 0 ? "No checked copies found." : null);
      return;
    }

    if (metric === "grievances") {
      const section = sections.find((item) => item.sectionName === sectionName);
      const rows = (section?.grievanceDetails || []).map((item) => ({
        name: item.studentName,
        university_id: item.studentId,
        section: sectionName,
        paper_id: allStudents.find((student) => student.university_id === item.studentId && student.section === sectionName)?.paper_id,
        grievanceComment: item.grievanceComment || "Data not available",
      }));
      openChartModal("grievances", `${sectionName} - Grievance Students`, rows, rows.length === 0 ? "No grievance rows found." : null);
      return;
    }

    if (metric === "unchecked") {
      const section = sections.find((item) => item.sectionName === sectionName);
      const total = section?.totalStudents || 0;
      const checked = section?.checkingProgress || 0;
      const unchecked = Math.max(total - checked, 0);

      openChartModal(
        "unchecked",
        `${sectionName} - Unchecked Copies`,
        [],
        `Unchecked copies: ${unchecked}. Details not available.`
      );
      return;
    }

    openChartModal("unchecked", `${sectionName} - Unchecked Copies`, []);
  };

  const handleBack = () => {
    if (viewLevel === "subjects") {
      setViewLevel("semesters");
      setSelectedSemester(null);
      setSubjects([]);
    } else if (viewLevel === "sections") {
      setViewLevel("subjects");
      setSelectedSubject(null);
      setSections([]);
      setExpandedSection(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Controller Statistics
          </h1>
          <p className="text-sm text-muted-foreground">
            Institution-wide evaluation metrics and progress tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/faculty")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Back to Dashboard
          </button>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => {
              setViewLevel("semesters");
              setSelectedSemester(null);
              setSelectedSubject(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewLevel === "semesters"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semesters
          </button>

          {selectedSemester !== null && (
            <>
              <span className="text-muted-foreground">/</span>
              <button
                onClick={() => {
                  setViewLevel("subjects");
                  setSelectedSubject(null);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewLevel === "subjects"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {formatSemesterLabel(selectedSemester)}
              </button>
            </>
          )}

          {selectedSubject && (
            <>
              <span className="text-muted-foreground">/</span>
              <button
                onClick={() => setViewLevel("sections")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewLevel === "sections"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {selectedSubject.courseCode}
              </button>
            </>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-3 text-sm text-muted-foreground">Loading data...</p>
          </div>
        )}

        {/* View: Semesters */}
        {!loading && viewLevel === "semesters" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {semesters.map((semester) => (
              <button
                key={semester.semester}
                onClick={() => handleSemesterClick(semester.semester)}
                className="rounded-xl border border-border bg-card p-6 hover:bg-card/80 hover:border-primary transition-all text-left"
              >
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {formatSemesterLabel(semester.semester)}
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium">Courses:</span> {semester.totalCourses}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Students:</span> {semester.totalStudents}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Subjects:</span> {semester.subjectsCount}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* View: Subjects */}
        {!loading && viewLevel === "subjects" && selectedSemester !== null && (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Subjects - {formatSemesterLabel(selectedSemester)}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Course Code
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Sections
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Total Students
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Grievances
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject, i) => (
                      <tr
                        key={subject.courseCode}
                        className={`border-b border-border last:border-0 ${
                          i % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-mono font-medium text-foreground">
                          {subject.courseCode}
                        </td>
                        <td className="px-5 py-3 font-medium text-foreground">
                          {subject.courseTitle}
                        </td>
                        <td className="px-5 py-3 text-center text-muted-foreground">
                          {subject.sectionsCount ?? "Data not available"}
                        </td>
                        <td className="px-5 py-3 text-center text-muted-foreground">
                          {subject.totalStudents}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            {subject.totalGrievances}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleSubjectClick(subject)}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            View Sections
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* View: Sections */}
        {!loading && viewLevel === "sections" && selectedSubject && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Marking Progress (All Sections)</h3>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl font-bold text-primary">{aggregateChecked}/{aggregateStudents}</span>
                <span className="text-sm text-muted-foreground">{aggregateCheckedPct}% complete</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Sections - {selectedSubject.courseCode} ({selectedSubject.courseTitle})
                </h2>
              </div>

              <div>
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-[13%] px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        Section
                      </th>
                      <th className="w-[12%] px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        Total Students
                      </th>
                      <th className="w-[18%] px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        <div className="flex flex-col items-center gap-1">
                          <span>Checking Progress</span>
                          <span className="text-[10px] normal-case text-muted-foreground">
                            (number of checking progress of this section)
                          </span>
                        </div>
                      </th>
                      <th className="w-[29%] px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        <div className="flex flex-col items-center gap-2">
                          <span>Marking Progress</span>
                          <span className="text-[10px] normal-case text-muted-foreground">
                            ({aggregateChecked}/{aggregateStudents} for all sections)
                          </span>
                          <details className="w-full max-w-[250px] text-left normal-case">
                            <summary className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                              {selectedSectionFilter === "all" ? "All Sections" : selectedSectionFilter}
                            </summary>
                            <div className="mt-1 rounded-md border border-border bg-background p-2 shadow-sm">
                              <button
                                onClick={() => setSelectedSectionFilter("all")}
                                className="block w-full rounded px-1 py-1 text-left text-[11px] text-foreground hover:bg-muted/40"
                              >
                                All Sections
                              </button>
                              {sections.map((section) => (
                                <div key={section.sectionName} className="flex items-center justify-between gap-2 px-1 py-1">
                                  <span className="text-[11px] text-foreground">{section.sectionName}</span>
                                  <button
                                    onClick={() => setSelectedSectionFilter(section.sectionName)}
                                    className="text-[11px] font-medium text-primary underline underline-offset-2"
                                  >
                                    View Section Totals
                                  </button>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </th>
                      <th className="w-[12%] px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        Grievances
                      </th>
                      <th className="w-[16%] px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-normal break-words">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSections.map((section, i) => (
                      <tr
                        key={section.sectionName}
                        className={`border-b border-border last:border-0 ${
                          i % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                      >
                        <td className="px-2 py-2 font-medium text-foreground">
                          {section.sectionName}
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {section.totalStudents}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {section.checkingProgress}/{section.totalStudents}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                ({aggregateChecked}/{aggregateStudents})
                              </span>
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-success/20">
                                <div
                                  className="h-full rounded-full bg-success transition-all"
                                  style={{
                                    width: `${
                                      aggregateStudents > 0
                                        ? Math.min((aggregateChecked / aggregateStudents) * 100, 100)
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            {section.grievanceCount}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => handleExpandSection(section.sectionName)}
                            disabled={loading}
                            className={`rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold transition-colors ${
                              expandedSection === section.sectionName
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            } disabled:opacity-50`}
                          >
                            {expandedSection === section.sectionName
                              ? "Hide Details"
                              : "View Details"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expanded Section Details */}
            {expandedSection && sectionDetailsMap.has(expandedSection) && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    {expandedSection} - Detailed Statistics ({selectedSubject.courseCode})
                  </h3>
                </div>

                <div className="p-5 space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Total Students */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Total Students
                      </h4>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-foreground">
                          {sectionDetailsMap.get(expandedSection)?.totalStudents || 0}
                        </span>
                      </div>
                    </div>

                    {/* Checking Progress */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Checking Progress
                      </h4>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-primary">
                          {sectionDetailsMap.get(expandedSection)?.checkingProgress || 0}
                        </span>
                        <span className="text-sm text-muted-foreground mb-1">
                          / {sectionDetailsMap.get(expandedSection)?.totalStudents || 0}
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-primary/20">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${
                              ((sectionDetailsMap.get(expandedSection)?.checkingProgress || 0) /
                                (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {Math.round(
                          ((sectionDetailsMap.get(expandedSection)?.checkingProgress || 0) /
                            (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                            100
                        )}
                        % complete
                      </p>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                          View checked and unchecked copies
                        </summary>
                        <div className="mt-2 space-y-2">
                          <button
                            onClick={() => handleSectionMetricClick("checking", expandedSection)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/40"
                          >
                            Checked copies ({sectionDetailsMap.get(expandedSection)?.checkingProgress || 0})
                          </button>
                          <button
                            onClick={() => handleSectionMetricClick("unchecked", expandedSection)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/40"
                          >
                            Unchecked copies {`(${Math.max((sectionDetailsMap.get(expandedSection)?.totalStudents || 0) - (sectionDetailsMap.get(expandedSection)?.checkingProgress || 0), 0)})`}
                          </button>
                        </div>
                      </details>
                    </div>

                    {/* Marking Progress */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Marking Progress
                      </h4>
                      <>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-success">
                            {sectionDetailsMap.get(expandedSection)?.checkingProgress || 0}
                          </span>
                          <span className="text-sm text-muted-foreground mb-1">
                            / {sectionDetailsMap.get(expandedSection)?.totalStudents || 0}
                          </span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-success/20">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{
                              width: `${
                                ((sectionDetailsMap.get(expandedSection)?.checkingProgress || 0) /
                                  (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {Math.round(
                            ((sectionDetailsMap.get(expandedSection)?.checkingProgress || 0) /
                              (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                              100
                          )}
                          % complete
                        </p>
                      </>
                    </div>

                    {/* Grievances */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Pending Grievances
                      </h4>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-destructive">
                          {sectionDetailsMap.get(expandedSection)?.grievanceCount || 0}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        {(sectionDetailsMap.get(expandedSection)?.grievanceCount || 0) > 0
                          ? "Requires attention"
                          : "All resolved"}
                      </p>
                      {(sectionDetailsMap.get(expandedSection)?.grievanceCount || 0) > 0 && (
                        <button
                          onClick={() => handleSectionMetricClick("grievances", expandedSection)}
                          className="mt-2 text-xs font-medium text-primary underline underline-offset-2"
                        >
                          Click here for more details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={chartModalOpen} onOpenChange={setChartModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{chartModalTitle}</DialogTitle>
              {chartModalMode !== "unchecked" && (
                <DialogDescription>
                  {chartModalMode === "checking"
                    ? "Checked copies in this section. Click a row to open answer sheet where available."
                    : "Students with grievances in this section. Click a row to open answer sheet where available."}
                </DialogDescription>
              )}
            </DialogHeader>
            {chartModalMessage ? (
              <div className="text-sm text-muted-foreground">{chartModalMessage}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 text-muted-foreground">Name</th>
                    <th className="text-left font-medium py-2 text-muted-foreground">Roll No</th>
                    {chartModalMode === "checking" && (
                      <th className="text-right font-medium py-2 text-muted-foreground">Marks</th>
                    )}
                    {chartModalMode === "grievances" && (
                      <th className="text-left font-medium py-2 text-muted-foreground">Grievance</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {chartModalRows.map((row) => (
                    <tr
                      key={`${row.university_id}-${row.section}-${row.paper_id || "na"}`}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewScript(row)}
                    >
                      <td className="py-2">{row.name}</td>
                      <td className="py-2">{row.university_id}</td>
                      {chartModalMode === "checking" && (
                        <td className="py-2 text-right font-mono">{row.score ?? "Data not available"}</td>
                      )}
                      {chartModalMode === "grievances" && (
                        <td className="py-2 text-muted-foreground">{row.grievanceComment || "Data not available"}</td>
                      )}
                    </tr>
                  ))}
                  {chartModalRows.length === 0 && (
                    <tr>
                      <td colSpan={chartModalMode === "checking" || chartModalMode === "grievances" ? 3 : 2} className="py-6 text-center text-muted-foreground">No rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ControllerStatisticsPage;
