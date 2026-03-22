import { Fragment, useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ArrowLeft, ChevronDown, Download, Eraser, Eye, FileText, FileX2, Files, KeyRound, Pencil, RotateCcw, RotateCw, X } from "lucide-react";
import { useUserSession } from "@/app/context/UserSessionContext";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/app/components/ui/resizable";
import { getScript, saveMarks, submitGrievance, acceptGrievance, rejectGrievance, downloadFile, getStudentGrievancesBySubject } from "@/app/services/evaluationService";
import AuthService from "@/app/services/authService";
import type { StudentGrievanceItem } from "@/app/services/evaluationService";
import { MarksRow, SUBJECT_MAP, createEmptyMarks, computeTotal, getCountedRowIndexes, AnswerScript } from "@/app/types/evaluation";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import { cachePages } from "@/app/utils/cacheManager";
import { resolveAssetUrl } from "@/app/utils/assetResolver";

// Default fallback for simulation
const DEFAULT_TOTAL_PAGES = 30;

type PreviewType = "question-paper" | "answer-key" | null;
const PREVIEW_DOC_CACHE = "exam-preview-docs-v1";
const THUMBNAIL_STRIP_SESSION_KEY = "evaluation-thumbnail-strip-open";
const DRAWINGS_STORAGE_PREFIX = "evaluation-drawings-v1";

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

const THUMBNAIL_CARD_WIDTH = 112;

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21h10"/><path d="M5.586 16.586a2 2 0 0 0 0 2.828l1 1a2 2 0 0 0 2.828 0L20 9.828a2 2 0 0 0 0-2.828l-1-1a2 2 0 0 0-2.828 0z"/><path d="m13.414 6.414 4.172 4.172"/></svg>'
) }") 4 20, crosshair`;

type SavedDrawingPayload = {
  version: 1;
  pages: Record<string, string>;
};

const parseMarkValue = (value: string): number => {
  if (value === "" || value === "-") return 0;
  return Number.parseFloat(value) || 0;
};

const hasImageDataInk = (imageData: ImageData): boolean => {
  const alphaChannelOffset = 3;
  for (let i = alphaChannelOffset; i < imageData.data.length; i += 4) {
    if (imageData.data[i] !== 0) {
      return true;
    }
  }
  return false;
};

const imageDataToDataUrl = (imageData: ImageData): string => {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

const restoreImageDataToCanvas = (canvas: HTMLCanvasElement, imageData: ImageData): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw from an offscreen canvas so annotations survive viewer resizes.
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return;

  sourceCtx.putImageData(imageData, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
};

const restoreDataUrlToCanvas = (canvas: HTMLCanvasElement, dataUrl: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
};

const sanitizeMarkInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const head = cleaned.slice(0, firstDot + 1);
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${head}${tail}`;
};

const buildThumbnailPages = (active: number, total: number, targetCount: number): number[] => {
  if (total <= 0) return [];
  const count = Math.min(targetCount, total);
  let start = active - Math.floor(count / 2);
  let end = start + count - 1;

  if (start < 1) {
    end += 1 - start;
    start = 1;
  }

  if (end > total) {
    start -= end - total;
    end = total;
  }

  start = Math.max(1, start);

  const pages: number[] = [];
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  return pages;
};

const AnswerSheetImage = ({ page, subjectCode, rollNo, src, totalPages }: { page: number; subjectCode: string; rollNo: string; src?: string; totalPages?: number }) => {
  if (src) {
    // If src is provided, use the real image
    // Use resolveAssetUrl to handle LAN/hotspot access correctly
    const imageSrc = resolveAssetUrl(src) || src;

    return (
      <div className="w-full h-full bg-black/5 flex flex-col items-center justify-center overflow-auto">
        <img
          src={imageSrc}
          alt={`Page ${page}`}
          className="max-h-full max-w-full object-contain shadow-lg no-text-recognition-image"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onError={(e) => {
            console.error("Failed to load image:", imageSrc);
            e.currentTarget.style.display = "none"; // Fallback to simulation if load fails
          }}
        />
      </div>
    );
  }

  // Simulate a scanned answer sheet image with deterministic content per page
  const lines = Array.from({ length: 18 }, (_, i) => {
    const seed = (page * 17 + i * 7) % 100;
    return seed;
  });

  return (
    <div className={`w-full h-full rounded-lg border border-border bg-gradient-to-br ${PAGE_COLORS[(page - 1) % PAGE_COLORS.length]} flex flex-col overflow-hidden shadow-xl shadow-black/30`}>
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
          <p className="text-[9px] font-mono text-muted-foreground/60">
            Page {page} / {totalPages}
          </p>
        </div>
      </div>

      {/* Simulated handwritten answer lines */}
      <div className="flex-1 px-5 py-3 space-y-2 overflow-hidden">
        {lines.map((seed, i) => {
          const width = 40 + (seed % 55);
          const isBold = seed > 70;
          const isBlank = seed < 12;
          return <div key={i} className={`rounded-sm ${isBlank ? "h-px bg-border/30" : isBold ? "h-2 bg-foreground/25" : "h-1.5 bg-foreground/15"}`} style={{ width: `${isBlank ? 100 : width}%` }} />;
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
  isLoading = false,
  src,
  totalPages,
  isActive = false,
}: {
  page: number;
  subjectCode: string;
  rollNo: string;
  onClick: () => void;
  isLoading?: boolean;
  src?: string;
  totalPages?: number;
  isActive?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`relative group flex-1 h-28 rounded-none border transition-all overflow-hidden cursor-pointer hover:shadow-md disabled:opacity-50 ${
        isActive ? "border-primary/70 ring-1 ring-primary/40 bg-primary/10" : "border-border/40 bg-card/50 hover:bg-card hover:border-primary/30"
      }`}
    >
      <div className="w-full h-full pointer-events-none">
        <AnswerSheetImage page={page} subjectCode={subjectCode} rollNo={rollNo} src={src} totalPages={totalPages} />
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
  const roleParam = searchParams.get("role");
  const role = roleParam === "faculty" ? "faculty" : "student";
  const mode = searchParams.get("mode") || "graded";
  const panel = searchParams.get("panel");
  const grievanceId = Number(searchParams.get("grievanceId") || "");
  const navigate = useNavigate();
  const { user } = useUserSession();

  // For faculty: get student roll from query params; for students: use own ID
  const rollNo = role === "faculty" && searchParams.get("roll") ? searchParams.get("roll")! : user?.universityId || "";

  const isFaculty = role === "faculty";
  const isFresh = mode === "fresh";
  const hasGrievance = mode === "grievance";

  const subjectCode = subjectId?.toUpperCase() || "N/A";
  const subjectName = SUBJECT_MAP[subjectId?.toLowerCase() || ""] || "Unknown Subject";
  const [headerSubjectCode, setHeaderSubjectCode] = useState(subjectCode);
  const [headerSubjectName, setHeaderSubjectName] = useState(subjectName);

  const [activePage, setActivePage] = useState(1);
  const [currentScript, setCurrentScript] = useState<AnswerScript | null>(null);
  const [marks, setMarks] = useState<MarksRow[]>(createEmptyMarks());
  const [grievanceText, setGrievanceText] = useState("");
  const [scriptGrievance, setScriptGrievance] = useState<{ text: string; date: string } | null>(null);
  const [grievanceHistory, setGrievanceHistory] = useState<StudentGrievanceItem[]>([]);
  const [loadingGrievanceHistory, setLoadingGrievanceHistory] = useState(false);

  // Derived pages list
  const pagesList = currentScript?.pages && currentScript.pages.length > 0 ? currentScript.pages : Array.from({ length: DEFAULT_TOTAL_PAGES }, (_, i) => String(i + 1));

  const totalPages = pagesList.length;

  // Thumbnail pages state
  const [nextPageThumbnails, setNextPageThumbnails] = useState<number[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [thumbnailSlots, setThumbnailSlots] = useState<3 | 5>(3);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [cachedPreviewPaths, setCachedPreviewPaths] = useState<{ "question-paper"?: string; "answer-key"?: string }>({});
  const [thumbnailStripOpen, setThumbnailStripOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.sessionStorage.getItem(THUMBNAIL_STRIP_SESSION_KEY);
    return saved ? saved === "open" : true;
  });
  const [previewPanelHeight, setPreviewPanelHeight] = useState(240);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(240);

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
  const [pencilColor, setPencilColor] = useState<"red" | "green">("red");
  const [drawDropdownOpen, setDrawDropdownOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const drawDropdownRef = useRef<HTMLDivElement>(null);
  const drawingsRef = useRef<{ [key: number]: ImageData }>({});
  const persistedDrawingsRef = useRef<Record<number, string>>({});
  const removedPersistedPagesRef = useRef<Set<number>>(new Set());
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

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (role === "student" && panel === "grievances") {
      setRecheckOpen(true);
    }
  }, [role, panel]);

  useEffect(() => {
    if (!user || !rollNo || !subjectId) {
      return;
    }

    let active = true;
    setLoading(true);
    setNotFound(false);

    const loadScript = async () => {
      try {
        const script = await getScript(rollNo, subjectId || "", role);
        if (!active) return;

        if (!script) {
          setNotFound(true);
          setLoading(false);
          toast.error("Answer sheet not found for this subject.");
          return;
        }

        setMarks(script.marks);
        setCurrentScript(script);

        // Use subject info from script (fetched from backend API in getScript)
        setHeaderSubjectCode(script.subjectCode?.toUpperCase() || subjectCode);
        setHeaderSubjectName(script.subjectName || subjectCode);

        if (script.hasGrievance && script.grievanceText) {
          setScriptGrievance({
            text: script.grievanceText,
            date: script.grievanceDate || "",
          });
        }
      } catch (err) {
        console.error("Failed to load script:", err);
        toast.error("Unable to load answer sheet for this subject.");
        // navigate("/dashboard/student"); // Let user stay and understand why
      } finally {
        if (active) setLoading(false);
      }
    };

    loadScript();

    return () => {
      active = false;
    };
  }, [user, rollNo, subjectId, role, navigate]);

  const getDrawingsStorageKey = () => {
    const identityPart = currentScript?.id || `${rollNo}:${subjectCode}`;
    return `${DRAWINGS_STORAGE_PREFIX}:${identityPart}`;
  };

  const captureCurrentCanvasDrawing = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) return;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (hasImageDataInk(imageData)) {
        drawingsRef.current[activePage] = imageData;
      } else {
        delete drawingsRef.current[activePage];
      }
    } catch {
      // Ignore canvas read errors.
    }
  };

  useEffect(() => {
    if (!currentScript) return;

    try {
      const storageKey = getDrawingsStorageKey();

      // Keep drawings in sync with backend grading lifecycle.
      // If backend state resets this script to pending, clear stale local overlays.
      if (currentScript.status !== "graded") {
        window.localStorage.removeItem(storageKey);
        persistedDrawingsRef.current = {};
        drawingsRef.current = {};
        removedPersistedPagesRef.current.clear();
        return;
      }

      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        persistedDrawingsRef.current = {};
        drawingsRef.current = {};
        removedPersistedPagesRef.current.clear();
        return;
      }

      const parsed = JSON.parse(raw) as SavedDrawingPayload;
      if (!parsed || parsed.version !== 1 || !parsed.pages || typeof parsed.pages !== "object") {
        persistedDrawingsRef.current = {};
        drawingsRef.current = {};
        removedPersistedPagesRef.current.clear();
        return;
      }

      const hydrated: Record<number, string> = {};
      for (const [page, dataUrl] of Object.entries(parsed.pages)) {
        const pageNum = Number(page);
        if (Number.isFinite(pageNum) && pageNum > 0 && typeof dataUrl === "string" && dataUrl.length > 0) {
          hydrated[pageNum] = dataUrl;
        }
      }

      persistedDrawingsRef.current = hydrated;
      drawingsRef.current = {};
      removedPersistedPagesRef.current.clear();
    } catch {
      persistedDrawingsRef.current = {};
      drawingsRef.current = {};
      removedPersistedPagesRef.current.clear();
    }
  }, [currentScript?.id, currentScript?.status, rollNo, subjectCode]);

  useEffect(() => {
    if (!currentScript) return;

    const timeoutId = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = ensureCanvasReadyForCurrentPage();
      if (!ctx) return;

      const storedDrawing = drawingsRef.current[activePage];
      if (!storedDrawing && persistedDrawingsRef.current[activePage]) {
        void restoreDataUrlToCanvas(canvas, persistedDrawingsRef.current[activePage]);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentScript?.id]);

  // Dynamically switch thumbnail density based on available width in strip area.
  useEffect(() => {
    const strip = thumbnailStripRef.current;
    if (!strip) return;

    const updateSlots = () => {
      const width = strip.clientWidth;
      const cardsFit = Math.floor(width / THUMBNAIL_CARD_WIDTH);
      setThumbnailSlots(cardsFit >= 5 ? 5 : 3);
    };

    updateSlots();
    const observer = new ResizeObserver(updateSlots);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [nextPageThumbnails.length]);

  // Compute centered thumbnail pages and cache visible neighboring pages.
  useEffect(() => {
    const refreshThumbnailPages = async () => {
      const visiblePages = buildThumbnailPages(activePage, totalPages, thumbnailSlots);

      setNextPageThumbnails(visiblePages);

      if (visiblePages.length > 0) {
        setLoadingThumbnails(true);

        try {
          const pagesToCache = visiblePages
            .filter((pageNum) => pageNum !== activePage)
            .map((pageNum) => ({
              page: pageNum,
              imageBlob: new Blob(),
            }));

          if (pagesToCache.length > 0) {
            await cachePages(subjectCode, pagesToCache).catch((err) => {
              console.log("Cache operation note:", err);
            });
          }
        } catch (error) {
          console.error("Error caching next pages:", error);
        } finally {
          setLoadingThumbnails(false);
        }
      }
    };

    refreshThumbnailPages();
  }, [activePage, totalPages, thumbnailSlots, subjectCode]);

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
          inline: "nearest",
        });
      }, 0);
    }
  }, [activePage]);

  const handleBack = () => {
    navigate(isFaculty ? "/dashboard/faculty" : "/dashboard/student");
  };

  const handlePrev = () => setActivePage((p) => Math.max(1, p - 1));
  const handleNext = () => setActivePage((p) => Math.min(totalPages, p + 1));

  const handleMarkChange = (qIndex: number, part: string, value: string) => {
    const sanitizedValue = sanitizeMarkInput(value);

    setMarks((prev) => {
      const updated = prev.map((r) => ({ ...r, parts: { ...r.parts } }));
      updated[qIndex].parts[part] = sanitizedValue;
      return updated;
    });
  };

  const getInvalidMarkEntries = () => {
    const invalid: Array<{ q: string; part: string; expected: number; awarded: number }> = [];
    for (const row of marks) {
      for (const partKey of Object.keys(row.parts)) {
        const expected = Number(row.expectedParts?.[partKey] ?? 0);
        const awarded = parseMarkValue(row.parts[partKey] ?? "");

        if (awarded < 0 || awarded > expected) {
          invalid.push({ q: row.q, part: partKey, expected, awarded });
        }
      }
    }
    return invalid;
  };

  const invalidMarkEntries = getInvalidMarkEntries();
  const hasInvalidMarks = invalidMarkEntries.length > 0;

  const validateMarksWithinExpected = (): string | null => {
    const firstInvalid = invalidMarkEntries[0];
    if (firstInvalid) {
      return `${firstInvalid.q} part ${firstInvalid.part.toUpperCase()} is ${firstInvalid.awarded}, max is ${firstInvalid.expected}.`;
    }
    return null;
  };

  const handleSaveMarks = () => {
    const persistSavedDrawings = async () => {
      captureCurrentCanvasDrawing();

      const merged: Record<number, string> = { ...persistedDrawingsRef.current };

      for (const [page, imageData] of Object.entries(drawingsRef.current)) {
        const pageNum = Number(page);
        if (!Number.isFinite(pageNum) || pageNum <= 0) continue;

        if (hasImageDataInk(imageData)) {
          const dataUrl = imageDataToDataUrl(imageData);
          if (dataUrl) {
            merged[pageNum] = dataUrl;
          }
        } else {
          delete merged[pageNum];
        }
      }

      for (const pageNum of removedPersistedPagesRef.current) {
        delete merged[pageNum];
      }

      const payload: SavedDrawingPayload = {
        version: 1,
        pages: Object.fromEntries(Object.entries(merged).map(([page, dataUrl]) => [String(page), dataUrl])),
      };

      window.localStorage.setItem(getDrawingsStorageKey(), JSON.stringify(payload));
      persistedDrawingsRef.current = merged;
      removedPersistedPagesRef.current.clear();
    };

    const runSave = async () => {
      const validationError = validateMarksWithinExpected();
      if (validationError) {
        toast.error(validationError);
        return;
      }

      await saveMarks(rollNo, subjectId || "", marks, role as "student" | "faculty");
      await persistSavedDrawings();
      toast.success("Marks saved successfully.", { duration: 2500 });
    };

    runSave().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not save marks.");
    });
  };

  const handleSubmitGrievance = () => {
    if (!grievanceText.trim()) {
      toast.error("Please enter your grievance details.");
      return;
    }
    const prefix = missingType === "pages" ? `[Pages Missing: ${missingPages}] ` : missingType === "complete" ? "[Complete Answer Sheet Missing] " : "";
    (async () => {
      try {
        await submitGrievance(rollNo, subjectId || "", prefix + grievanceText);
        toast.success("Grievance submitted for re-evaluation.", { duration: 2500 });
        setGrievanceText("");
        setMissingType(null);
        setMissingPages("");
        setRecheckOpen(false);

        if (!isFaculty && subjectId) {
          const items = await getStudentGrievancesBySubject(subjectId);
          setGrievanceHistory(items);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not submit grievance.");
      }
    })();
  };

  useEffect(() => {
    if (isFaculty || !subjectId) {
      setGrievanceHistory([]);
      return;
    }

    let active = true;
    const loadGrievanceHistory = async () => {
      setLoadingGrievanceHistory(true);
      try {
        const items = await getStudentGrievancesBySubject(subjectId);
        if (active) {
          setGrievanceHistory(items);
        }
      } catch {
        if (active) {
          setGrievanceHistory([]);
        }
      } finally {
        if (active) {
          setLoadingGrievanceHistory(false);
        }
      }
    };

    loadGrievanceHistory();
    return () => {
      active = false;
    };
  }, [isFaculty, subjectId]);

  const handleAcceptGrievance = async () => {
    try {
      await acceptGrievance(rollNo, subjectId || "", marks, Number.isFinite(grievanceId) && grievanceId > 0 ? grievanceId : undefined);
      toast.success("Grievance accepted. Marks updated.", { duration: 2500 });
      setScriptGrievance(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resolve grievance.");
    }
  };

  const handleRejectGrievance = async () => {
    try {
      await rejectGrievance(rollNo, subjectId || "", Number.isFinite(grievanceId) && grievanceId > 0 ? grievanceId : undefined);
      toast.info("Grievance rejected. Student notified.", { duration: 2500 });
      setScriptGrievance(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reject grievance.");
    }
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

  const handleDownloadPreviewDoc = (type: "question-paper" | "answer-key") => {
    const rawPath = type === "question-paper" ? currentScript?.question_paper_path : currentScript?.answer_key_path;
    if (!rawPath) {
      toast.error(type === "question-paper" ? "Question paper is not available" : "Answer key is not available");
      return;
    }

    const suffix = type === "question-paper" ? "Question_Paper" : "Answer_Key";
    const extMatch = rawPath.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const ext = extMatch?.[1] || "pdf";
    const resolvedPath = resolveAssetUrl(rawPath) || rawPath;
    downloadFile(resolvedPath, `${subjectCode}_${suffix}.${ext}`);
    setPreviewDropdownOpen(false);
  };

  const getPreviewEmbedSrc = (url?: string) => {
    if (!url) return undefined;
    const [base] = url.split("#");
    return `${base}#view=FitH&navpanes=0&toolbar=0&statusbar=0`;
  };

  const getCachedPreviewUrl = async (rawPath?: string): Promise<string | undefined> => {
    const resolvedPath = resolveAssetUrl(rawPath);
    if (!resolvedPath) return undefined;

    try {
      if (!("caches" in window)) {
        const fetched = await fetch(resolvedPath, { credentials: "include" });
        if (!fetched.ok) return resolvedPath;
        const blob = await fetched.blob();
        return blob.size ? URL.createObjectURL(blob) : resolvedPath;
      }

      const isPdfResponse = (res?: Response | null) => {
        if (!res) return false;
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        return contentType.includes("application/pdf") || contentType.includes("application/octet-stream");
      };

      const fetchAndCache = async (cache: Cache, request: Request) => {
        const fetched = await fetch(resolvedPath, { credentials: "include", cache: "no-store" });
        if (!fetched.ok || !isPdfResponse(fetched)) return undefined;
        const networkBlob = await fetched.clone().blob();
        if (!networkBlob.size) return undefined;
        await cache.put(request, fetched.clone());
        return URL.createObjectURL(networkBlob);
      };

      const request = new Request(resolvedPath, { method: "GET", credentials: "include" });
      const cache = await caches.open(PREVIEW_DOC_CACHE);
      const cachedResponse = await cache.match(request);

      if (cachedResponse && isPdfResponse(cachedResponse)) {
        const cachedBlob = await cachedResponse.clone().blob();
        if (cachedBlob.size) {
          return URL.createObjectURL(cachedBlob);
        }
        await cache.delete(request);
      } else if (cachedResponse) {
        await cache.delete(request);
      }

      const refreshedUrl = await fetchAndCache(cache, request);
      return refreshedUrl || resolvedPath;
    } catch {
      return resolvedPath;
    }
  };

  useEffect(() => {
    let active = true;
    let questionBlobUrl: string | undefined;
    let keyBlobUrl: string | undefined;

    const warmPreviewDocs = async () => {
      const questionUrl = await getCachedPreviewUrl(currentScript?.question_paper_path);
      const keyUrl = await getCachedPreviewUrl(currentScript?.answer_key_path);

      if (!active) {
        if (questionUrl?.startsWith("blob:")) URL.revokeObjectURL(questionUrl);
        if (keyUrl?.startsWith("blob:")) URL.revokeObjectURL(keyUrl);
        return;
      }

      questionBlobUrl = questionUrl;
      keyBlobUrl = keyUrl;
      setCachedPreviewPaths({
        "question-paper": questionUrl,
        "answer-key": keyUrl,
      });
    };

    warmPreviewDocs();

    return () => {
      active = false;
      if (questionBlobUrl?.startsWith("blob:")) URL.revokeObjectURL(questionBlobUrl);
      if (keyBlobUrl?.startsWith("blob:")) URL.revokeObjectURL(keyBlobUrl);
    };
  }, [currentScript?.question_paper_path, currentScript?.answer_key_path]);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(THUMBNAIL_STRIP_SESSION_KEY, thumbnailStripOpen ? "open" : "closed");
    }
  }, [thumbnailStripOpen]);

  useEffect(() => {
    if (!isResizingPreview) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaY = event.clientY - resizeStartYRef.current;
      const minHeight = 150;
      const maxHeight = Math.max(minHeight + 80, Math.floor(window.innerHeight * 0.72));
      const nextHeight = Math.min(Math.max(resizeStartHeightRef.current + deltaY, minHeight), maxHeight);
      setPreviewPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setIsResizingPreview(false);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizingPreview]);

  const handlePreviewResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartYRef.current = event.clientY;
    resizeStartHeightRef.current = previewPanelHeight;
    setIsResizingPreview(true);
  };

  const ensureCanvasReadyForCurrentPage = (): CanvasRenderingContext2D | null => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const host = answerSheetContainerRef.current || canvas.parentElement;
    if (!host) return ctx;

    const width = Math.floor(host.getBoundingClientRect().width || host.clientWidth || host.offsetWidth);
    const height = Math.floor(host.getBoundingClientRect().height || host.clientHeight || host.offsetHeight);

    if (!width || !height) {
      return ctx;
    }

    const needsResize = canvas.width !== width || canvas.height !== height;
    if (!needsResize) {
      return ctx;
    }

    // Preserve current-page unsaved ink before resize clears canvas bitmap.
    try {
      if (canvas.width > 0 && canvas.height > 0) {
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (hasImageDataInk(currentImageData)) {
          drawingsRef.current[activePage] = currentImageData;
        }
      }
    } catch {
      // Ignore snapshot errors and continue resize flow.
    }

    canvas.width = width;
    canvas.height = height;

    const pageDrawing = drawingsRef.current[activePage];
    if (pageDrawing) {
      restoreImageDataToCanvas(canvas, pageDrawing);
    } else if (persistedDrawingsRef.current[activePage]) {
      void restoreDataUrlToCanvas(canvas, persistedDrawingsRef.current[activePage]);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return ctx;
  };

  // Drawing functions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !drawMode) return;
    isDrawingRef.current = true;
    removedPersistedPagesRef.current.delete(activePage);
    const canvas = canvasRef.current;
    const ctx = ensureCanvasReadyForCurrentPage();
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
      ctx.strokeStyle = pencilColor === "green" ? "rgba(34, 197, 94, 0.85)" : "rgba(255, 0, 0, 0.8)";
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
      removedPersistedPagesRef.current.add(activePage);
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
        if (hasImageDataInk(imageData)) {
          drawingsRef.current[lastPageRef.current] = imageData;
        } else {
          delete drawingsRef.current[lastPageRef.current];
        }
      } catch {
        // Ignore errors in getting image data
      }
    }

    // Get stored drawing dimensions
    const storedDrawing = drawingsRef.current[activePage];

    // Resize canvas for new page
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Restore drawing for current page if it exists and dimensions match closely
    if (storedDrawing) {
      try {
        restoreImageDataToCanvas(canvas, storedDrawing);
      } catch {
        // If dimensions don't match exactly, redraw is not possible, clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else if (persistedDrawingsRef.current[activePage]) {
      void restoreDataUrlToCanvas(canvas, persistedDrawingsRef.current[activePage]);
    } else if (!storedDrawing) {
      // Clear canvas for new page with no prior drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Ensure first open has correct canvas dimensions even when layout settles late.
    let retryTimeoutId: number | null = null;
    let retries = 0;
    const maxRetries = 12;

    const syncSettledCanvas = () => {
      if (!canvasRef.current || !answerSheetContainerRef.current) return;

      const settledCanvas = canvasRef.current;
      const settledWidth = answerSheetContainerRef.current.offsetWidth;
      const settledHeight = answerSheetContainerRef.current.offsetHeight;

      if (!settledWidth || !settledHeight) {
        if (retries < maxRetries) {
          retries += 1;
          retryTimeoutId = window.setTimeout(syncSettledCanvas, 50);
        }
        return;
      }

      const settledCtx = settledCanvas.getContext("2d");
      if (!settledCtx) return;

      if (settledCanvas.width !== settledWidth || settledCanvas.height !== settledHeight) {
        settledCanvas.width = settledWidth;
        settledCanvas.height = settledHeight;
      }

      const pageDrawing = drawingsRef.current[activePage];
      if (pageDrawing) {
        restoreImageDataToCanvas(settledCanvas, pageDrawing);
      } else if (persistedDrawingsRef.current[activePage]) {
        void restoreDataUrlToCanvas(settledCanvas, persistedDrawingsRef.current[activePage]);
      } else {
        settledCtx.clearRect(0, 0, settledCanvas.width, settledCanvas.height);
      }
    };

    const timeoutId = window.setTimeout(syncSettledCanvas, 0);

    // Update last page reference
    lastPageRef.current = activePage;

    return () => {
      window.clearTimeout(timeoutId);
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [activePage, currentScript?.id]);

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

  // Download single page from backend
  const handleDownloadSinglePage = async () => {
    setIsDownloading(true);
    try {
      if (!currentScript || !currentScript.pages || currentScript.pages.length === 0) {
        toast.error("Answer sheet pages not available");
        return;
      }

      const pageIndex = activePage - 1;
      if (pageIndex < 0 || pageIndex >= currentScript.pages.length) {
        toast.error(`Page ${activePage} is out of range`);
        return;
      }

      const filePath = currentScript.pages[pageIndex];
      if (!filePath) {
        toast.error(`Page ${activePage} file path not found`);
        return;
      }

      const fileName = `${subjectCode}_Page_${String(activePage).padStart(2, "0")}.jpg`;
      downloadFile(filePath, fileName);
      toast.success(`Page ${activePage} downloaded successfully`);
      setDownloadDropdownOpen(false);
    } catch (error) {
      toast.error("Failed to download page");
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper to fetch image as base64 for PDF with MIME-aware format detection.
  const fetchImageForPDF = async (url: string): Promise<{ dataUrl: string; format: "JPEG" | "PNG"; sourceUrl: string }> => {
    const fetchUrl = resolveAssetUrl(url) || (url.startsWith("/media/") ? url : `/media/${url}`);
    const response = await fetch(fetchUrl, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status}) from ${fetchUrl}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`Expected image content but received '${contentType || "unknown"}' from ${fetchUrl}`);
    }

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const format: "JPEG" | "PNG" = contentType.includes("png") ? "PNG" : "JPEG";
    return { dataUrl, format, sourceUrl: fetchUrl };
  };

  const generatePDF = async (includeMarks: boolean) => {
    setIsDownloading(true);
    try {
      if (!currentScript || !currentScript.pages || currentScript.pages.length === 0) {
        toast.error("Answer sheet pages not available");
        setIsDownloading(false);
        return;
      }

      const toastId = toast.loading(`Generating PDF (${currentScript.pages.length} pages)...`);

      // Initialize PDF (A4 default)
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let pagesAdded = 0;

      for (let i = 0; i < currentScript.pages.length; i++) {
        const filePath = currentScript.pages[i];
        if (!filePath) continue;

        try {
          const { dataUrl, format } = await fetchImageForPDF(filePath);

          if (pagesAdded > 0) pdf.addPage();

          // Get image dimensions to fit within PDF page while maintaining aspect ratio
          const imgProps = pdf.getImageProperties(dataUrl);
          const ratio = imgProps.width / imgProps.height;

          // Use nearly full page width (with small margin), calculate height
          const margin = 10;
          const displayWidth = pageWidth - margin * 2;
          const displayHeight = displayWidth / ratio;

          // Center the image if it fits, else scale to fit height
          if (displayHeight > pageHeight - margin * 2) {
            // Too tall, scale by height
            const scaledHeight = pageHeight - margin * 2;
            const scaledWidth = scaledHeight * ratio;
            pdf.addImage(dataUrl, format, (pageWidth - scaledWidth) / 2, margin, scaledWidth, scaledHeight);
          } else {
            // Fits by width
            pdf.addImage(dataUrl, format, margin, margin, displayWidth, displayHeight);
          }

          pagesAdded++;
        } catch (error) {
          console.error(`Error processing page ${i + 1}`, error);
        }
      }

      if (pagesAdded === 0) {
        toast.error("Failed to generate PDF pages");
        toast.dismiss(toastId);
        setIsDownloading(false);
        return;
      }

      if (includeMarks) {
        toast.message("Adding current subject marks to PDF...", { id: toastId });
        try {
          const rowTable = marks.flatMap((row, idx) => {
            const partKeys = Object.keys(row.parts).sort();
            const rowTotal = partKeys.reduce((sum, key) => sum + parseMarkValue(row.parts[key] ?? ""), 0);
            const expectedTotal = row.expectedTotal ?? partKeys.reduce((sum, key) => sum + Number(row.expectedParts?.[key] ?? 0), 0);
            const isCounted = countedRowIndexes.has(idx);

            const partRows = partKeys.map((partKey) => [
              row.q,
              partKey.toUpperCase(),
              String(parseMarkValue(row.parts[partKey] ?? "")),
              String(Number(row.expectedParts?.[partKey] ?? 0)),
              isCounted ? "Yes" : "No",
            ]);

            return [...partRows, [row.q, "TOTAL", String(rowTotal), String(expectedTotal), isCounted ? "Counted" : "Excluded"]];
          });

          pdf.addPage();
          pdf.setFontSize(16);
          pdf.text("Current Subject Marks", 14, 20);

          pdf.setFontSize(10);
          pdf.text(`Student ID: ${rollNo}`, 14, 28);
          pdf.text(`Subject: ${headerSubjectCode} - ${headerSubjectName}`, 14, 33);
          pdf.text(`Grand Total: ${totalMarks}`, 14, 38);
          pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 43);

          autoTable(pdf, {
            startY: 48,
            head: [["Question", "Part", "Awarded", "Max", "Counted"]],
            body: rowTable,
            theme: "striped",
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235] },
          });
        } catch (e) {
          console.error("Failed to add current subject marks for PDF", e);
          toast.error("Could not add current subject marks page");
        }
      }

      const fileName = `${subjectCode}_${includeMarks ? "Full_Report" : "Answer_Sheet"}.pdf`;
      pdf.save(fileName);

      toast.success("PDF downloaded successfully!", { id: toastId });
      setDownloadDropdownOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // Download full sheet as PDF
  const handleDownloadFullSheet = () => generatePDF(false);

  // Download full sheet + Marks as PDF
  const handleDownloadWithMarks = () => generatePDF(true);

  const countedRowIndexes = getCountedRowIndexes(marks);
  const totalMarks = computeTotal(marks);
  const hasOptionalRule = marks.some((row) => (row.sectionType || "").toUpperCase() === "OPTIONAL" && Number(row.sectionChoose || 0) > 0);
  const modeLabel = isFresh ? "New Evaluation" : hasGrievance ? "Grievance Review" : "Graded";

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
          >
            <span className="flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back
            </span>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Evaluation Viewer</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono text-primary">{headerSubjectCode}</span> — {headerSubjectName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${isFresh ? "bg-warning/10 text-warning" : hasGrievance ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
            {modeLabel}
          </span>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider hidden sm:inline">{isFaculty ? "Faculty" : "Student"}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center text-muted-foreground bg-background">
            <FileX2 className="w-16 h-16 text-muted-foreground/70" aria-hidden="true" />
            <p className="max-w-md text-lg">
              No answer sheet found for subject <span className="font-mono font-bold text-foreground">{subjectCode}</span>.
            </p>
            <p className="text-sm text-muted-foreground/80">Please check with your faculty coordinator if it has been uploaded or if you are enrolled in this course.</p>
            <button onClick={() => navigate("/dashboard/student")} className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
              Return to Dashboard
            </button>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left: Answer Sheet as Image */}
            <ResizablePanel defaultSize={55} minSize={35}>
              <div className="h-full flex flex-col bg-card/30">
                {/* Vertical pagination + viewer row */}
                <div className="flex-1 h-full min-h-0 flex flex-row overflow-hidden">
                  <div className="w-16 h-full shrink-0 border-r border-border bg-card/40 flex flex-col" style={{ maxHeight: "calc(100vh - 150px)", flexShrink: 0 }}>
                    <div className="px-2 py-2 border-b border-border/70 text-center shrink-0">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Pages</span>
                    </div>
                    <div
                      ref={paginationContainerRef}
                      className="pagination-visible-scroll flex-1 h-full max-h-full overflow-y-scroll overflow-x-hidden px-2 py-2"
                      style={{ maxHeight: "calc(100vh - 150px)" }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            ref={(el) => {
                              if (el) pageButtonRefs.current[p] = el;
                            }}
                            onClick={() => setActivePage(p)}
                            className={`w-10 h-8 rounded-md text-xs font-mono font-semibold transition-colors ${
                              activePage === p ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

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
                        <AnswerSheetImage
                          page={activePage}
                          subjectCode={subjectCode}
                          rollNo={rollNo}
                          totalPages={totalPages}
                          src={currentScript?.pages ? currentScript.pages[activePage - 1] : undefined}
                        />
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
                          cursor: drawMode === "eraser" ? ERASER_CURSOR : drawMode ? "crosshair" : "default",
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
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        title="Rotate Right (90°)"
                        className="w-8 h-8 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                      >
                        <RotateCw className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Draw Button with Dropdown - Only for Faculty */}
                      {isFaculty && (
                        <div className="relative" ref={drawDropdownRef}>
                          <button
                            onClick={() => setDrawDropdownOpen((o) => !o)}
                            title={drawMode === "pencil" ? "Pencil - Click to change" : drawMode === "eraser" ? "Eraser - Click to change" : "Draw or Erase - Click to select"}
                            className={`w-8 h-8 rounded-lg border border-border flex items-center justify-center transition-colors ${
                              drawMode ? "bg-primary/80 text-primary-foreground" : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card"
                            }`}
                          >
                            {drawMode === "eraser" ? <Eraser className="w-4 h-4" aria-hidden="true" /> : <Pencil className="w-4 h-4" aria-hidden="true" />}
                          </button>

                          {drawDropdownOpen && (
                            <div className="absolute right-full mr-1 top-0 z-50 w-32 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                              <button
                                onClick={() => {
                                  const nextMode = drawMode === "pencil" ? null : "pencil";
                                  setDrawMode(nextMode);
                                  if (nextMode === "pencil") {
                                    setPencilColor("red");
                                  }
                                  setDrawDropdownOpen(nextMode === "pencil");
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                                  drawMode === "pencil" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                Pencil
                                {drawMode === "pencil" && <span className="ml-auto text-[10px] text-primary">● Active</span>}
                              </button>
                              {drawMode === "pencil" && (
                                <>
                                  <div className="h-px bg-border" />
                                  <div className="px-3 py-2 flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setPencilColor("red");
                                        setDrawDropdownOpen(false);
                                      }}
                                      aria-label="Red pencil"
                                      title="Red pencil"
                                      className={`w-5 h-5 rounded-full border-2 ${pencilColor === "red" ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                      style={{ backgroundColor: "rgb(239 68 68)" }}
                                    />
                                    <button
                                      onClick={() => {
                                        setPencilColor("green");
                                        setDrawDropdownOpen(false);
                                      }}
                                      aria-label="Green pencil"
                                      title="Green pencil"
                                      className={`w-5 h-5 rounded-full border-2 ${pencilColor === "green" ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                      style={{ backgroundColor: "rgb(34 197 94)" }}
                                    />
                                  </div>
                                </>
                              )}
                              <div className="h-px bg-border" />
                              <button
                                onClick={() => {
                                  setDrawMode(drawMode === "eraser" ? null : "eraser");
                                  setDrawDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                                  drawMode === "eraser" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                                }`}
                              >
                                <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                                Eraser
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
                      )}

                      {/* Download Button with Dropdown */}
                      <div className="relative" ref={downloadDropdownRef}>
                        <button
                          onClick={() => setDownloadDropdownOpen((o) => !o)}
                          disabled={isDownloading}
                          title="Download answer sheet"
                          className={`w-8 h-8 rounded-lg border border-border flex items-center justify-center transition-colors ${
                            isDownloading ? "bg-primary/50 text-primary-foreground opacity-50 cursor-not-allowed" : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card"
                          }`}
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </button>

                        {downloadDropdownOpen && (
                          <div className="absolute right-full mr-1 top-0 z-50 w-52 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                            <button
                              onClick={handleDownloadSinglePage}
                              disabled={isDownloading}
                              className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50 disabled:opacity-50"
                            >
                              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                              This Page Only
                            </button>
                            <div className="h-px bg-border" />
                            <button
                              onClick={handleDownloadFullSheet}
                              disabled={isDownloading}
                              className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50 disabled:opacity-50"
                            >
                              <Files className="w-3.5 h-3.5" aria-hidden="true" />
                              Full Sheet (PDF)
                            </button>
                            <div className="h-px bg-border" />
                            <button
                              onClick={handleDownloadWithMarks}
                              disabled={isDownloading}
                              className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50 disabled:opacity-50"
                            >
                              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                              Full Sheet + Marks
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleNext}
                      disabled={activePage === totalPages}
                      className="absolute right-2 z-20 w-8 h-14 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 transition-all shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="border-t border-border px-4 py-1.5 text-center shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">
                    Page {activePage} of {totalPages}
                  </span>
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
                      <span className="font-mono text-primary">{headerSubjectCode}</span> — {headerSubjectName}
                    </p>
                  </div>

                  {/* Preview Dropdown */}
                  <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                      onClick={() => setPreviewDropdownOpen((o) => !o)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Preview Docs
                      <ChevronDown className={`w-3 h-3 transition-transform ${previewDropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    {previewDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-xl shadow-black/30 overflow-hidden">
                        <button
                          onClick={() => selectPreview(activePreview === "question-paper" ? null : "question-paper")}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${
                            activePreview === "question-paper" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                          Question Paper
                          {activePreview === "question-paper" && <span className="ml-auto text-[10px] text-primary">● Open</span>}
                          {!isFaculty && currentScript?.question_paper_path && (
                            <span className="ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPreviewDoc("question-paper");
                                }}
                                className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted/70"
                                title="Download question paper"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={() => selectPreview(activePreview === "answer-key" ? null : "answer-key")}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${
                            activePreview === "answer-key" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                          Answer Key
                          {activePreview === "answer-key" && <span className="ml-auto text-[10px] text-primary">● Open</span>}
                          {!isFaculty && currentScript?.answer_key_path && (
                            <span className="ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPreviewDoc("answer-key");
                                }}
                                className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted/70"
                                title="Download answer key"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </button>
                        {isFaculty && (
                          <>
                            <div className="h-px bg-border" />
                            <button
                              onClick={() => {
                                setThumbnailStripOpen((prev) => !prev);
                                setPreviewDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 text-foreground hover:bg-muted/50"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              {thumbnailStripOpen ? "Hide Thumbnails" : "Show Thumbnails"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Pages Thumbnails - Faculty Mode Only */}
                {isFaculty && thumbnailStripOpen && nextPageThumbnails.length > 0 && (
                  <div className="px-1 py-0 border-b border-border shrink-0">
                    <div className="rounded border border-border/60 bg-background/40 overflow-hidden">
                      <div ref={thumbnailStripRef} className="p-0 flex gap-0">
                        {nextPageThumbnails.map((pageNum) => (
                          <div key={pageNum} className="flex-1 min-w-0">
                            <PageThumbnail
                              page={pageNum}
                              subjectCode={subjectCode}
                              rollNo={rollNo}
                              src={currentScript?.pages ? currentScript.pages[pageNum - 1] : undefined}
                              totalPages={totalPages}
                              isActive={pageNum === activePage}
                              onClick={() => {
                                setActivePage(pageNum);
                                const scrollContainer = document.querySelector('[class*="flex-col"]');
                                if (scrollContainer) {
                                  scrollContainer.scrollTop = 0;
                                }
                              }}
                              isLoading={loadingThumbnails}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrollable Preview Panel (one at a time) */}
                {activePreview && (
                  <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
                    <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                        <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                          {activePreview === "question-paper" ? "Question Paper" : "Answer Key"} — {subjectCode}
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
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      {/* PDF Viewer or Fallback */}
                      <div ref={previewScrollRef} className="overflow-y-auto bg-black/5" style={{ height: `${previewPanelHeight}px` }}>
                        {activePreview === "question-paper" && currentScript?.question_paper_path ? (
                          <iframe
                            src={getPreviewEmbedSrc(cachedPreviewPaths["question-paper"] || resolveAssetUrl(currentScript.question_paper_path))}
                            className="w-full h-full border-0"
                            title="Question Paper"
                          />
                        ) : activePreview === "answer-key" && currentScript?.answer_key_path ? (
                          <iframe
                            src={getPreviewEmbedSrc(cachedPreviewPaths["answer-key"] || resolveAssetUrl(currentScript.answer_key_path))}
                            className="w-full h-full border-0"
                            title="Answer Key"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            <span>{activePreview === "question-paper" ? "Question Paper not available" : "Answer Key not available"}</span>
                          </div>
                        )}
                      </div>
                      <div
                        onMouseDown={handlePreviewResizeStart}
                        className={`h-3 border-t border-border ${isResizingPreview ? "bg-primary/25" : "bg-muted/40 hover:bg-muted/70"} cursor-row-resize transition-colors`}
                        title="Drag to resize document preview"
                      />
                    </div>
                  </div>
                )}

                {isResizingPreview && <div className="fixed inset-0 z-[120] cursor-row-resize" aria-hidden="true" />}

                {/* Marks Breakdown — unchanged */}
                <div className="px-3 py-2.5 space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Marks Breakdown</h3>
                    {isFaculty && (
                      <button
                        onClick={handleSaveMarks}
                        disabled={hasInvalidMarks}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          hasInvalidMarks ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        Save Marks
                      </button>
                    )}
                  </div>
                  {isFaculty && (
                    <div
                      className={`rounded-md border px-2 py-1 text-[10px] ${hasInvalidMarks ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/25 text-muted-foreground"}`}
                    >
                      {hasInvalidMarks
                        ? `Fix invalid marks before saving. Example: ${invalidMarkEntries[0].q} part ${invalidMarkEntries[0].part.toUpperCase()} exceeds max ${invalidMarkEntries[0].expected}.`
                        : "Tip: Empty fields are grey, valid marks are green, and values above max are red."}
                    </div>
                  )}
                  {currentScript?.marksUnavailable ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                      <p>Question-wise marks are not available for this paper yet.</p>
                      {isFaculty ? <p className="mt-1 text-[11px] font-normal text-amber-800">Ask the administrator to update question schema.</p> : null}
                    </div>
                  ) : (
                    <div className="space-y-1.5 rounded-lg border border-border p-1.5 bg-card/30">
                      {marks.map((row, i) => {
                        const partKeys = Object.keys(row.parts).sort();
                        const rowTotal = partKeys.reduce((sum, key) => {
                          const value = row.parts[key] ?? "";
                          return sum + (value === "-" || value === "" ? 0 : parseFloat(value) || 0);
                        }, 0);
                        const rowExpectedTotal = row.expectedTotal ?? partKeys.reduce((sum, key) => sum + (Number(row.expectedParts?.[key]) || 0), 0);
                        const isCounted = countedRowIndexes.has(i);
                        const showSectionHeader = i === 0 || (marks[i - 1]?.sectionIndex ?? i) !== (row.sectionIndex ?? i + 1);
                        const sectionType = (row.sectionType || "COMPULSORY").toUpperCase();
                        const sectionChoose = row.sectionChoose;
                        const sectionTitle =
                          sectionType === "OPTIONAL" && sectionChoose
                            ? `Section ${row.sectionIndex || "-"} - OPTIONAL (Best ${sectionChoose} counted)`
                            : `Section ${row.sectionIndex || "-"} - ${sectionType}`;

                        return (
                          <Fragment key={`${row.q}-${i}`}>
                            {showSectionHeader && <div className="px-1 pt-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{sectionTitle}</div>}

                            <div
                              onClick={() => setSelectedQuestionIndex(i)}
                              className={`rounded-md border px-1.5 py-1 transition-colors ${selectedQuestionIndex === i ? "border-primary/60 bg-primary/5" : "border-border bg-background"}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-mono font-semibold text-foreground text-xs w-8 shrink-0">{row.q}</div>

                                <div className="flex-1 overflow-x-auto">
                                  <div className="flex items-center gap-1 min-w-max">
                                    {partKeys.map((col) => (
                                      <div key={col} className="flex items-center gap-1 rounded border border-border bg-card px-1 py-0.5">
                                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">{col}</span>
                                        {isFaculty ? (
                                          (() => {
                                            const expected = Number(row.expectedParts?.[col] ?? 0);
                                            const raw = row.parts[col] ?? "";
                                            const awarded = parseMarkValue(raw);
                                            const isEmpty = raw.trim() === "";
                                            const isInvalid = !isEmpty && awarded > expected;
                                            const tintClass = isInvalid
                                              ? "bg-destructive/20 border-destructive/70 text-destructive"
                                              : isEmpty
                                                ? "bg-muted/40 border-border text-muted-foreground"
                                                : "bg-success/20 border-success/60 text-foreground";

                                            return (
                                              <input
                                                type="text"
                                                value={row.parts[col] ?? ""}
                                                onChange={(e) => handleMarkChange(i, col, e.target.value)}
                                                onFocus={() => setSelectedQuestionIndex(i)}
                                                onBlur={(e) => handleMarkChange(i, col, e.target.value)}
                                                title={isInvalid ? `Max allowed for ${row.q} ${col.toUpperCase()} is ${expected}` : `Max ${expected}`}
                                                className={`w-9 text-center font-mono text-[11px] border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 ${tintClass}`}
                                              />
                                            );
                                          })()
                                        ) : (
                                          <span className={`w-9 text-center font-mono text-[11px] ${row.parts[col] === "-" ? "text-muted-foreground/50" : "text-foreground"}`}>
                                            {row.parts[col] || "0"}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground">/{row.expectedParts?.[col] ?? 0}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="text-xs font-mono font-semibold text-primary text-right shrink-0">
                                  {`${rowTotal}/${rowExpectedTotal}`}
                                  {!isCounted && sectionType === "OPTIONAL" ? <span className="ml-1 text-[10px] text-warning">(excluded)</span> : null}
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}

                      <div className="border-t border-border pt-1.5">
                        <div className="flex items-center justify-between rounded-md bg-card px-2 py-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Grand Total{hasOptionalRule ? " (Section Rules Applied)" : ""}</span>
                          <span className="font-mono text-sm font-bold text-primary">{totalMarks}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mx-3 border-t border-border" />

                {/* Recheck / Grievance Section */}
                <div className="px-3 py-2 flex-1 flex flex-col">
                  {role === "student" ? (
                    /* Student: accordion recheck */
                    <div className="space-y-1">
                      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Previous Requests</h3>
                          <span className="text-[10px] text-muted-foreground">{grievanceHistory.length}</span>
                        </div>
                        {loadingGrievanceHistory ? (
                          <p className="text-xs text-muted-foreground">Loading grievance history...</p>
                        ) : grievanceHistory.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No grievances submitted for this subject yet.</p>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {grievanceHistory.map((item) => (
                              <div key={item.id} className="rounded-md border border-border bg-background px-2.5 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-mono text-muted-foreground">Ref #{item.id}</span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      item.status === "OPEN" ? "bg-warning/15 text-warning" : item.status === "RESOLVED" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-foreground line-clamp-2">{item.student_comment || "No comment provided."}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Accordion header */}
                      <button
                        onClick={() => setRecheckOpen((o) => !o)}
                        className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span className="uppercase tracking-wider">Recheck Request</span>
                        <svg
                          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${recheckOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
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
                                  missingType === "pages" ? "bg-warning/15 border-warning/40 text-warning" : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                              >
                                Pages Missing
                              </button>
                              <button
                                onClick={() => setMissingType(missingType === "complete" ? null : "complete")}
                                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium border transition-colors ${
                                  missingType === "complete" ? "bg-destructive/15 border-destructive/40 text-destructive" : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                              >
                                Full Sheet Missing
                              </button>
                            </div>

                            {/* Conditional: page numbers input */}
                            {missingType === "pages" && (
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Missing Page Numbers</label>
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
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Comments</label>
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
                        <button onClick={handleAcceptGrievance} className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-foreground hover:bg-success/90 transition-colors">
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
                      <p className="text-xs text-muted-foreground text-center">{isFresh ? "Evaluate the answer sheet and save marks above." : "No grievance filed for this answer sheet."}</p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
};

export default EvaluationViewer;
