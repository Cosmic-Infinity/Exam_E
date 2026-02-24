import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import { useUserSession } from "@/app/context/UserSessionContext";
import {
  fetchCourseStatistics,
  fetchAccessibleCourses,
  type SectionStatistics,
  type GrievanceDetail,
} from "@/app/services/statisticsService";

interface SectionDetail extends SectionStatistics {}

const StatisticsPage = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserSession();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [sectionsData, setSectionsData] = useState<SectionStatistics[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{ course_code: string; title: string }>>([]);

  const [sectionDetailsMap, setSectionDetailsMap] = useState<Map<string, SectionDetail>>(new Map());

  // Fetch and set permission flags from backend role on mount
  useEffect(() => {
    if (user?.backendRole) {
      // Course coordinators are TEACHERS with assigned courses (not CONTROLLERS)
      const isCourseCoordinator = user.backendRole === "TEACHER";
      setUser({
        ...user,
        isCourseCoordinator,
        isController: user.backendRole === "CONTROLLER",
      });
    }
  }, [user?.backendRole, setUser]);

  // Fetch accessible courses on mount
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setDataLoading(true);
        const data = await fetchAccessibleCourses();
        if (data.courses && Array.isArray(data.courses)) {
          setCourses(data.courses);
          if (data.courses.length > 0) {
            setSelectedCourse(data.courses[0].course_code);
          }
        }
      } catch (error) {
        console.error("Failed to load courses:", error);
        toast.error("Failed to load courses");
      } finally {
        setDataLoading(false);
      }
    };

    if (user?.isCourseCoordinator) {
      loadCourses();
    } else {
      navigate("/dashboard/faculty");
    }
  }, [user, navigate]);

  // Fetch statistics when selected course changes
  useEffect(() => {
    const loadStatistics = async () => {
      if (!selectedCourse) return;

      try {
        setDataLoading(true);
        const stats = await fetchCourseStatistics(selectedCourse);
        setSectionsData(stats.sections);
        setSectionDetailsMap(new Map());
      } catch (error) {
        console.error("Failed to load statistics:", error);
        toast.error("Failed to load statistics for the selected course");
      } finally {
        setDataLoading(false);
      }
    };

    loadStatistics();
  }, [selectedCourse]);

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleExpandSection = async (sectionName: string) => {
    if (expandedSection === sectionName) {
      setExpandedSection(null);
      return;
    }

    // If we already have the details cached, just expand
    if (sectionDetailsMap.has(sectionName)) {
      setExpandedSection(sectionName);
      return;
    }

    setLoading(true);
    try {
      // Get the section data and create detailed view
      const section = sectionsData.find((s) => s.sectionName === sectionName);
      if (!section) {
        toast.error("Section not found");
        return;
      }

      // Create section details - grievance details come from the API as part of SectionStatistics
      const sectionDetails: SectionDetail = {
        sectionName: section.sectionName,
        totalStudents: section.totalStudents,
        checkingProgress: section.checkingProgress,
        markingProgress: section.markingProgress,
        pendingProgress: section.pendingProgress,
        grievanceCount: section.grievanceCount,
        grievanceDetails: section.grievanceDetails || [],
      };

      const newDetailsMap = new Map(sectionDetailsMap);
      newDetailsMap.set(sectionName, sectionDetails);
      setSectionDetailsMap(newDetailsMap);
      setExpandedSection(sectionName);
    } catch (error) {
      toast.error("Failed to load section details");
    } finally {
      setLoading(false);
    }
  };

  const getExpandedDetails = (): SectionDetail | undefined => {
    return expandedSection
      ? sectionDetailsMap.get(expandedSection)
      : undefined;
  };

  const expandedDetails = getExpandedDetails();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Course Coordinator Statistics
          </h1>
          <p className="text-sm text-muted-foreground">
            Section-wise evaluation metrics and progress tracking
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
        {/* Course Selector */}
        {!dataLoading && courses.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Select Course
            </label>
            <select
              value={selectedCourse || ""}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              {courses.map((course) => (
                <option key={course.course_code} value={course.course_code}>
                  {course.course_code} - {course.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading State */}
        {dataLoading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-3 text-sm text-muted-foreground">Loading statistics...</p>
          </div>
        )}

        {/* Sections Table */}
        {!dataLoading && sectionsData.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Sections Overview
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
                  {sectionsData.map((section, i) => (
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
                          {section.markingProgress}/{section.totalStudents}
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
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
        )}

        {/* No Data State */}
        {!dataLoading && sectionsData.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No sections found for the selected course. Please select another course or create allocations first.
            </p>
          </div>
        )}

        {/* Expanded Section Details */}
        {expandedSection && sectionDetailsMap.has(expandedSection) && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {expandedSection} - Detailed Statistics
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
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-success">
                      {sectionDetailsMap.get(expandedSection)?.markingProgress || 0}
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
                          ((sectionDetailsMap.get(expandedSection)?.markingProgress || 0) /
                            (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {Math.round(
                      ((sectionDetailsMap.get(expandedSection)?.markingProgress || 0) /
                        (sectionDetailsMap.get(expandedSection)?.totalStudents || 1)) *
                        100
                    )}
                    % complete
                  </p>
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
                            Grievance Type
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sectionDetailsMap.get(expandedSection)?.grievanceDetails || []).map(
                          (grievance) => (
                            <tr
                              key={grievance.studentId}
                              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-2 font-mono text-foreground">
                                {grievance.studentId}
                              </td>
                              <td className="px-4 py-2 text-foreground">
                                {grievance.studentName}
                              </td>
                              <td className="px-4 py-2">
                                <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                  {grievance.grievanceType}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StatisticsPage;
