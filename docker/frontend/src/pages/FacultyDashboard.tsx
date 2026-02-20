import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import {
  getAllScripts,
  areResultsPublished,
  setResultsPublished,
} from "@/services/evaluationService";

type FilterTab = "all" | "grievances";

const FacultyDashboard = () => {
  const [publishResults, setPublishResults] = useState(areResultsPublished());
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const navigate = useNavigate();

  const scripts = getAllScripts();
  const assigned = scripts.length;
  const graded = scripts.filter((s) => s.status === "graded").length;
  const ungraded = scripts.filter((s) => s.status === "pending").length;
  const grievanceCount = scripts.filter((s) => s.hasGrievance).length;

  const filteredScripts =
    activeFilter === "grievances"
      ? scripts.filter((s) => s.hasGrievance)
      : scripts;

  const handleEvaluate = (rollNo: string, subjectCode: string, status: string, hasGrievance: boolean) => {
    const mode = hasGrievance ? "grievance" : status === "pending" ? "fresh" : "graded";
    navigate(`/evaluation/${subjectCode.toLowerCase()}?role=faculty&mode=${mode}&roll=${rollNo}`);
  };

  const handleLogout = () => {
    toast.dismiss();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handlePublishToggle = () => {
    const next = !publishResults;
    setPublishResults(next);
    setResultsPublished(next);
    toast.success(
      next
        ? "Results published to the Student Portal"
        : "Results unpublished from the Student Portal"
    );
  };

  const stats = [
    { label: "Scripts Assigned", value: assigned, color: "text-primary" },
    { label: "Graded", value: graded, color: "text-success" },
    { label: "Ungraded", value: ungraded, color: "text-warning" },
    { label: "Grievances", value: grievanceCount, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Faculty Dashboard</h1>
          <p className="text-sm text-muted-foreground">Examination Grading Portal</p>
        </div>
        <div className="flex items-center gap-3">
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
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 flex items-center justify-between"
            >
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <span className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          {/* Grading Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Grading Queue
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter("grievances")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFilter === "grievances"
                      ? "bg-destructive text-destructive-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Grievances ({grievanceCount})
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roll No</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submission Date</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScripts.map((s, i) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border last:border-0 ${
                        i % 2 === 1 ? "bg-muted/30" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-mono font-medium text-foreground">{s.rollNo}</td>
                      <td className="px-5 py-3 font-mono text-primary">{s.subjectCode}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.submissionDate}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                          s.status === "graded"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}>
                          {s.status === "graded" ? "Graded" : "Pending"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {s.hasGrievance ? (
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            Grievance
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.hasGrievance ? (
                          <button
                            onClick={() => handleEvaluate(s.rollNo, s.subjectCode, s.status, s.hasGrievance)}
                            className="rounded-md bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground hover:bg-warning/90 transition-colors"
                          >
                            Review
                          </button>
                        ) : s.status === "pending" ? (
                          <button
                            onClick={() => handleEvaluate(s.rollNo, s.subjectCode, s.status, s.hasGrievance)}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Evaluate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEvaluate(s.rollNo, s.subjectCode, s.status, s.hasGrievance)}
                            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                System Control
              </h3>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground leading-snug max-w-[180px]">
                  Publish Results to Student Portal
                </label>
                <button
                  onClick={handlePublishToggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    publishResults ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-foreground shadow-lg transform transition duration-200 ease-in-out ${
                      publishResults ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FacultyDashboard;
