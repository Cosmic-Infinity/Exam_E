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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
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
  const [chartModalRows, setChartModalRows] = useState<
    Array<{
      name: string;
      university_id: string;
      section: string;
      score?: number;
      paper_id?: number;
      checkedStatus?: "Checked" | "Unchecked";
      grievanceStatus?: "Yes" | "No";
    }>
  >([]);
  const [chartModalMessage, setChartModalMessage] = useState<string | null>(null);

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

  const sectionChartData = useMemo(
    () =>
      sections.map((section) => ({
        sectionName: section.sectionName,
        checking: section.checkingProgress || 0,
        grievances: section.grievanceCount || 0,
        unchecked: Math.max((section.totalStudents || 0) - (section.checkingProgress || 0), 0),
      })),
    [sections]
  );

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
    title: string,
    rows: Array<{
      name: string;
      university_id: string;
      section: string;
      score?: number;
      paper_id?: number;
      checkedStatus?: "Checked" | "Unchecked";
      grievanceStatus?: "Yes" | "No";
    }>,
    message: string | null = null
  ) => {
    setChartModalTitle(title);
    setChartModalRows(rows);
    setChartModalMessage(message);
    setChartModalOpen(true);
  };

  const handleSectionMetricClick = (metric: "checking" | "grievances" | "unchecked", sectionName: string) => {
    if (metric === "checking") {
      const rows = allStudents
        .filter((student) => student.section === sectionName)
        .map((student) => ({
          name: student.name,
          university_id: student.university_id,
          section: student.section,
          score: student.score,
          paper_id: student.paper_id,
          checkedStatus: "Checked" as const,
          grievanceStatus: "No" as const,
        }));

      const section = sections.find((item) => item.sectionName === sectionName);
      const grievanceSet = new Set((section?.grievanceDetails || []).map((g) => g.studentId));
      rows.forEach((row) => {
        row.grievanceStatus = grievanceSet.has(row.university_id) ? "Yes" : "No";
      });

      openChartModal(`${sectionName} - Checked Copies`, rows, rows.length === 0 ? "No checked copies found." : null);
      return;
    }

    if (metric === "grievances") {
      const section = sections.find((item) => item.sectionName === sectionName);
      const rows = (section?.grievanceDetails || []).map((item) => ({
        name: item.studentName,
        university_id: item.studentId,
        section: sectionName,
        score: allStudents.find((student) => student.university_id === item.studentId && student.section === sectionName)?.score,
        paper_id: allStudents.find((student) => student.university_id === item.studentId && student.section === sectionName)?.paper_id,
        checkedStatus: "Checked" as const,
        grievanceStatus: "Yes" as const,
      }));
      openChartModal(`${sectionName} - Grievance Students`, rows, rows.length === 0 ? "No grievance rows found." : null);
      return;
    }

    openChartModal(
      `${sectionName} - Unchecked Copies`,
      [],
      "Unchecked student-level list is not exposed by current stats APIs."
    );
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
                        <td className="px-5 py-3 font-mono font-medium text-primary">
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Total Students
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Checking Progress
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Marking Progress
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
                    {sections.map((section, i) => (
                      <tr
                        key={section.sectionName}
                        className={`border-b border-border last:border-0 ${
                          i % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-foreground">
                          {section.sectionName}
                        </td>
                        <td className="px-5 py-3 text-center text-muted-foreground">
                          {section.totalStudents}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {section.checkingProgress}/{section.totalStudents}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                            {section.checkingProgress}/{section.totalStudents}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            {section.grievanceCount}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleExpandSection(section.sectionName)}
                            disabled={loading}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                              expandedSection === section.sectionName
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
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
                    </div>
                  </div>

                  {/* Grievances Table */}
                  {(sectionDetailsMap.get(expandedSection)?.grievanceCount || 0) > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Grievance Details
                        </h4>
                      </div>
                      {sectionDetailsMap.get(expandedSection)?.grievanceDetailsAvailable ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Student ID
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Student Name
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Roll No
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Grievance Type
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Grievance Comment
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(sectionDetailsMap.get(expandedSection)?.grievanceDetails || []).map(
                                (grievance, index) => (
                                  <tr
                                    key={`${grievance.studentId}-${grievance.grievanceType}-${index}`}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="px-4 py-2 font-mono text-foreground">
                                      {grievance.studentId}
                                    </td>
                                    <td className="px-4 py-2 text-foreground">
                                      {grievance.studentName}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-muted-foreground">
                                      {grievance.rollNo}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                        {grievance.grievanceType}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground whitespace-pre-wrap">
                                      {grievance.grievanceComment || "Data not available"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground">Data not available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                Section-Wise Detailed Statistics
              </h3>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sectionChartData} margin={{ top: 16, right: 20, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="sectionName" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip cursor={false} content={() => null} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="checking"
                      name="Checking Progress"
                      stackId="sections"
                      fill="#2563eb"
                      stroke="#2563eb"
                      fillOpacity={0.55}
                      activeDot={false}
                      onClick={(entry) => handleSectionMetricClick("checking", entry?.sectionName || entry?.payload?.sectionName)}
                    />
                    <Area
                      type="monotone"
                      dataKey="grievances"
                      name="Grievances"
                      stackId="sections"
                      fill="#ef4444"
                      stroke="#ef4444"
                      fillOpacity={0.55}
                      activeDot={false}
                      onClick={(entry) => handleSectionMetricClick("grievances", entry?.sectionName || entry?.payload?.sectionName)}
                    />
                    <Area
                      type="monotone"
                      dataKey="unchecked"
                      name="Unchecked"
                      stackId="sections"
                      fill="#f59e0b"
                      stroke="#f59e0b"
                      fillOpacity={0.55}
                      activeDot={false}
                      onClick={(entry) => handleSectionMetricClick("unchecked", entry?.sectionName || entry?.payload?.sectionName)}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        <Dialog open={chartModalOpen} onOpenChange={setChartModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{chartModalTitle}</DialogTitle>
              <DialogDescription>
                Click a student row to open their answer sheet where available.
              </DialogDescription>
            </DialogHeader>
            {chartModalMessage ? (
              <div className="text-sm text-muted-foreground">{chartModalMessage}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 text-muted-foreground">Roll No</th>
                    <th className="text-left font-medium py-2 text-muted-foreground">Name</th>
                    <th className="text-left font-medium py-2 text-muted-foreground">Checked</th>
                    <th className="text-left font-medium py-2 text-muted-foreground">Grievance</th>
                  </tr>
                </thead>
                <tbody>
                  {chartModalRows.map((row) => (
                    <tr
                      key={`${row.university_id}-${row.section}-${row.paper_id || "na"}`}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewScript(row)}
                    >
                      <td className="py-2">{row.university_id}</td>
                      <td className="py-2">{row.name}</td>
                      <td className="py-2">{row.checkedStatus || "Checked"}</td>
                      <td className="py-2">{row.grievanceStatus || "No"}</td>
                    </tr>
                  ))}
                  {chartModalRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">No rows found.</td>
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
