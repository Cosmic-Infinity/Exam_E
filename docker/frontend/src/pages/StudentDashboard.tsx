import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserSession } from "@/context/UserSessionContext";
import { getStudentResults, areResultsPublished } from "@/services/evaluationService";
import { RecheckStatus, StudentResult } from "@/types/evaluation";
import ThemeToggle from "@/components/ThemeToggle";

const recheckConfig: Record<RecheckStatus, { label: string; className: string }> = {
  "not-submitted": {
    label: "Not Submitted",
    className: "bg-muted/50 text-muted-foreground",
  },
  "under-review": {
    label: "Under Review",
    className: "bg-warning/10 text-warning",
  },
  updated: {
    label: "Updated",
    className: "bg-primary/10 text-primary",
  },
  unchanged: {
    label: "Marks Unchanged",
    className: "bg-destructive/10 text-destructive",
  },
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserSession();
  
  if (!user) {
    navigate("/");
    return null;
  }
  
  const rollNo = user.universityId;
  
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const published = areResultsPublished();

  useEffect(() => {
    const data = getStudentResults(rollNo);
    setResults(data);
  }, [rollNo]);

  const selected = results.find((r) => r.subjectCode === selectedCode);

  const handleViewAnswerSheet = () => {
    if (!selectedCode) return;
    // No roll number in URL - it's fetched from authenticated user session context
    navigate(`/evaluation/${selectedCode.toLowerCase()}?role=student`);
  };

  const handleDownload = (type: "question-paper" | "answer-key") => {
    if (!selectedCode) {
      toast.error("Please select a subject first.");
      return;
    }
    const label = type === "question-paper" ? "Question Paper" : "Answer Key";
    toast.info(`Downloading ${label} for ${selectedCode}${selected ? ` — ${selected.subjectName}` : ""}...`, { duration: 2000 });
  };

  const handleLogout = async () => {
  toast.dismiss();
  await logout();
  toast.success("Logged out successfully");
  navigate("/");
};

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            Welcome, {user.fullName}{" "}
            <span className="font-mono text-sm text-muted-foreground">(ID: {rollNo})</span>
          </h1>
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

      <main className="p-6">
        {/* Two-column: left-biased for compact exam services */}
        <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto">
          {/* Left: Compact Exam Services */}
          <div className="md:w-64 shrink-0 space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Exam Services
              </h2>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  Select Subject
                </label>
                <select
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  <option value="">— Select subject —</option>
                  {results.map((r) => (
                    <option key={r.subjectCode} value={r.subjectCode}>
                      {r.subjectCode} — {r.subjectName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleViewAnswerSheet}
                disabled={!selectedCode}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                View Answer Sheet
              </button>

              {selectedCode && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                  <span className="font-mono text-primary">{selectedCode}</span>
                  {selected && ` — ${selected.subjectName}`}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDownload("question-paper")}
                disabled={!selectedCode}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬇ Question Paper
              </button>
              <button
                onClick={() => handleDownload("answer-key")}
                disabled={!selectedCode}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬇ Answer Key
              </button>
            </div>
          </div>

          {/* Right: Academic Record Table */}
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Academic Record
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">
                        Code
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">
                        Subject
                      </th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">
                        Marks
                      </th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                        Recheck Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const cfg = recheckConfig[r.recheckStatus];
                      return (
                        <tr
                          key={r.subjectCode}
                          className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                            i % 2 === 1 ? "bg-muted/20" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary border-r border-border">
                            {r.subjectCode}
                          </td>
                          <td className="px-3 py-2.5 text-foreground text-xs border-r border-border">
                            {r.subjectName}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-foreground text-xs border-r border-border">
                            {published && r.marks !== null ? r.marks : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
