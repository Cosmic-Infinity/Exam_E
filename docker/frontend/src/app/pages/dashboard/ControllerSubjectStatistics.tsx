import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import { useUserSession } from "@/app/context/UserSessionContext";
import {
  fetchCourseStatistics,
  fetchScoreDistribution,
  fetchStudentsInRange,
  type ScoreDistribution,
  type SectionStatistics,
  type GrievanceDetail,
  type StudentStats,
} from "@/app/services/statisticsService";
import {
  fetchAllSemesters,
  fetchSubjectsBySemester,
} from "@/app/services/controllerStatisticsService";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceDot,
  ComposedChart
} from 'recharts';
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import { Check, ChevronDown } from "lucide-react";


interface SectionDetail extends SectionStatistics {}

const ControllerSubjectStatistics = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserSession();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [sectionsData, setSectionsData] = useState<SectionStatistics[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreDistribution | null>(null);
  const [courses, setCourses] = useState<Array<{ course_code: string; title: string }>>([]);
  
  // New state variables
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>(["All"]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [activeModalData, setActiveModalData] = useState<{range: string, data: any[]} | null>(null);
  const [sectionColors, setSectionColors] = useState<Record<string, string>>({});

  const [sectionDetailsMap, setSectionDetailsMap] = useState<Map<string, SectionDetail>>(new Map());
  
  // Generate consistent colors for sections
  const getAllColors = (sections: string[]) => {
    const colors = [
      "hsl(var(--primary))", 
      "#10b981", // emerald-500
      "#f59e0b", // amber-500
      "#ef4444", // red-500
      "#8b5cf6", // violet-500
      "#ec4899", // pink-500
      "#06b6d4", // cyan-500
      "#84cc16", // lime-500
    ];
    
    const colorMap: Record<string, string> = {};
    sections.forEach((sec, idx) => {
      colorMap[sec] = colors[idx % colors.length];
    });
    return colorMap;
  };

  // Fetch and set permission flags from backend role on mount
  useEffect(() => {
    if (user?.backendRole) {
      // Course coordinators are TEACHERS with assigned courses (not CONTROLLERS)
      // But here we are checking for controller access
      setUser({
        ...user,
        isCourseCoordinator: false,
        isController: user.backendRole === "CONTROLLER",
      });
    }
  }, [user?.backendRole, setUser]);

  // Fetch ALL courses on mount
  useEffect(() => {
    const loadAllCourses = async () => {
      try {
        setDataLoading(true);
        // 1. Fetch all semesters
        const semestersData = await fetchAllSemesters();
        
        // 2. Fetch subjects for each semester
        const allSubjectsPromises = semestersData.map(sem => fetchSubjectsBySemester(sem.semester));
        const subjectsArrays = await Promise.all(allSubjectsPromises);
        
        // 3. Flatten and format
        const flatSubjects = subjectsArrays.flat();
        const formattedCourses = flatSubjects.map(sub => ({
          course_code: sub.courseCode,
          title: sub.courseTitle
        }));

        setCourses(formattedCourses);
        if (formattedCourses.length > 0) {
          setSelectedCourse(formattedCourses[0].course_code);
        }
      } catch (error) {
        console.error("Failed to load courses:", error);
        toast.error("Failed to load courses");
      } finally {
        setDataLoading(false);
      }
    };

    if (user?.isController) {
      loadAllCourses();
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
        const [stats, scores, studentsResp] = await Promise.all([
          fetchCourseStatistics(selectedCourse),
          fetchScoreDistribution(selectedCourse),
          fetchStudentsInRange(selectedCourse, 0, 100)
        ]);
        
        setSectionsData(stats.sections);
        setScoreData(scores as any);
        
        const students = (studentsResp as any).students || [];
        setAllStudents(students);
        
        // Setup initial colors for all sections found
        const uniqueSections = Array.from(new Set<string>(students.map((s: any) => s.section))).sort();
        setSectionColors(getAllColors(uniqueSections));
        setSelectedSections(["All"]); 

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
  
  // Memoized Chart Data Calculation
  const chartData = useMemo(() => {
    if (!allStudents.length) return [];

    const bins = [
      "0-10", "11-20", "21-30", "31-40", "41-50", 
      "51-60", "61-70", "71-80", "81-90", "91-100"
    ];
    
    // Determine which sections to include
    const uniqueSections = Array.from(new Set(allStudents.map(s => s.section))).sort();
    const sectionsToShow = selectedSections.includes("All") ? uniqueSections : selectedSections;

    return bins.map(bin => {
      const [min, max] = bin.split("-").map(Number);
      
      const binData: any = { range: bin };
      
      sectionsToShow.forEach(section => {
        const count = allStudents.filter(s => 
          s.section === section && 
          s.score >= min && 
          s.score <= max
        ).length;
        binData[section] = count;
      });
      
      // Calculate total frequency for the X-axis if needed (though we use categories)
      binData.total = sectionsToShow.reduce((acc, sec) => acc + (binData[sec] || 0), 0);
      
      return binData;
    });
  }, [allStudents, selectedSections]);
  
  // Handle clicking on a chart element
  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload) return;
    
    const payload = data.activePayload[0].payload;
    const range = payload.range;
    const [min, max] = range.split("-").map(Number);
    
    const uniqueSections = Array.from(new Set(allStudents.map(s => s.section))).sort();
    const sectionsToShow = selectedSections.includes("All") ? uniqueSections : selectedSections;
    
    const studentsInBin = allStudents.filter(s => 
      sectionsToShow.includes(s.section) && 
      s.score >= min && 
      s.score <= max
    );
    
    setActiveModalData({
      range,
      data: studentsInBin
    });
    setModalOpen(true);
  };

  const toggleSection = (section: string) => {
    if (section === "All") {
      if (selectedSections.includes("All")) {
        setSelectedSections([]);
      } else {
        setSelectedSections(["All"]);
      }
      return;
    }

    let newSelected = [...selectedSections];
    if (newSelected.includes("All")) {
      newSelected = []; // Clear "All" if a specific one is toggled
    }
    
    if (newSelected.includes(section)) {
      newSelected = newSelected.filter(s => s !== section);
    } else {
      newSelected.push(section);
    }
    
    // If all individual sections are selected, switch back to "All"? 
    // Or just keep it flexible. Let's keep it simple.
    
    setSelectedSections(newSelected);
  };
  
  const handleViewScript = (student: StudentStats) => {
     // For Controller, we can basically view everything
     // Using role=faculty is fine as controllers are superset of faculty often, or we need role=controller logic in evaluation viewer
     // But prompts says "don't change backend", so sticking to what works for viewers
     navigate(`/evaluation/${selectedCourse}?roll=${student.university_id}&mode=graded&role=faculty`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Controller Subject Statistics
          </h1>
          <p className="text-sm text-muted-foreground">
            Global subject-wise evaluation metrics and progress tracking
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
        
        {/* Top Section: Selector + Summary Cards */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Course Selector - Left Side */}
            {!dataLoading && courses.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 w-[350px] shrink-0">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Subject (Global)
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

            {/* Summary Cards - Right Side */}
            {!dataLoading && sectionsData.length > 0 && (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Total Students</h3>
                  <p className="text-2xl font-bold mt-2">
                    {sectionsData.reduce((acc, curr) => acc + curr.totalStudents, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Evaluation Progress</h3>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {Math.round((sectionsData.reduce((acc, curr) => acc + curr.checkingProgress, 0) / sectionsData.reduce((acc, curr) => acc + curr.totalStudents, 0) || 0) * 100)}%
                        </span>
                        <span className="text-xs text-muted-foreground">Completed</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full mt-2 overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${(sectionsData.reduce((acc, curr) => acc + curr.checkingProgress, 0) / sectionsData.reduce((acc, curr) => acc + curr.totalStudents, 0) || 0) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Pending Papers</h3>
                  <p className="text-2xl font-bold mt-2 text-orange-500">
                    {sectionsData.reduce((acc, curr) => acc + curr.pendingProgress, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Active Grievances</h3>
                  <p className="text-2xl font-bold mt-2 text-destructive">
                    {sectionsData.reduce((acc, curr) => acc + curr.grievanceCount, 0)}
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Loading State */}
        {dataLoading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-3 text-sm text-muted-foreground">Loading statistics...</p>
          </div>
        )}

        {/* At a Glance & Charts */}
        {!dataLoading && sectionsData.length > 0 && (
          <div className="space-y-6">
            
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Score Distribution
                </h3>
                <div className="relative w-[220px]">
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    onClick={() => setIsSectionDropdownOpen(!isSectionDropdownOpen)}
                  >
                    <span className="truncate">
                      {selectedSections.includes("All") 
                        ? "All Sections" 
                        : selectedSections.length === 0 
                          ? "Select Section" 
                          : `${selectedSections.length} Section${selectedSections.length > 1 ? 's' : ''} Selected`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  
                  {isSectionDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSectionDropdownOpen(false)} />
                      <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[200px] max-h-[300px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                        <div className="p-1">
                          <div
                            className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => toggleSection("All")}
                          >
                            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                              {selectedSections.includes("All") && (
                                <Check className="h-4 w-4" />
                              )}
                            </span>
                            <span className="font-medium">All Sections</span>
                          </div>
                          
                          <div className="my-1 h-px bg-muted" />
                          
                          <div className="max-h-[200px] overflow-y-auto">
                            {sectionsData.map((sec) => (
                              <div
                                key={sec.sectionName}
                                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                onClick={() => toggleSection(sec.sectionName)}
                              >
                                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                  {(selectedSections.includes(sec.sectionName) || selectedSections.includes("All")) && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </span>
                                <div 
                                  className="mr-2 h-3 w-3 rounded-full shrink-0 border border-border" 
                                  style={{ backgroundColor: sectionColors[sec.sectionName] || '#ccc' }} 
                                />
                                <span className="truncate">{sec.sectionName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="h-[400px] w-full">
                {allStudents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="hsl(var(--border))" />
                      <XAxis dataKey="range" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={30} />
                      <RechartsTooltip 
                        cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))', 
                          color: 'hsl(var(--foreground))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend verticalAlign="top" height={36}/>
                      {(selectedSections.includes("All") ? sectionsData.map(s => s.sectionName) : selectedSections).map((secName) => (
                        <Line
                          key={secName}
                          type="monotone"
                          dataKey={secName}
                          stroke={sectionColors[secName] || '#8884d8'}
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No score data available yet.
                  </div>
                )}
              </div>
            </div>
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
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assigned Teacher
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Total Students
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Checking Progress
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
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {section.teacherName}
                      </td>
                      <td className="px-5 py-3 text-center text-muted-foreground">
                        {section.totalStudents}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex text-xs justify-center mb-1">
                             <span className="text-muted-foreground text-[10px] md:text-xs">
                               {section.checkingProgress}/{section.totalStudents} ({Math.round((section.checkingProgress / (section.totalStudents || 1)) * 100)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full flex overflow-hidden">
                            <div className="h-full bg-success" style={{ width: `${(section.checkingProgress / (section.totalStudents || 1)) * 100}%` }} title="Completed" />
                            <div className="h-full bg-warning" style={{ width: `${(section.pendingProgress / (section.totalStudents || 1)) * 100}%` }} title="Pending" />
                          </div>
                        </div>
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
        
        {/* Student List Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Students Scoring {activeModalData?.range}</DialogTitle>
              <DialogDescription>
                Click on a student to view their answer script.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 text-muted-foreground w-1/3">Name</th>
                    <th className="text-left font-medium py-2 text-muted-foreground w-1/3">ID</th>
                    <th className="text-left font-medium py-2 text-muted-foreground w-1/6">Section</th>
                    <th className="text-right font-medium py-2 text-muted-foreground w-1/6">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {activeModalData?.data.map((student: StudentStats) => (
                    <tr 
                      key={student.university_id} 
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewScript(student)}
                    >
                      <td className="py-3 font-medium">{student.name}</td>
                      <td className="py-3 text-muted-foreground">{student.university_id}</td>
                      <td className="py-3">
                         <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ 
                            backgroundColor: `${sectionColors[student.section]}20`, 
                            color: sectionColors[student.section] 
                         }}>
                           {student.section}
                         </span>
                      </td>
                      <td className="py-3 text-right font-mono">{student.score}</td>
                    </tr>
                  ))}
                  {activeModalData?.data.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        No students found in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ControllerSubjectStatistics;
