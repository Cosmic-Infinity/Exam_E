import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { useUserSession } from "@/app/context/UserSessionContext";
import { getStudentResults, getStudentPaperDetailsBySubject, downloadFile } from "@/app/services/evaluationService";
import type { StudentResult } from "@/app/types/evaluation";
import { useTheme } from "@/app/context/ThemeContext";

const StudentDashboardMobile = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserSession();
  const { theme, setTheme } = useTheme();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [downloadingType, setDownloadingType] = useState<"question-paper" | "answer-key" | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const data = await getStudentResults(user.universityId);
        if (active) setResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load student results:", error);
        if (active) setResults([]);
        toast.error("Failed to load results");
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  const selected = useMemo(() => results.find((r) => r.subjectCode === selectedCode), [results, selectedCode]);

  const handleLogout = async () => {
    toast.dismiss();
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleDownload = async (type: "question-paper" | "answer-key") => {
    if (!selectedCode) {
      toast.error("Please select a subject first.");
      return;
    }

    setDownloadingType(type);
    try {
      const detail = await getStudentPaperDetailsBySubject(selectedCode);
      if (!detail) {
        toast.error(`No paper found for ${selectedCode}`);
        return;
      }

      const filePath = type === "question-paper" ? detail.question_paper_path : detail.answer_key_path;
      if (!filePath) {
        toast.error(`${type === "question-paper" ? "Question Paper" : "Answer Key"} not available.`);
        return;
      }

      const fileName = type === "question-paper" ? `${selectedCode}_Question_Paper.pdf` : `${selectedCode}_Answer_Key.pdf`;
      downloadFile(filePath, fileName);
      toast.success("Download started");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed");
    } finally {
      setDownloadingType(null);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold">{user.fullName}</h1>
            <p className="text-[11px] text-muted-foreground font-mono">ID: {user.universityId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={handleLogout} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">
        <section className="rounded-xl border border-border bg-card p-3 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Services</h2>
          <select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">Select Subject</option>
            {results.map((r) => (
              <option key={r.subjectCode} value={r.subjectCode}>
                {r.subjectCode} - {r.subjectName}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => selectedCode && navigate(`/evaluation/${selectedCode.toLowerCase()}?role=student`)}
              disabled={!selectedCode}
              className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              View Answer Sheet
            </button>
            <button
              onClick={() => selectedCode && navigate(`/evaluation/${selectedCode.toLowerCase()}?role=student&panel=grievances`)}
              disabled={!selectedCode}
              className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              Check Grievances
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownload("question-paper")}
                disabled={!selectedCode || downloadingType === "question-paper"}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs disabled:opacity-50"
              >
                {downloadingType === "question-paper" ? "Downloading..." : "Question Paper"}
              </button>
              <button
                onClick={() => handleDownload("answer-key")}
                disabled={!selectedCode || downloadingType === "answer-key"}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs disabled:opacity-50"
              >
                {downloadingType === "answer-key" ? "Downloading..." : "Answer Key"}
              </button>
            </div>
          </div>

          {selected && <p className="text-xs text-muted-foreground">Selected: <span className="font-mono text-primary">{selected.subjectCode}</span> - {selected.subjectName}</p>}
        </section>

        <section className="space-y-2">
          {results.map((r) => (
            <article key={r.subjectCode} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{r.subjectName}</p>
                  <p className="font-mono text-sm font-semibold text-primary">{r.subjectCode}</p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-[10px] uppercase tracking-wider">{r.recheckStatus}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Marks</span>
                <span className="font-mono font-semibold">{r.marks ?? "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/evaluation/${r.subjectCode.toLowerCase()}?role=student`)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Open
                </button>
                <button
                  onClick={() => navigate(`/evaluation/${r.subjectCode.toLowerCase()}?role=student&panel=grievances`)}
                  className="rounded-lg border border-border px-3 py-2 text-xs"
                >
                  Grievance
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default StudentDashboardMobile;
