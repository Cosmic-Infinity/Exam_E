import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import JSZip from "jszip";
import { useUserSession } from "@/context/UserSessionContext";
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
import { getCachedPage, cachePages } from "@/lib/cacheManager";

// Generate pages 1-30 to support realistic answer sheet scenarios
const PAGES = Array.from({ length: 30 }, (_, i) => i + 1);

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
  "from-blue-950/25 to-indigo-900/35",
  "from-slate-900/35 to-slate-800/45",
  "from-indigo-950/28 to-blue-900/38",
  "from-slate-800/32 to-slate-900/42",
  "from-blue-900/28 to-indigo-950/38",
  "from-slate-900/38 to-blue-950/32",
  "from-indigo-900/35 to-slate-900/45",
  "from-slate-950/30 to-blue-900/40",
  "from-blue-950/32 to-slate-900/38",
  "from-slate-800/35 to-indigo-950/45",
  "from-indigo-950/35 to-slate-800/45",
  "from-blue-900/30 to-slate-900/40",
  "from-slate-900/40 to-blue-950/35",
  "from-indigo-900/32 to-slate-900/42",
  "from-slate-800/38 to-blue-900/48",
  "from-blue-950/35 to-indigo-900/40",
  "from-slate-900/35 to-slate-800/45",
  "from-indigo-950/32 to-blue-950/42",
  "from-slate-950/35 to-slate-800/50",
  "from-blue-900/32 to-indigo-950/42",
  "from-slate-800/36 to-slate-900/46",
  "from-indigo-900/38 to-slate-900/48",
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

// Thumbnail component for next pages preview
const PageThumbnail = ({ 
  page, 
  subjectCode, 
  rollNo, 
  onClick,
  isLoading = false 
}: { 
  page: number; 
  subjectCode: string; 
  rollNo: string; 
  onClick: () => void;
  isLoading?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="relative group flex-1 h-28 rounded-none border border-border/40 bg-card/50 hover:bg-card hover:border-primary/30 transition-all overflow-hidden cursor-pointer hover:shadow-md disabled:opacity-50"
    >
      <div className="w-full h-full scale-75-origin-top-left" style={{ transform: "scale(0.3)", transformOrigin: "top left", pointerEvents: "none" }}>
        <AnswerSheetImage page={page} subjectCode={subjectCode} rollNo={rollNo} />
      </div>
      {/* Overlay label */}
      <div className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-[8px] font-mono font-semibold text-white">Page {page}</p>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <div className="w-3 h-3 rounded-full border border-primary border-t-transparent animate-spin" />
        </div>
      )}
    </button>
  );
};


const EvaluationViewer = () => {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "student";
  const mode = searchParams.get("mode") || "graded";
  const navigate = useNavigate();
  const { user } = useUserSession();

  // Security: Get user ID from session context, not from URL
  // Backend verifies user has access to this data
  if (!user) {
    navigate("/");
    return null;
  }
  const rollNo = user.universityId;

  const isFaculty = role === "faculty";
  const isFresh = mode === "fresh";
  const hasGrievance = mode === "grievance";

  const subjectCode = subjectId?.toUpperCase() || "N/A";
  const subjectName = SUBJECT_MAP[subjectId?.toLowerCase() || ""] || "Unknown Subject";

  const [activePage, setActivePage] = useState(1);
  const [marks, setMarks] = useState<MarksRow[]>(createEmptyMarks());
  const [grievanceText, setGrievanceText] = useState("");
  const [scriptGrievance, setScriptGrievance] = useState<{ text: string; date: string } | null>(null);

  // Thumbnail pages state
  const [nextPageThumbnails, setNextPageThumbnails] = useState<number[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  // Preview dropdown
  const [previewDropdownOpen, setPreviewDropdownOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // Track scroll positions for each preview type independently
  const [previewScrollPositions, setPreviewScrollPositions] = useState<{
    "question-paper": number;
    "answer-key": number;
  }>({
    "question-paper": 0,
    "answer-key": 0,
  });

  // Answer sheet rotation
  const [rotation, setRotation] = useState(0);

  // Drawing mode
  const [drawMode, setDrawMode] = useState<"pencil" | "eraser" | null>(null);
  const [drawDropdownOpen, setDrawDropdownOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const drawDropdownRef = useRef<HTMLDivElement>(null);
  const drawingsRef = useRef<{ [key: number]: ImageData }>({});
  const lastPageRef = useRef<number>(1);
  const answerSheetContainerRef = useRef<HTMLDivElement>(null);

  // Download functionality
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination container for auto-scroll
  const paginationContainerRef = useRef<HTMLDivElement>(null);
  const pageButtonRefs = useRef<{ [key: number]: HTMLButtonElement }>({});

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

  // Fetch and cache next 3 pages when active page changes
  useEffect(() => {
    const fetchAndCacheNextPages = async () => {
      const nextPages = [];
      for (let i = 1; i <= 3; i++) {
        const pageNum = activePage + i;
        if (pageNum <= PAGES.length) {
          nextPages.push(pageNum);
        }
      }

      if (nextPages.length > 0) {
        setLoadingThumbnails(true);
        setNextPageThumbnails(nextPages);
        
        try {
          // Simulate fetching pages from backend and cache them
          // In a real scenario, these would come from an API
          const pagesToCache = nextPages.map(pageNum => ({
            page: pageNum,
            imageBlob: new Blob() // Placeholder - in real app, this comes from backend
          }));
          
          // Cache the pages for later preview
          if (pagesToCache.length > 0) {
            await cachePages(subjectCode, pagesToCache).catch(err => {
              console.log("Cache operation note:", err);
            });
          }
        } catch (error) {
          console.error("Error caching next pages:", error);
        } finally {
          setLoadingThumbnails(false);
        }
      } else {
        setNextPageThumbnails([]);
      }
    };

    fetchAndCacheNextPages();
  }, [activePage, subjectCode]);

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

  // Auto-scroll pagination container when page changes
  useEffect(() => {
    const button = pageButtonRefs.current[activePage];
    if (button && paginationContainerRef.current) {
      // Use scrollIntoView with smooth behavior - more reliable for both directions
      setTimeout(() => {
        button.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }, 0);
    }
  }, [activePage]);

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
    // Save current scroll position before switching
    if (activePreview && previewScrollRef.current) {
      setPreviewScrollPositions((prev) => ({
        ...prev,
        [activePreview]: previewScrollRef.current!.scrollTop,
      }));
    }
    setActivePreview(type);
    setPreviewDropdownOpen(false);
  };

  // Restore scroll position when preview type changes
  useEffect(() => {
    if (activePreview && previewScrollRef.current) {
      // Restore saved scroll position for this preview type
      setTimeout(() => {
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = previewScrollPositions[activePreview];
        }
      }, 0);
    } else if (!activePreview) {
      // Reset both scroll positions when preview is closed
      setPreviewScrollPositions({
        "question-paper": 0,
        "answer-key": 0,
      });
    }
  }, [activePreview]);

  // Drawing functions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !drawMode) return;
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !drawMode || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawMode === "pencil") {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (drawMode === "eraser") {
      ctx.clearRect(x - 20, y - 20, 40, 40);
    }
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleClearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Also remove from stored drawings for this page
      delete drawingsRef.current[activePage];
    }
  };

  // Close draw dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (drawDropdownRef.current && !drawDropdownRef.current.contains(e.target as Node)) {
        setDrawDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Save/restore drawings when page changes
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    // Save the drawing from the previous page BEFORE resizing
    if (lastPageRef.current !== activePage && lastPageRef.current > 0) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        drawingsRef.current[lastPageRef.current] = imageData;
      } catch (e) {
        // Ignore errors in getting image data
      }
    }

    // Get stored drawing dimensions
    const storedDrawing = drawingsRef.current[activePage];
    const storedWidth = storedDrawing ? storedDrawing.width : 0;
    const storedHeight = storedDrawing ? storedDrawing.height : 0;

    // Resize canvas for new page
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Restore drawing for current page if it exists and dimensions match closely
    if (storedDrawing && Math.abs(storedWidth - newWidth) < 50 && Math.abs(storedHeight - newHeight) < 50) {
      try {
        ctx.putImageData(storedDrawing, 0, 0);
      } catch (e) {
        // If dimensions don't match exactly, redraw is not possible, clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else if (!storedDrawing) {
      // Clear canvas for new page with no prior drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Update last page reference
    lastPageRef.current = activePage;
  }, [activePage]);

  // Close download dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
        setDownloadDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Download single page
  const handleDownloadSinglePage = async () => {
    setIsDownloading(true);
    try {
      if (!answerSheetContainerRef.current) {
        toast.error("Failed to capture page");
        return;
      }

      // Get the answer sheet element inside the container
      const element = answerSheetContainerRef.current.querySelector("[class*='bg-gradient']") || 
                      answerSheetContainerRef.current.firstChild as HTMLElement;
      
      if (!element) {
        toast.error("Answer sheet not found");
        return;
      }

      // Create a canvas and draw the HTML element
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        toast.error("Failed to create canvas");
        return;
      }

      const width = element.offsetWidth || 400;
      const height = element.offsetHeight || 600;
      canvas.width = width;
      canvas.height = height;

      // Draw light background
      ctx.fillStyle = "#f5f3ff";
      ctx.fillRect(0, 0, width, height);

      // Draw border
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);

      // Draw header
      ctx.fillStyle = "#5b21b6";
      ctx.font = "bold 14px Arial";
      ctx.fillText("Answer Sheet", 10, 25);
      ctx.font = "12px Arial";
      ctx.fillStyle = "#333";
      ctx.fillText(`Subject: ${subjectCode} | Roll: ${rollNo}`, 10, 45);
      ctx.fillText(`Page: ${activePage} of ${PAGES.length}`, 10, 62);

      // Draw some placeholder lines to represent answer content
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 15; i++) {
        const y = 80 + i * 30;
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(width - 10, y);
        ctx.stroke();
      }

      // Add timestamp
      ctx.fillStyle = "#999";
      ctx.font = "10px Arial";
      ctx.fillText(`Downloaded: ${new Date().toLocaleString()}`, 10, height - 10);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${subjectCode}_page_${activePage}_${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(`Page ${activePage} downloaded successfully`);
        }
      });
      setDownloadDropdownOpen(false);
    } catch (error) {
      toast.error("Download failed");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Download full sheet
  const handleDownloadFullSheet = async () => {
    setIsDownloading(true);
    try {
      toast.success(`Creating ZIP file with all ${PAGES.length} pages...`);
      const zip = new JSZip();
      const pagesFolder = zip.folder('pages');
      
      for (let page = 1; page <= PAGES.length; page++) {
        setActivePage(page);
        
        // Wait for page to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        const element = answerSheetContainerRef.current?.querySelector("[class*='bg-gradient']") ||
                       answerSheetContainerRef.current?.firstChild as HTMLElement;
        
        if (!element) continue;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const width = element.offsetWidth || 400;
        const height = element.offsetHeight || 600;
        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = "#f5f3ff";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);

        ctx.fillStyle = "#5b21b6";
        ctx.font = "bold 14px Arial";
        ctx.fillText("Answer Sheet", 10, 25);
        ctx.font = "12px Arial";
        ctx.fillStyle = "#333";
        ctx.fillText(`Subject: ${subjectCode} | Roll: ${rollNo}`, 10, 45);
        ctx.fillText(`Page: ${page} of ${PAGES.length}`, 10, 62);

        ctx.strokeStyle = "#d4d4d8";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 15; i++) {
          const y = 80 + i * 30;
          ctx.beginPath();
          ctx.moveTo(10, y);
          ctx.lineTo(width - 10, y);
          ctx.stroke();
        }

        ctx.fillStyle = "#999";
        ctx.font = "10px Arial";
        ctx.fillText(`Downloaded: ${new Date().toLocaleString()}`, 10, height - 10);

        // Add page to ZIP with sequential naming (01, 02, 03...)
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob && pagesFolder) {
              const paddedPageNum = String(page).padStart(2, '0');
              pagesFolder.file(`${subjectCode}_page_${paddedPageNum}.png`, blob);
            }
            resolve();
          }, 'image/png');
        });
      }
      
      // Generate ZIP and download
      toast.loading('Generating ZIP file...');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${subjectCode}_complete_sheet_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Complete answer sheet downloaded as ZIP!');
      setDownloadDropdownOpen(false);
    } catch (error) {
      toast.error("Full download failed");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
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
              {/* Page nav tabs with horizontal scroll */}
              <div className="border-b border-border px-3 py-2 shrink-0 flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2 shrink-0">Pages:</span>
                <div
                  ref={paginationContainerRef}
                  className="flex-1 min-w-0 overflow-x-auto"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "hsl(var(--border)) transparent",
                  }}
                >
                  <div className="flex gap-1 pb-0.5">
                    {PAGES.map((p) => (
                      <button
                        key={p}
                        ref={(el) => {
                          if (el) pageButtonRefs.current[p] = el;
                        }}
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
                </div>
              </div>

              {/* Answer Sheet Image Viewer */}
              <div className="flex-1 relative flex items-center justify-center p-4 gap-2 overflow-hidden">
                <button
                  onClick={handlePrev}
                  disabled={activePage === 1}
                  className="absolute left-2 z-20 w-8 h-14 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 transition-all shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="relative flex items-center justify-center h-full" style={{ maxHeight: "100%", maxWidth: "100%" }} ref={answerSheetContainerRef}>
                  <div style={{ transform: `rotate(${rotation}deg)` }}>
                    <AnswerSheetImage page={activePage} subjectCode={subjectCode} rollNo={rollNo} />
                  </div>
                  {/* Drawing Canvas Overlay - Always present, cursor/events change based on drawMode */}
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="absolute inset-0 z-10 transition-opacity"
                    style={{
                      width: "100%",
                      height: "100%",
                      pointerEvents: drawMode ? "auto" : "none",
                      cursor: drawMode ? "crosshair" : "default",
                      backgroundColor: "transparent",
                      opacity: drawMode ? 1 : 0.5,
                    }}
                  />
                </div>

                {/* Rotation Buttons - Top Right Corner */}
                <div className="absolute top-2 right-2 z-30 flex flex-col gap-1">
                  <button
                    onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                    title="Rotate Left (90°)"
                    className="w-8 h-8 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate Right (90°)"
                    className="w-8 h-8 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  >
                    ↻
                  </button>

                  {/* Draw Button with Dropdown */}
                  <div className="relative" ref={drawDropdownRef}>
                    <button
                      onClick={() => setDrawDropdownOpen((o) => !o)}
                      title={drawMode === "pencil" ? "Pencil - Click to change" : drawMode === "eraser" ? "Eraser - Click to change" : "Draw or Erase - Click to select"}
                      className={`w-8 h-8 rounded-lg border border-border flex items-center justify-center transition-colors text-lg ${
                        drawMode
                          ? "bg-primary/80 text-primary-foreground"
                          : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card"
                      }`}
                    >
                      {drawMode === "pencil" ? "✏️" : drawMode === "eraser" ? "⌫" : "✏️"}
                    </button>

                    {drawDropdownOpen && (
                      <div className="absolute right-full mr-1 top-0 z-50 w-32 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                        <button
                          onClick={() => {
                            setDrawMode(drawMode === "pencil" ? null : "pencil");
                            setDrawDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                            drawMode === "pencil"
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          ✏️ Pencil
                          {drawMode === "pencil" && <span className="ml-auto text-[10px] text-primary">● Active</span>}
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={() => {
                            setDrawMode(drawMode === "eraser" ? null : "eraser");
                            setDrawDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                            drawMode === "eraser"
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          ⌫ Eraser
                          {drawMode === "eraser" && <span className="ml-auto text-[10px] text-primary">● Active</span>}
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={() => {
                            handleClearCanvas();
                            setDrawDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Download Button with Dropdown */}
                  <div className="relative" ref={downloadDropdownRef}>
                    <button
                      onClick={() => setDownloadDropdownOpen((o) => !o)}
                      disabled={isDownloading}
                      title="Download answer sheet"
                      className={`w-8 h-8 rounded-lg border border-border flex items-center justify-center transition-colors ${
                        isDownloading
                          ? "bg-primary/50 text-primary-foreground opacity-50 cursor-not-allowed"
                          : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card"
                      }`}
                    >
                      ⬇️
                    </button>

                    {downloadDropdownOpen && (
                      <div className="absolute right-full mr-1 top-0 z-50 w-40 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                        <button
                          onClick={handleDownloadSinglePage}
                          disabled={isDownloading}
                          className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50 disabled:opacity-50"
                        >
                          📄 This Page Only
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={handleDownloadFullSheet}
                          disabled={isDownloading}
                          className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50 disabled:opacity-50"
                        >
                          📦 Full Sheet ({PAGES.length} pages)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={activePage === PAGES.length}
                  className="absolute right-2 z-20 w-8 h-14 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 transition-all shrink-0"
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

                {/* Preview Dropdown */}
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
                        onClick={() => {
                          // Save scroll position before closing
                          if (activePreview && previewScrollRef.current) {
                            setPreviewScrollPositions((prev) => ({
                              ...prev,
                              [activePreview]: previewScrollRef.current!.scrollTop,
                            }));
                          }
                          setActivePreview(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Scrollable document area */}
                    <div ref={previewScrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
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

              {/* Next Pages Thumbnails - Faculty Mode Only */}
              {isFaculty && nextPageThumbnails.length > 0 && (
                <div className="px-1 py-0 border-b border-border shrink-0">
                  <div className="rounded border border-border/60 bg-background/40 overflow-hidden">
                    <div className="p-0 flex gap-0">
                      {nextPageThumbnails.map((pageNum) => (
                        <PageThumbnail
                          key={pageNum}
                          page={pageNum}
                          subjectCode={subjectCode}
                          rollNo={rollNo}
                          onClick={() => {
                            setActivePage(pageNum);
                            // Scroll to top of right panel
                            const scrollContainer = document.querySelector('[class*="flex-col"]');
                            if (scrollContainer) {
                              scrollContainer.scrollTop = 0;
                            }
                          }}
                          isLoading={loadingThumbnails}
                        />
                      ))}
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
