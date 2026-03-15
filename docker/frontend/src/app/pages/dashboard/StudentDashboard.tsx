import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useUserSession } from "@/app/context/UserSessionContext";
import { getStudentResults, areResultsPublished, getStudentPaperDetailsBySubject, downloadFile } from "@/app/services/evaluationService";
import { RecheckStatus, StudentResult } from "@/app/types/evaluation";
import ThemeToggle from "@/app/components/common/ThemeToggle";

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
  const [downloadingType, setDownloadingType] = useState<"question-paper" | "answer-key" | null>(null);
  const published = areResultsPublished();

 useEffect(() => {
  let active = true;

  const loadResults = async () => {
    try {
      const data = await getStudentResults(rollNo);
      if (active) {
        setResults(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load student results:", error);
      if (active) setResults([]);
      toast.error("Failed to load results");
    }
  };

  loadResults();

  return () => {
    active = false;
  };
}, [rollNo]);

 const selected = Array.isArray(results)
  ? results.find((r) => r.subjectCode === selectedCode)
  : undefined;


  const handleViewAnswerSheet = () => {
    if (!selectedCode) return;
    // No roll number in URL - it's fetched from authenticated user session context
    navigate(`/evaluation/${selectedCode.toLowerCase()}?role=student`);
  };

  const handleCheckGrievances = (subjectCode?: string) => {
    const code = subjectCode || selectedCode;
    if (!code) return;
    navigate(`/evaluation/${code.toLowerCase()}?role=student&panel=grievances`);
  };

  const handleDownload = async (type: "question-paper" | "answer-key") => {
    if (!selectedCode) {
      toast.error("Please select a subject first.");
      return;
    }

    setDownloadingType(type);
    try {
      const paperDetail = await getStudentPaperDetailsBySubject(selectedCode);
      if (!paperDetail) {
        toast.error(`No paper found for ${selectedCode}`);
        return;
      }

      const filePath = type === "question-paper" ? paperDetail.question_paper_path : paperDetail.answer_key_path;

      if (!filePath) {
        toast.error(`${type === "question-paper" ? "Question Paper" : "Answer Key"} not available for this subject.`);
        return;
      }

      const fileName = type === "question-paper" ? `${selectedCode}_Question_Paper.pdf` : `${selectedCode}_Answer_Key.pdf`;

      downloadFile(filePath, fileName);
      toast.success(`${type === "question-paper" ? "Question Paper" : "Answer Key"} downloaded successfully!`);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(`Failed to download ${type === "question-paper" ? "Question Paper" : "Answer Key"}`);
    } finally {
      setDownloadingType(null);
    }
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
            Welcome, {user.fullName} <span className="font-mono text-sm text-muted-foreground">(ID: {rollNo})</span>
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
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Exam Services</h2>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Select Subject</label>
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

              <button
                onClick={() => handleCheckGrievances()}
                disabled={!selectedCode}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check Grievances
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
                disabled={!selectedCode || downloadingType === "question-paper"}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingType === "question-paper" ? "⏳ Downloading..." : "⬇ Question Paper"}
              </button>
              <button
                onClick={() => handleDownload("answer-key")}
                disabled={!selectedCode || downloadingType === "answer-key"}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingType === "answer-key" ? "⏳ Downloading..." : "⬇ Answer Key"}
              </button>
            </div>
          </div>

          {/* Right: Academic Record Table */}
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Academic Record</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">Code</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">Subject</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border">Marks</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Recheck Status</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const cfg = recheckConfig[r.recheckStatus];
                      return (
                        <tr key={r.subjectCode} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold border-r border-border">
                            <Link to={`/evaluation/${r.subjectCode.toLowerCase()}?role=student`} className="text-primary hover:text-primary/80 hover:underline transition-colors">
                              {r.subjectCode}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-foreground text-xs border-r border-border">{r.subjectName}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-foreground text-xs border-r border-border">{published && r.marks !== null ? r.marks : "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>{cfg.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => handleCheckGrievances(r.subjectCode)}
                              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            >
                              {r.recheckStatus === "not-submitted" ? "Raise Grievance" : "View Grievance"}
                            </button>
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
