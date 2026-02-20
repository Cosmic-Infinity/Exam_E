import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  getScript,
  saveMarks,
  submitGrievance,
  acceptGrievance,
  rejectGrievance,
} from "@/services/evaluationService";
import { MarksRow, SUBJECT_MAP, createEmptyMarks, computeTotal } from "@/types/evaluation";
import ThemeToggle from "@/components/ThemeToggle";

const PAGES = [1, 2, 3, 4, 5, 6, 7, 8];

type PreviewType = "question-paper" | "answer-key" | null;

// Placeholder image pages for the answer sheet (different tinted "scanned" look per page)
const PAGE_COLORS = [
  "from-blue-950/30 to-slate-900/60",
  "from-slate-800/40 to-blue-950/30",
  "from-indigo-950/30 to-slate-900/50",
  "from-slate-900/50 to-blue-900/30",
  "from-blue-900/30 to-slate-800/40",
  "from-slate-800/30 to-indigo-950/30",
  "from-indigo-900/30 to-slate-900/40",
  "from-slate-900/30 to-blue-950/40",
];

const AnswerSheetImage = ({ page, subjectCode, rollNo }: { page: number; subjectCode: string; rollNo: string }) => {
  // Simulate a scanned answer sheet image with deterministic content per page
  const lines = Array.from({ length: 18 }, (_, i) => {
    const seed = (page * 17 + i * 7) % 100;
    return seed;
  });

  return (
    <div className={`w-full h-full rounded-lg border border-border bg-gradient-to-br ${PAGE_COLORS[page - 1]} flex flex-col overflow-hidden shadow-xl shadow-black/30`}>
      {/* Simulated ruled paper header */}
      <div className="px-5 pt-4 pb-2 border-b-2 border-border/60">
        <div className="flex items-center justify-between mb-1">
          <div className="h-2 w-32 rounded bg-foreground/20" />
          <div className="h-2 w-20 rounded bg-foreground/15" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-mono text-muted-foreground/70 uppercase tracking-widest">
            {subjectCode} · Roll {rollNo}
          </p>
          <p className="text-[9px] font-mono text-muted-foreground/60">Page {page} / {PAGES.length}</p>
        </div>
      </div>

      {/* Simulated handwritten answer lines */}
      <div className="flex-1 px-5 py-3 space-y-2 overflow-hidden">
        {lines.map((seed, i) => {
          const width = 40 + (seed % 55);
          const isBold = seed > 70;
          const isBlank = seed < 12;
          return (
            <div
              key={i}
              className={`rounded-sm ${isBlank ? "h-px bg-border/30" : isBold ? "h-2 bg-foreground/25" : "h-1.5 bg-foreground/15"}`}
              style={{ width: `${isBlank ? 100 : width}%` }}
            />
          );
        })}
      </div>

      {/* Footer watermark */}
      <div className="px-5 py-2 border-t border-border/40 flex justify-between items-center">
        <div className="h-1 w-12 rounded bg-foreground/10" />
        <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">Scanned Copy</p>
      </div>
    </div>
  );
};

const EvaluationViewer = () => {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "student";
  const mode = searchParams.get("mode") || "graded";
  const rollNo = searchParams.get("roll") || "230547";
  const navigate = useNavigate();

  const isFaculty = role === "faculty";
  const isFresh = mode === "fresh";
  const hasGrievance = mode === "grievance";

  const subjectCode = subjectId?.toUpperCase() || "N/A";
  const subjectName = SUBJECT_MAP[subjectId?.toLowerCase() || ""] || "Unknown Subject";

  const [activePage, setActivePage] = useState(1);
  const [marks, setMarks] = useState<MarksRow[]>(createEmptyMarks());
  const [grievanceText, setGrievanceText] = useState("");
  const [scriptGrievance, setScriptGrievance] = useState<{ text: string; date: string } | null>(null);

  // Preview dropdown
  const [previewDropdownOpen, setPreviewDropdownOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Recheck accordion
  const [recheckOpen, setRecheckOpen] = useState(false);
  const [missingType, setMissingType] = useState<"pages" | "complete" | null>(null);
  const [missingPages, setMissingPages] = useState("");

  useEffect(() => {
    const script = getScript(rollNo, subjectId || "");
    if (script) {
      setMarks(script.marks);
      if (script.hasGrievance && script.grievanceText) {
        setScriptGrievance({ text: script.grievanceText, date: script.grievanceDate || "" });
      }
    }
  }, [rollNo, subjectId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPreviewDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBack = () => {
    navigate(isFaculty ? "/dashboard/faculty" : "/dashboard/student");
  };

  const handlePrev = () => setActivePage((p) => Math.max(1, p - 1));
  const handleNext = () => setActivePage((p) => Math.min(PAGES.length, p + 1));

  const handleMarkChange = (qIndex: number, part: string, value: string) => {
    const sanitized = value.replace(/[^0-9-]/g, "");
    setMarks((prev) => {
      const updated = prev.map((r) => ({ ...r, parts: { ...r.parts } }));
      updated[qIndex].parts[part] = sanitized;
      return updated;
    });
  };

  const handleSaveMarks = () => {
    saveMarks(rollNo, subjectId || "", marks);
    toast.success("Marks saved successfully.", { duration: 2500 });
  };

  const handleSubmitGrievance = () => {
    if (!grievanceText.trim()) {
      toast.error("Please enter your grievance details.");
      return;
    }
    const prefix = missingType === "pages"
      ? `[Pages Missing: ${missingPages}] `
      : missingType === "complete"
      ? "[Complete Answer Sheet Missing] "
      : "";
    submitGrievance(rollNo, subjectId || "", prefix + grievanceText);
    toast.success("Grievance submitted for re-evaluation.", { duration: 2500 });
    setGrievanceText("");
    setMissingType(null);
    setMissingPages("");
    setRecheckOpen(false);
  };

  const handleAcceptGrievance = () => {
    acceptGrievance(rollNo, subjectId || "", marks);
    toast.success("Grievance accepted. Marks updated.", { duration: 2500 });
    setScriptGrievance(null);
  };

  const handleRejectGrievance = () => {
    rejectGrievance(rollNo, subjectId || "");
    toast.info("Grievance rejected. Student notified.", { duration: 2500 });
    setScriptGrievance(null);
  };

  const selectPreview = (type: PreviewType) => {
    setActivePreview(type);
    setPreviewDropdownOpen(false);
  };

  const totalMarks = computeTotal(marks);
  const modeLabel = isFresh ? "New Evaluation" : hasGrievance ? "Grievance Review" : "Graded";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Evaluation Viewer</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono text-primary">{subjectCode}</span> — {subjectName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${
            isFresh ? "bg-warning/10 text-warning" : hasGrievance ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}>
            {modeLabel}
          </span>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider hidden sm:inline">
            {isFaculty ? "Faculty" : "Student"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left: Answer Sheet as Image */}
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="h-full flex flex-col bg-card/30">
              {/* Page nav tabs */}
              <div className="border-b border-border px-3 py-2 flex items-center gap-1 overflow-x-auto shrink-0">
                <span className="text-xs text-muted-foreground mr-2 shrink-0">Pages:</span>
                {PAGES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePage(p)}
                    className={`shrink-0 w-7 h-7 rounded-md text-xs font-mono font-semibold transition-colors ${
                      activePage === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Answer Sheet Image Viewer */}
              <div className="flex-1 relative flex items-stretch p-4 gap-2">
                <button
                  onClick={handlePrev}
                  disabled={activePage === 1}
                  className="self-center w-8 h-14 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 transition-all shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex-1 min-w-0">
                  <AnswerSheetImage page={activePage} subjectCode={subjectCode} rollNo={rollNo} />
                </div>

                <button
                  onClick={handleNext}
                  disabled={activePage === PAGES.length}
                  className="self-center w-8 h-14 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 transition-all shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="border-t border-border px-4 py-1.5 text-center shrink-0">
                <span className="text-xs text-muted-foreground font-mono">Page {activePage} of {PAGES.length}</span>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Scoring, Preview & Grievance */}
          <ResizablePanel defaultSize={45} minSize={28}>
            <div className="h-full flex flex-col overflow-y-auto">
              {/* Subject info bar */}
              <div className="border-b border-border px-4 py-2.5 shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-foreground">
                    Roll: <span className="font-mono text-primary">{rollNo}</span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-mono text-primary">{subjectCode}</span> — {subjectName}
                  </p>
                </div>

                {/* Preview Dropdown (student only) */}
                {role === "student" && (
                  <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                      onClick={() => setPreviewDropdownOpen((o) => !o)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      📄 Preview Docs
                      <svg className={`w-3 h-3 transition-transform ${previewDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {previewDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                        <button
                          onClick={() => selectPreview(activePreview === "question-paper" ? null : "question-paper")}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${
                            activePreview === "question-paper"
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          📋 Question Paper
                          {activePreview === "question-paper" && <span className="ml-auto text-[10px] text-primary">● Open</span>}
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={() => selectPreview(activePreview === "answer-key" ? null : "answer-key")}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${
                            activePreview === "answer-key"
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          🗝 Answer Key
                          {activePreview === "answer-key" && <span className="ml-auto text-[10px] text-primary">● Open</span>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scrollable Preview Panel (one at a time) */}
              {activePreview && (
                <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
                  <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                      <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                        {activePreview === "question-paper" ? "📋 Question Paper" : "🗝 Answer Key"} — {subjectCode}
                      </h4>
                      <button
                        onClick={() => setActivePreview(null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Scrollable document area */}
                    <div className="h-48 overflow-y-auto p-3 space-y-2">
                      {Array.from({ length: 12 }, (_, i) => {
                        const seed = (i * 13 + (activePreview === "answer-key" ? 50 : 20)) % 100;
                        const isHeading = i % 4 === 0;
                        return (
                          <div key={i} className="space-y-1">
                            {isHeading && (
                              <div className="h-2 w-24 rounded bg-foreground/25 mb-1.5" />
                            )}
                            <div
                              className="h-1.5 rounded bg-foreground/15"
                              style={{ width: `${45 + seed % 50}%` }}
                            />
                            {!isHeading && (
                              <div
                                className="h-1.5 rounded bg-foreground/10"
                                style={{ width: `${30 + (seed * 3) % 55}%` }}
                              />
                            )}
                          </div>
                        );
                      })}
                      <div className="pt-2 text-center">
                        <span className="text-[10px] text-muted-foreground">— End of {activePreview === "question-paper" ? "Question Paper" : "Answer Key"} —</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Marks Breakdown — unchanged */}
              <div className="px-3 py-2.5 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Marks Breakdown</h3>
                  {isFaculty && (
                    <button
                      onClick={handleSaveMarks}
                      className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Save Marks
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-card">
                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-muted-foreground border-b border-r border-border">Q</th>
                        {["a", "b", "c", "d", "e"].map((col) => (
                          <th key={col} className="px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground border-b border-r border-border last:border-r-0 uppercase">{col}</th>
                        ))}
                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-primary border-b border-border">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((row, i) => {
                        const rowTotal = Object.values(row.parts).reduce(
                          (s, v) => s + (v === "-" || v === "" ? 0 : parseInt(v) || 0), 0
                        );
                        return (
                          <tr key={row.q} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                            <td className="px-2 py-1 font-mono font-semibold text-foreground text-xs border-r border-border">{row.q}</td>
                            {(["a", "b", "c", "d", "e"] as const).map((col) => (
                              <td key={col} className="px-1 py-0.5 text-center border-r border-border last:border-r-0">
                                {isFaculty ? (
                                  <input
                                    type="text"
                                    value={row.parts[col]}
                                    onChange={(e) => handleMarkChange(i, col, e.target.value)}
                                    className="w-full text-center font-mono text-xs bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                                  />
                                ) : (
                                  <span className={`font-mono text-xs ${row.parts[col] === "-" ? "text-muted-foreground/50" : "text-foreground"}`}>
                                    {row.parts[col]}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-1 text-center font-mono font-semibold text-primary text-xs">{rowTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-card border-t border-border">
                        <td colSpan={6} className="px-2 py-1.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-r border-border">Grand Total</td>
                        <td className="px-2 py-1.5 text-center font-mono text-sm font-bold text-primary">{totalMarks}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="mx-3 border-t border-border" />

              {/* Recheck / Grievance Section */}
              <div className="px-3 py-2 flex-1 flex flex-col">
                {role === "student" ? (
                  /* Student: accordion recheck */
                  <div className="space-y-1">
                    {/* Accordion header */}
                    <button
                      onClick={() => setRecheckOpen((o) => !o)}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors"
                    >
                      <span className="uppercase tracking-wider">Recheck Request</span>
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${recheckOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Accordion content */}
                    {recheckOpen && (
                      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3 animate-accordion-down">
                        {/* Quick-flag buttons */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Issue Type</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMissingType(missingType === "pages" ? null : "pages")}
                              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium border transition-colors ${
                                missingType === "pages"
                                  ? "bg-warning/15 border-warning/40 text-warning"
                                  : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              }`}
                            >
                              Pages Missing
                            </button>
                            <button
                              onClick={() => setMissingType(missingType === "complete" ? null : "complete")}
                              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium border transition-colors ${
                                missingType === "complete"
                                  ? "bg-destructive/15 border-destructive/40 text-destructive"
                                  : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              }`}
                            >
                              Full Sheet Missing
                            </button>
                          </div>

                          {/* Conditional: page numbers input */}
                          {missingType === "pages" && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-muted-foreground font-medium">
                                Missing Page Numbers
                              </label>
                              <input
                                type="text"
                                value={missingPages}
                                onChange={(e) => setMissingPages(e.target.value)}
                                placeholder="e.g. 3, 5, 7"
                                className="w-full rounded-md border border-warning/40 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning/40 focus:border-warning transition-colors"
                              />
                            </div>
                          )}
                        </div>

                        {/* Comment textarea */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Comments
                          </label>
                          <textarea
                            value={grievanceText}
                            onChange={(e) => setGrievanceText(e.target.value)}
                            placeholder="Describe your concern regarding the evaluation..."
                            rows={3}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                          />
                        </div>

                        <button
                          onClick={handleSubmitGrievance}
                          className="w-full rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-warning-foreground hover:bg-warning/90 transition-colors"
                        >
                          Submit for Re-evaluation
                        </button>
                      </div>
                    )}
                  </div>
                ) : hasGrievance && scriptGrievance ? (
                  /* Faculty: grievance review */
                  <div className="space-y-3 flex flex-col flex-1">
                    <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Student Grievance</h3>
                    <div className="rounded-lg border border-border bg-background/50 p-3 flex-1">
                      <p className="text-xs text-foreground leading-relaxed">{scriptGrievance.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-2 font-mono">Submitted: {scriptGrievance.date}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAcceptGrievance}
                        className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-foreground hover:bg-success/90 transition-colors"
                      >
                        Accept & Update Marks
                      </button>
                      <button
                        onClick={handleRejectGrievance}
                        className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        Reject Grievance
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 py-4">
                    <p className="text-xs text-muted-foreground text-center">
                      {isFresh ? "Evaluate the answer sheet and save marks above." : "No grievance filed for this answer sheet."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default EvaluationViewer;
