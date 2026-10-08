import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import { useUserSession } from "@/app/context/UserSessionContext";
import {
  getAllScripts,
  getFacultyGrievanceStats,
} from "@/app/services/evaluationService";
import { fetchAccessibleCourses } from "@/app/services/statisticsService";

type SearchType = "name" | "rollNo" | "section";
type SortKey = "studentName" | "rollNo" | "subjectCode" | "status" | null;

const FacultyDashboard = () => {
  const [filterMode, setFilterMode] = useState<"search" | "status">("search");
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "pending">("all");
  const [minRollFilter, setMinRollFilter] = useState("");

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" | null }>({
    key: null,
    direction: null,
  });

  const [searchType, setSearchType] = useState<SearchType>("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasCoordinatedCourses, setHasCoordinatedCourses] = useState(false);
  const [assignedGrievanceCount, setAssignedGrievanceCount] = useState(0);
  const navigate = useNavigate();
  const { user, logout } = useUserSession();

  // Session flags are now sourced from backend auth responses.
  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const loadGrievanceBadgeCount = async () => {
      try {
        const stats = await getFacultyGrievanceStats();
        if (active) {
          setAssignedGrievanceCount(Number(stats.visible_open_count || 0));
        }
      } catch {
        if (active) {
          setAssignedGrievanceCount(0);
        }
      }
    };

    loadGrievanceBadgeCount();
    return () => {
      active = false;
    };
  }, []);

  // Check if course coordinator actually has courses assigned
  useEffect(() => {
    const checkCoordinatorStatus = async () => {
      // Only proceed if user is a TEACHER (potential coordinator)
      if (user?.backendRole === "TEACHER") {
        try {
          const data = await fetchAccessibleCourses();
          if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
            setHasCoordinatedCourses(true);
          } else {
            setHasCoordinatedCourses(false);
          }
        } catch (error) {
          // 403 is expected for non-coordinator teachers.
          setHasCoordinatedCourses(false);
        }
      }
    };

    checkCoordinatorStatus();
  }, [user?.backendRole]);

  const [scripts, setScripts] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadScripts = async () => {
      try {
        const data = await getAllScripts();
        if (active) setScripts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load scripts:", error);
        if (active) setScripts([]);
        toast.error("Failed to load scripts");
      }
    };

    loadScripts();

    return () => {
      active = false;
    };
  }, []);

  const safeScripts = Array.isArray(scripts) ? scripts : [];
  const assigned = safeScripts.length;
  const graded = safeScripts.filter((s) => s.status === "graded").length;
  const ungraded = safeScripts.filter((s) => s.status === "pending").length;
  const uniqueSections = Array.from(new Set(safeScripts.map((s) => s.section).filter(Boolean))).sort();

  const handleSort = (key: SortKey) => {
    if (!key) return;
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === "asc") return { key, direction: "desc" };
        if (current.direction === "desc") return { key: null, direction: null };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const filteredScripts = safeScripts
    .filter((s) => {
      if (filterMode === "search") {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        if (searchType === "name") return (s.studentName || "").toLowerCase().includes(query);
        if (searchType === "rollNo") return (s.rollNo || "").toLowerCase().includes(query);
        if (searchType === "section") return (s.section || "") === searchQuery;
        return true;
      } else {
        // Status Mode Filter
        if (statusFilter === "graded" && s.status !== "graded") return false;
        if (statusFilter === "pending" && s.status !== "pending") return false;

        // Roll No Contains Filter (Sub-string match for Batch)
        if (minRollFilter && !(s.rollNo || "").includes(minRollFilter)) return false;

        return true;
      }
    })
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;

      const key = sortConfig.key;
      const valA = (a[key] || "").toString().toLowerCase();
      const valB = (b[key] || "").toString().toLowerCase();

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const handleEvaluate = (rollNo: string, subjectCode: string, status: string) => {
    const mode = status === "pending" ? "fresh" : "graded";
    navigate(`/evaluation/${subjectCode.toLowerCase()}?role=faculty&mode=${mode}&roll=${rollNo}`);
  };

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const stats = [
    { label: "Scripts Assigned", value: assigned, color: "text-primary" },
    { label: "Graded", value: graded, color: "text-success" },
    { label: "Ungraded", value: ungraded, color: "text-warning" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {user?.fullName ? `Welcome, ${user.fullName}` : "Faculty Dashboard"}
            {user?.universityId && <span className="font-mono text-sm text-muted-foreground ml-2">(ID: {user.universityId})</span>}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate("/dashboard/faculty/grievances")}
            className="max-w-[185px] whitespace-normal leading-4 text-left rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            Grievance Management ({assignedGrievanceCount})
          </button>
          {hasCoordinatedCourses && (
            <button
              onClick={() => navigate("/dashboard/statistics")}
              className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Statistics
            </button>
          )}
          {user?.isController && (
            <>
              <button
                onClick={() => navigate("/dashboard/controller-subject-statistics")}
                className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Statistics
              </button>
              <button
                onClick={() => navigate("/dashboard/controller-statistics")}
                className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Controller Statistics
              </button>
            </>
          )}
          <div className="scale-90 origin-right">
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[60%] space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-card p-2.5 flex flex-col justify-between h-16">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                  <span className={`text-xl font-bold font-mono ${stat.color} mt-auto`}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Grading Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Grading Queue</h2>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th
                        className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60"
                        onClick={() => handleSort("studentName")}
                      >
                        <div className="flex items-center gap-2">
                          Student
                          {sortConfig.key === "studentName" &&
                            (sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortConfig.direction === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            ))}
                        </div>
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60" onClick={() => handleSort("rollNo")}>
                        <div className="flex items-center gap-2">
                          ID / Section
                          {sortConfig.key === "rollNo" &&
                            (sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortConfig.direction === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60"
                        onClick={() => handleSort("subjectCode")}
                      >
                        <div className="flex items-center gap-2">
                          Subject
                          {sortConfig.key === "subjectCode" &&
                            (sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortConfig.direction === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            ))}
                        </div>
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60" onClick={() => handleSort("status")}>
                        <div className="flex items-center justify-center gap-2">
                          Status
                          {sortConfig.key === "status" &&
                            (sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortConfig.direction === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            ))}
                        </div>
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScripts.length > 0 ? (
                      filteredScripts.map((s, i) => (
                        <tr key={s.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                          <td className="px-5 py-3">
                            <div className="font-medium text-foreground">{s.studentName || "Unknown"}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs">{s.rollNo}</span>
                              {s.section && <span className="text-[10px] text-muted-foreground">Sec: {s.section}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs">
                            <Link
                              to={`/evaluation/${s.subjectCode.toLowerCase()}?role=faculty&mode=${s.status === "pending" ? "fresh" : "graded"}&roll=${s.rollNo}`}
                              className="text-primary hover:text-primary/80 hover:underline transition-colors"
                            >
                              {s.subjectCode}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium ${s.status === "graded" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                            >
                              {s.status === "graded" ? "Graded" : "Pending"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {s.status === "pending" ? (
                              <button
                                onClick={() => handleEvaluate(s.rollNo, s.subjectCode, s.status)}
                                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                Evaluate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEvaluate(s.rollNo, s.subjectCode, s.status)}
                                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                          No students found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[40%] space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 sticky top-6 space-y-6">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">Filter Options</h3>

              {/* Mode 1: Search */}
              <div className="space-y-4" onClick={() => filterMode !== "search" && setFilterMode("search")}>
                <div className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={filterMode === "search"} onChange={() => setFilterMode("search")} className="h-4 w-4 accent-primary" />
                  <h4 className="text-sm font-medium">Search By Student Details</h4>
                </div>

                <div className={`pl-6 space-y-4 transition-opacity ${filterMode !== "search" ? "pointer-events-none opacity-70" : "opacity-100"}`}>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Search By</label>
                    <select
                      value={searchType}
                      onChange={(e) => {
                        setSearchType(e.target.value as any);
                        setSearchQuery("");
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="name">Name</option>
                      <option value="rollNo">Roll No</option>
                      <option value="section">Section</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{searchType === "section" ? "Select Section" : "Search Query"}</label>
                    {searchType === "section" ? (
                      <select
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">All Sections</option>
                        {uniqueSections.map((sec: any) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder={`Start typing ${searchType}...`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Mode 2: Status & Range */}
              <div className="space-y-4" onClick={() => filterMode !== "status" && setFilterMode("status")}>
                <div className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={filterMode === "status"} onChange={() => setFilterMode("status")} className="h-4 w-4 accent-primary" />
                  <h4 className="text-sm font-medium">Batch Filter</h4>
                </div>

                <div className={`pl-6 space-y-4 transition-opacity ${filterMode !== "status" ? "pointer-events-none opacity-70" : "opacity-100"}`}>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Evaluation Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="all">All Scripts</option>
                      <option value="graded">Evaluated IDs</option>
                      <option value="pending">Not Evaluated IDs</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground block">Roll No (Contains)</label>
                    <input
                      type="text"
                      placeholder="e.g. 2105"
                      value={minRollFilter}
                      onChange={(e) => setMinRollFilter(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FacultyDashboard;
