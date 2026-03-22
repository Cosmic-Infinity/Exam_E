import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Eraser, Moon, Pencil, RefreshCw, RotateCcw, RotateCw, Sun, Trash2 } from "lucide-react";
import { useUserSession } from "@/app/context/UserSessionContext";
import { useTheme } from "@/app/context/ThemeContext";
import AuthService from "@/app/services/authService";
import { getScript, saveMarks, submitGrievance, acceptGrievance, rejectGrievance, getStudentGrievancesBySubject, downloadFile } from "@/app/services/evaluationService";
import { SUBJECT_MAP, createEmptyMarks, computeTotal, getCountedRowIndexes, type MarksRow } from "@/app/types/evaluation";
import { resolveAssetUrl } from "@/app/utils/assetResolver";

const sanitizeMarkInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const head = cleaned.slice(0, firstDot + 1);
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${head}${tail}`;
};

const parseMarkValue = (value: string): number => {
  if (value === "" || value === "-") return 0;
  return Number.parseFloat(value) || 0;
};

const MOBILE_PREVIEW_DOC_CACHE = "mobile-preview-docs-v1";

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21h10"/><path d="M5.586 16.586a2 2 0 0 0 0 2.828l1 1a2 2 0 0 0 2.828 0L20 9.828a2 2 0 0 0 0-2.828l-1-1a2 2 0 0 0-2.828 0z"/><path d="m13.414 6.414 4.172 4.172"/></svg>'
) }") 4 20, crosshair`;

type MobileGrievanceType = "GENERAL" | "PAGE_MISSING" | "FULL_SHEET_MISSING";

const isPdfPath = (path?: string): boolean => {
  if (!path) return false;
  return /\.pdf(?:$|[?#])/i.test(path);
};

const buildGrievanceComment = (
  type: MobileGrievanceType,
  comment: string,
  missingPages: string,
): string => {
  const trimmed = comment.trim();

  if (type === "PAGE_MISSING") {
    return `[Pages Missing: ${missingPages}] ${trimmed}`.trim();
  }

  if (type === "FULL_SHEET_MISSING") {
    const suffix = trimmed || "Please re-upload the complete answer sheet.";
    return `[Complete Answer Sheet Missing] ${suffix}`.trim();
  }

  return trimmed;
};

const grievanceLabelFromComment = (comment?: string): string => {
  const lowered = (comment || "").trim().toLowerCase();
  if (lowered.startsWith("[pages missing:")) return "Page Missing";
  if (lowered.startsWith("[complete answer sheet missing]")) return "Full Sheet Missing";
  return "General";
};

const toDataUrl = async (src: string): Promise<string | undefined> => {
  try {
    const response = await fetch(src, { credentials: "include" });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

const EvaluationViewerMobile = () => {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") === "faculty" ? "faculty" : "student";
  const mode = searchParams.get("mode") || "graded";
  const grievanceId = Number(searchParams.get("grievanceId") || "");
  const navigate = useNavigate();
  const { user } = useUserSession();
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pages, setPages] = useState<string[]>([]);
  const [questionPaperPath, setQuestionPaperPath] = useState<string | undefined>(undefined);
  const [answerKeyPath, setAnswerKeyPath] = useState<string | undefined>(undefined);
  const [marks, setMarks] = useState<MarksRow[]>(createEmptyMarks());
  const [grievanceType, setGrievanceType] = useState<MobileGrievanceType>("GENERAL");
  const [grievanceText, setGrievanceText] = useState("");
  const [missingPages, setMissingPages] = useState("");
  const [grievanceHistory, setGrievanceHistory] = useState<any[]>([]);
  const [savingMarks, setSavingMarks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeDocView, setActiveDocView] = useState<"sheet" | "question-paper" | "answer-key">("sheet");
  const [marksExpanded, setMarksExpanded] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [drawMode, setDrawMode] = useState<"pencil" | "eraser" | null>(null);
  const [rotateBadgeActive, setRotateBadgeActive] = useState(false);
  const [rotateCycleCompleted, setRotateCycleCompleted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [cachedDocUrls, setCachedDocUrls] = useState<Record<"question-paper" | "answer-key", string | undefined>>({
    "question-paper": undefined,
    "answer-key": undefined,
  });
  const [docLoadState, setDocLoadState] = useState<Record<"question-paper" | "answer-key", "idle" | "loading" | "ready" | "error">>({
    "question-paper": "idle",
    "answer-key": "idle",
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const answerCanvasWrapRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingByPageRef = useRef<Record<number, string>>({});

  if (!user) {
    navigate("/");
    return null;
  }

  const rollNo = role === "faculty" && searchParams.get("roll") ? searchParams.get("roll")! : user.universityId;
  const subjectCode = subjectId?.toUpperCase() || "N/A";
  const subjectName = SUBJECT_MAP[subjectId?.toLowerCase() || ""] || "Unknown Subject";
  const [headerSubjectCode, setHeaderSubjectCode] = useState(subjectCode);
  const [headerSubjectName, setHeaderSubjectName] = useState(subjectName);
  const isFaculty = role === "faculty";

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const script = await getScript(rollNo, subjectId || "", role);
        if (!active) return;

        if (!script) {
          setNotFound(true);
          return;
        }

        setMarks(script.marks || createEmptyMarks());
        setPages(script.pages || []);
        setQuestionPaperPath(script.question_paper_path || undefined);
        setAnswerKeyPath(script.answer_key_path || undefined);

        // Use subject info from script (fetched from backend API in getScript)
        setHeaderSubjectCode(script.subjectCode?.toUpperCase() || subjectCode);
        setHeaderSubjectName(script.subjectName || subjectCode);

        if (!isFaculty) {
          const list = await getStudentGrievancesBySubject(subjectId || "");
          if (active) setGrievanceHistory(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        console.error("Failed to load script:", error);
        toast.error("Unable to load answer sheet");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [rollNo, subjectId, role, isFaculty]);

  useEffect(() => {
    setHeaderSubjectCode(subjectCode);
    setHeaderSubjectName(subjectName);
  }, [subjectCode, subjectName]);

  const totalPages = pages.length || 1;

  const countedRowIndexes = useMemo(() => getCountedRowIndexes(marks), [marks]);
  const totalMarks = useMemo(() => computeTotal(marks), [marks]);
  const hasOptionalRule = useMemo(
    () => marks.some((row) => (row.sectionType || "").toUpperCase() === "OPTIONAL" && Number(row.sectionChoose || 0) > 0),
    [marks],
  );

  const handleMarkChange = (rowIndex: number, partKey: string, nextValue: string) => {
    const cleaned = sanitizeMarkInput(nextValue);
    setMarks((prev) => prev.map((row, idx) => (idx !== rowIndex ? row : { ...row, parts: { ...row.parts, [partKey]: cleaned } })));
  };

  const handleSaveMarks = async () => {
    setSavingMarks(true);
    try {
      await saveMarks(rollNo, subjectId || "", marks, "faculty");
      toast.success("Marks saved");
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save marks");
    } finally {
      setSavingMarks(false);
    }
  };

  const handleSubmitGrievance = async () => {
    if (grievanceType === "GENERAL" && !grievanceText.trim()) {
      toast.error("Please enter grievance details.");
      return;
    }

    if (grievanceType === "PAGE_MISSING" && !missingPages.trim()) {
      toast.error("Please provide missing page numbers.");
      return;
    }

    const payloadComment = buildGrievanceComment(grievanceType, grievanceText, missingPages.trim());

    setSubmitting(true);
    try {
      await submitGrievance(rollNo, subjectId || "", payloadComment);
      toast.success("Grievance submitted");
      setGrievanceType("GENERAL");
      setGrievanceText("");
      setMissingPages("");
      const list = await getStudentGrievancesBySubject(subjectId || "");
      setGrievanceHistory(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to submit grievance:", error);
      toast.error("Failed to submit grievance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptGrievance = async () => {
    try {
      await acceptGrievance(rollNo, subjectId || "", marks, grievanceId || undefined);
      toast.success("Grievance accepted and marks updated");
      navigate("/dashboard/faculty/grievances");
    } catch (error) {
      console.error("Accept grievance failed:", error);
      toast.error("Failed to accept grievance");
    }
  };

  const handleRejectGrievance = async () => {
    try {
      await rejectGrievance(rollNo, subjectId || "", grievanceId || undefined);
      toast.success("Grievance rejected");
      navigate("/dashboard/faculty/grievances");
    } catch (error) {
      console.error("Reject grievance failed:", error);
      toast.error("Failed to reject grievance");
    }
  };

  const getPointerPosition = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const point = "touches" in event ? event.touches[0] : event;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    return { x, y };
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawMode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = drawMode === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = drawMode === "eraser" ? "rgba(0,0,0,1)" : "rgba(255, 0, 0, 0.95)";
    ctx.lineWidth = drawMode === "eraser" ? 16 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const hasVisibleDrawing = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  };

  const saveActivePageDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || activeDocView !== "sheet") return;

    if (!hasVisibleDrawing(canvas)) {
      delete drawingByPageRef.current[activePage];
      return;
    }

    drawingByPageRef.current[activePage] = canvas.toDataURL("image/png");
  };

  const restorePageDrawing = (pageNo: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const saved = drawingByPageRef.current[pageNo];
    if (!saved) return;

    const image = new Image();
    image.onload = () => {
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;
      const liveCtx = liveCanvas.getContext("2d");
      if (!liveCtx) return;
      liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      liveCtx.drawImage(image, 0, 0, liveCanvas.width, liveCanvas.height);
    };
    image.src = saved;
  };

  const syncCanvasSize = () => {
    const wrap = answerCanvasWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.floor(rect.width));
    const nextHeight = Math.max(1, Math.floor(rect.height));

    if (canvas.width === nextWidth && canvas.height === nextHeight) {
      return;
    }

    const snapshot = activeDocView === "sheet" && hasVisibleDrawing(canvas) ? canvas.toDataURL("image/png") : undefined;
    canvas.width = nextWidth;
    canvas.height = nextHeight;

    if (activeDocView !== "sheet") return;

    const saved = drawingByPageRef.current[activePage] || snapshot;
    if (!saved) return;

    const image = new Image();
    image.onload = () => {
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;
      const liveCtx = liveCanvas.getContext("2d");
      if (!liveCtx) return;
      liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      liveCtx.drawImage(image, 0, 0, liveCanvas.width, liveCanvas.height);
    };
    image.src = saved;
  };

  const goToPage = (pageNo: number) => {
    const bounded = Math.max(1, Math.min(totalPages, pageNo));
    if (bounded === activePage) return;
    saveActivePageDrawing();
    setActivePage(bounded);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    const point = getPointerPosition(event);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !isDrawingRef.current) return;
    const point = getPointerPosition(event);
    if (!point || !lastPointRef.current) return;
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    saveActivePageDrawing();
  };

  const handleCanvasTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const handleCanvasTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawMode || !isDrawingRef.current) return;
    if (event.touches.length !== 1) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      return;
    }
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point || !lastPointRef.current) return;
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const handleCanvasTouchEnd = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    saveActivePageDrawing();
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    delete drawingByPageRef.current[activePage];
  };

  const handleResetActiveTool = () => {
    setDrawMode(null);
    setRotation(0);
    setRotateBadgeActive(false);
    setRotateCycleCompleted(false);
    setToolsOpen(false);
  };

  const handleRotateFromTools = (direction: "left" | "right") => {
    setRotateBadgeActive(true);
    setRotateCycleCompleted(false);
    setRotation((prev) => {
      if (direction === "left") {
        return (prev - 90 + 360) % 360;
      }
      return (prev + 90) % 360;
    });
  };

  const handleRotateBadgeTap = () => {
    if (!rotateBadgeActive) return;

    if (rotateCycleCompleted) {
      setRotateBadgeActive(false);
      setRotateCycleCompleted(false);
      return;
    }

    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    if (nextRotation === 0) {
      setRotateCycleCompleted(true);
    }
  };

  const handleDownloadFullSheetPdf = async (withMarks: boolean) => {
    if (!pages.length) {
      toast.error("Answer sheet is not available");
      return;
    }

    setIsDownloading(true);
    const toastId = toast.loading(withMarks ? "Preparing full sheet + marks PDF..." : "Preparing full sheet PDF...");

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();

        const pagePath = resolveAssetUrl(pages[i]);
        const dataUrl = pagePath ? await toDataUrl(pagePath) : undefined;

        if (dataUrl) {
          pdf.addImage(dataUrl, "JPEG", 10, 10, 190, 250);
        } else {
          pdf.setFontSize(11);
          pdf.text(`Page ${i + 1} could not be embedded`, 14, 20);
        }
      }

      if (withMarks) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text(`Marks Summary - ${subjectCode}`, 14, 14);
        pdf.setFontSize(11);
        pdf.text(`Total: ${totalMarks}`, 14, 22);

        const rows = marks.map((row) => {
          const keys = Object.keys(row.parts || {}).sort();
          const awarded = keys.reduce((sum, key) => sum + parseMarkValue(row.parts[key] || ""), 0);
          const outOf = row.expectedTotal ?? keys.reduce((sum, key) => sum + Number(row.expectedParts?.[key] ?? 0), 0);
          return [row.q, `${awarded}/${outOf}`];
        });

        autoTable(pdf, {
          startY: 28,
          head: [["Question", "Marks"]],
          body: rows,
          theme: "striped",
          styles: { fontSize: 10 },
        });
      }

      const suffix = withMarks ? "Full_Sheet_With_Marks" : "Full_Sheet";
      pdf.save(`${subjectCode}_${suffix}.pdf`);
      toast.success("Download ready", { id: toastId });
    } catch (error) {
      console.error("Failed to generate sheet PDF:", error);
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSheetPage = () => {
    if (!activePageSrc) {
      toast.error("Answer sheet page is not available");
      return;
    }

    const filePath = resolveAssetUrl(activePageSrc) || activePageSrc;
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const ext = extMatch?.[1] || "jpg";
    downloadFile(filePath, `${subjectCode}_Sheet_Page_${activePage}.${ext}`);
    toast.success(`Downloaded page ${activePage}`);
  };

  const handleDownloadDoc = (type: "question-paper" | "answer-key") => {
    const rawPath = type === "question-paper" ? questionPaperPath : answerKeyPath;
    if (!rawPath) {
      toast.error(type === "question-paper" ? "Question paper is not available" : "Answer key is not available");
      return;
    }

    const filePath = resolveAssetUrl(rawPath) || rawPath;
    const suffix = type === "question-paper" ? "Question_Paper" : "Answer_Key";
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const ext = extMatch?.[1] || "pdf";
    downloadFile(filePath, `${subjectCode}_${suffix}.${ext}`);
    toast.success(type === "question-paper" ? "Question paper download started" : "Answer key download started");
  };

  const activePageSrc = pages[activePage - 1];
  const imageSrc = activePageSrc ? resolveAssetUrl(activePageSrc) || activePageSrc : "";
  const questionPaperUrl = resolveAssetUrl(questionPaperPath);
  const answerKeyUrl = resolveAssetUrl(answerKeyPath);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    const loadCachedDoc = async (type: "question-paper" | "answer-key", src?: string) => {
      if (!src) return;
      if (!isPdfPath(src)) {
        if (active) {
          setCachedDocUrls((prev) => ({ ...prev, [type]: src }));
          setDocLoadState((prev) => ({ ...prev, [type]: "ready" }));
        }
        return;
      }

      if (active) {
        setDocLoadState((prev) => ({ ...prev, [type]: "loading" }));
      }

      try {
        if (!("caches" in window)) {
          const fetched = await fetch(src, { credentials: "include" });
          if (!fetched.ok) {
            if (active) setDocLoadState((prev) => ({ ...prev, [type]: "error" }));
            return;
          }
          const blob = await fetched.blob();
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          if (active) {
            setCachedDocUrls((prev) => ({ ...prev, [type]: objectUrl }));
            setDocLoadState((prev) => ({ ...prev, [type]: "ready" }));
          }
          return;
        }

        const request = new Request(src, { method: "GET", credentials: "include" });
        const cache = await caches.open(MOBILE_PREVIEW_DOC_CACHE);
        let response = await cache.match(request);

        if (!response) {
          const fetched = await fetch(src, { credentials: "include" });
          if (!fetched.ok) return;
          await cache.put(request, fetched.clone());
          response = fetched;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        if (!active) return;
        setCachedDocUrls((prev) => ({ ...prev, [type]: objectUrl }));
        setDocLoadState((prev) => ({ ...prev, [type]: "ready" }));
      } catch {
        if (active) {
          // Do not fallback to direct URL embed on Firefox mobile; it can be blocked in iframes.
          setCachedDocUrls((prev) => ({ ...prev, [type]: undefined }));
          setDocLoadState((prev) => ({ ...prev, [type]: "error" }));
        }
      }
    };

    setCachedDocUrls({ "question-paper": undefined, "answer-key": undefined });
    setDocLoadState({ "question-paper": "idle", "answer-key": "idle" });
    void loadCachedDoc("question-paper", questionPaperUrl);
    void loadCachedDoc("answer-key", answerKeyUrl);

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [questionPaperUrl, answerKeyUrl]);

  useEffect(() => {
    if (activeDocView !== "sheet") return;
    restorePageDrawing(activePage);
  }, [activePage, activeDocView]);

  const activeToolIndicator = useMemo(() => {
    if (drawMode === "pencil") {
      return { label: "Pencil", icon: <Pencil className="h-3.5 w-3.5" /> };
    }
    if (drawMode === "eraser") {
      return { label: "Eraser", icon: <Eraser className="h-3.5 w-3.5" /> };
    }
    if (rotateBadgeActive) {
      return { label: rotateCycleCompleted ? "Hide" : `${rotation}°`, icon: <RefreshCw className="h-3.5 w-3.5" />, type: "rotate" as const };
    }
    if (rotation !== 0) {
      return { label: `${rotation}°`, icon: <RefreshCw className="h-3.5 w-3.5" />, type: "rotate" as const };
    }
    return null;
  }, [drawMode, rotation, rotateBadgeActive, rotateCycleCompleted]);

  const sectionGroups = useMemo(() => {
    const map = new Map<number, { sectionIndex: number; sectionType: string; sectionChoose: number | null; rows: Array<{ row: MarksRow; idx: number }> }>();

    marks.forEach((row, idx) => {
      const sectionIndex = row.sectionIndex ?? 1;
      if (!map.has(sectionIndex)) {
        map.set(sectionIndex, {
          sectionIndex,
          sectionType: (row.sectionType || "COMPULSORY").toUpperCase(),
          sectionChoose: row.sectionChoose ?? null,
          rows: [],
        });
      }
      map.get(sectionIndex)!.rows.push({ row, idx });
    });

    return Array.from(map.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
  }, [marks]);

  useEffect(() => {
    const wrap = answerCanvasWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    syncCanvasSize();
    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [activeDocView, activePage]);

  useEffect(() => {
    drawingByPageRef.current = {};
  }, [rollNo, subjectId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => navigate(isFaculty ? "/dashboard/faculty" : "/dashboard/student")} className="rounded-md border border-border px-2 py-1 text-[11px]">
            Back
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold">{headerSubjectCode}</p>
            <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{headerSubjectName}</p>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 pb-24 overflow-y-auto">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading answer sheet...</p>}

        {!loading && notFound && (
          <section className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-sm">No answer sheet found for this subject.</p>
          </section>
        )}

        {!loading && !notFound && (
          <>
            <section className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Roll: <span className="font-mono text-primary">{rollNo}</span></p>
                <span className={`rounded-md px-2 py-1 text-[10px] uppercase ${mode === "grievance" ? "bg-destructive/15 text-destructive" : mode === "fresh" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                  {mode}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <button
                    onClick={() => setActiveDocView("sheet")}
                    className={`rounded-md px-2 py-2 text-xs font-semibold ${activeDocView === "sheet" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    Sheet
                  </button>
                  <button
                    onClick={() => setActiveDocView("question-paper")}
                    className={`rounded-md px-2 py-2 text-xs font-semibold ${activeDocView === "question-paper" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    QP
                  </button>
                  <button
                    onClick={() => setActiveDocView("answer-key")}
                    className={`rounded-md px-2 py-2 text-xs font-semibold ${activeDocView === "answer-key" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    AK
                  </button>
                </div>

                {isFaculty && activeDocView === "sheet" && (
                  <div className="relative">
                    {activeToolIndicator && (
                      <button
                        onClick={activeToolIndicator.type === "rotate" ? handleRotateBadgeTap : handleResetActiveTool}
                        title={activeToolIndicator.type === "rotate" ? "Tap to rotate; after full cycle tap again to hide" : "Tap to reset active tool"}
                        className="absolute -top-9 right-0 h-8 min-w-8 px-2 rounded-md border border-primary/40 bg-primary/15 text-primary flex items-center justify-center gap-1"
                      >
                        {activeToolIndicator.icon}
                        <span className="text-[10px] font-semibold">{activeToolIndicator.label}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setToolsOpen((prev) => !prev);
                        setDownloadsOpen(false);
                      }}
                      className="rounded-md border border-border bg-background px-2 py-2 text-xs font-semibold min-w-16"
                    >
                      Tools
                    </button>
                    {toolsOpen && (
                      <div className="absolute right-0 mt-1 w-36 rounded-md border border-border bg-card shadow-lg z-30 overflow-hidden">
                        <button
                          onClick={() => {
                            handleRotateFromTools("left");
                            setToolsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Rotate Left
                        </button>
                        <button
                          onClick={() => {
                            handleRotateFromTools("right");
                            setToolsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          Rotate Right
                        </button>
                        <button
                          onClick={() => {
                            setRotateBadgeActive(false);
                            setRotateCycleCompleted(false);
                            setDrawMode((prev) => (prev === "pencil" ? null : "pencil"));
                            setToolsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {drawMode === "pencil" ? "Pencil On" : "Pencil"}
                        </button>
                        <button
                          onClick={() => {
                            setRotateBadgeActive(false);
                            setRotateCycleCompleted(false);
                            setDrawMode((prev) => (prev === "eraser" ? null : "eraser"));
                            setToolsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          {drawMode === "eraser" ? "Eraser On" : "Eraser"}
                        </button>
                        <button
                          onClick={() => {
                            handleClearCanvas();
                            setToolsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear Draw
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={() => {
                      setDownloadsOpen((prev) => !prev);
                      setToolsOpen(false);
                    }}
                    className="rounded-md border border-border bg-background px-2 py-2 text-xs font-semibold min-w-20"
                  >
                    <Download className="h-3.5 w-3.5 mx-auto" aria-hidden="true" />
                  </button>
                  {downloadsOpen && (
                    <div className="absolute right-0 mt-1 w-44 rounded-md border border-border bg-card shadow-lg z-30 overflow-hidden">
                      <button
                        onClick={() => {
                          handleDownloadSheetPage();
                          setDownloadsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40"
                      >
                        Sheet (This Page)
                      </button>
                      <button
                        onClick={() => {
                          handleDownloadDoc("question-paper");
                          setDownloadsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40"
                      >
                        Question Paper
                      </button>
                      <button
                        onClick={() => {
                          handleDownloadDoc("answer-key");
                          setDownloadsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40"
                      >
                        Answer Key
                      </button>
                      {isFaculty && (
                        <button
                          onClick={() => {
                            handleDownloadFullSheetPdf(false);
                            setDownloadsOpen(false);
                          }}
                          disabled={isDownloading}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 disabled:opacity-50"
                        >
                          Sheet (Full PDF)
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleDownloadFullSheetPdf(true);
                          setDownloadsOpen(false);
                        }}
                        disabled={isDownloading}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 disabled:opacity-50"
                      >
                        Sheet + Marks PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
                <>
                  <div className={activeDocView === "sheet" ? "block" : "hidden"}>
                    <div className="bg-black/5 flex overflow-hidden">
                      <div className="w-10 border-r border-border/70 bg-card/70 p-1 flex flex-col">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-wider text-center py-0.5">Pg</p>
                        <div className="flex-1 overflow-y-auto space-y-1 px-0.5 pb-0.5">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNo) => (
                            <button
                              key={pageNo}
                              onClick={() => goToPage(pageNo)}
                              className={`w-full h-7 rounded-md text-[10px] font-semibold leading-none transition-colors ${
                                pageNo === activePage ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-secondary-foreground border border-border"
                              }`}
                            >
                              {pageNo}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 flex items-start justify-center p-1.5 overflow-auto">
                        <div ref={answerCanvasWrapRef} className="relative inline-block">
                          <div style={{ transform: `rotate(${rotation}deg)` }}>
                            {imageSrc ? (
                              <img
                                src={imageSrc}
                                alt={`Page ${activePage}`}
                                className="max-h-[56vh] w-auto max-w-full object-contain no-text-recognition-image"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                onLoad={syncCanvasSize}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">Page preview unavailable</p>
                            )}
                          </div>
                          <canvas
                            ref={canvasRef}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                            onTouchStart={handleCanvasTouchStart}
                            onTouchMove={handleCanvasTouchMove}
                            onTouchEnd={handleCanvasTouchEnd}
                            className="absolute inset-0"
                            style={{
                              pointerEvents: drawMode ? "auto" : "none",
                              touchAction: "none",
                              cursor: drawMode === "eraser" ? ERASER_CURSOR : drawMode ? "crosshair" : "default",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                      <button onClick={() => goToPage(activePage - 1)} disabled={activePage === 1} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40">
                        Prev
                      </button>
                      <span className="text-xs font-mono">Page {activePage}/{totalPages}</span>
                      <button onClick={() => goToPage(activePage + 1)} disabled={activePage === totalPages} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40">
                        Next
                      </button>
                    </div>
                  </div>

                  <div className={`h-[58vh] min-h-[360px] ${activeDocView === "sheet" ? "hidden" : "flex"} flex-col`}>
                    <div className="flex items-center justify-end border-b border-border px-2 py-1">
                      {activeDocView === "question-paper" && (cachedDocUrls["question-paper"] || questionPaperUrl) ? (
                        <a href={cachedDocUrls["question-paper"] || questionPaperUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                          Open Full View
                        </a>
                      ) : activeDocView === "answer-key" && (cachedDocUrls["answer-key"] || answerKeyUrl) ? (
                        <a href={cachedDocUrls["answer-key"] || answerKeyUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                          Open Full View
                        </a>
                      ) : null}
                    </div>

                    <div className="relative flex-1 min-h-0 bg-background">
                      {cachedDocUrls["question-paper"] && (
                        <div className={`absolute inset-0 ${activeDocView === "question-paper" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                          {isPdfPath(cachedDocUrls["question-paper"]) ? (
                            <object data={cachedDocUrls["question-paper"]} type="application/pdf" className="w-full h-full">
                              <iframe src={cachedDocUrls["question-paper"]} title="Question Paper" className="w-full h-full border-0 bg-background" />
                            </object>
                          ) : (
                            <iframe src={cachedDocUrls["question-paper"]} title="Question Paper" className="w-full h-full border-0 bg-background" />
                          )}
                        </div>
                      )}

                      {cachedDocUrls["answer-key"] && (
                        <div className={`absolute inset-0 ${activeDocView === "answer-key" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                          {isPdfPath(cachedDocUrls["answer-key"]) ? (
                            <object data={cachedDocUrls["answer-key"]} type="application/pdf" className="w-full h-full">
                              <iframe src={cachedDocUrls["answer-key"]} title="Answer Key" className="w-full h-full border-0 bg-background" />
                            </object>
                          ) : (
                            <iframe src={cachedDocUrls["answer-key"]} title="Answer Key" className="w-full h-full border-0 bg-background" />
                          )}
                        </div>
                      )}

                      {activeDocView === "question-paper" && docLoadState["question-paper"] === "loading" ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading question paper preview...</div>
                      ) : null}
                      {activeDocView === "answer-key" && docLoadState["answer-key"] === "loading" ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading answer key preview...</div>
                      ) : null}

                      {activeDocView === "question-paper" && docLoadState["question-paper"] === "error" ? (
                        <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2 px-4 text-center">
                          <span>Embedded preview is blocked on this browser.</span>
                          <span>Use Open Full View above.</span>
                        </div>
                      ) : null}
                      {activeDocView === "answer-key" && docLoadState["answer-key"] === "error" ? (
                        <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2 px-4 text-center">
                          <span>Embedded preview is blocked on this browser.</span>
                          <span>Use Open Full View above.</span>
                        </div>
                      ) : null}

                      {activeDocView === "question-paper" && docLoadState["question-paper"] === "idle" && !questionPaperUrl ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Question paper not available</div>
                      ) : null}
                      {activeDocView === "answer-key" && docLoadState["answer-key"] === "idle" && !answerKeyUrl ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Answer key not available</div>
                      ) : null}
                    </div>
                  </div>
                </>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marks</h3>
                <span className="text-xs font-mono text-primary">Total: {totalMarks}{hasOptionalRule ? " (rules applied)" : ""}</span>
              </div>

              <button
                onClick={() => setMarksExpanded((prev) => !prev)}
                className="w-full rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-left flex items-center justify-between"
              >
                <span>{marksExpanded ? "Hide Question-wise Marks" : "Show Question-wise Marks"}</span>
                <span className="text-muted-foreground">{marksExpanded ? "▲" : "▼"}</span>
              </button>

              {marksExpanded && (
                <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
                  {sectionGroups.map((section) => (
                    <div key={`section-${section.sectionIndex}`} className="rounded-md border border-border bg-card/40 p-1.5 space-y-1.5">
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[11px] font-semibold text-primary">Section-{section.sectionIndex}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {section.sectionType}
                          {section.sectionType === "OPTIONAL" && section.sectionChoose ? ` (choose ${section.sectionChoose})` : ""}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {section.rows.map(({ row, idx }) => {
                          const partKeys = Object.keys(row.parts || {}).sort();
                          const isCounted = countedRowIndexes.has(idx);
                          const sectionType = (row.sectionType || "").toUpperCase();
                          const rowTotal = partKeys.reduce((sum, key) => sum + parseMarkValue(row.parts[key] || ""), 0);
                          const rowExpectedTotal =
                            row.expectedTotal ?? partKeys.reduce((sum, key) => sum + Number(row.expectedParts?.[key] ?? 0), 0);

                          return (
                            <div key={`${row.q}-${idx}`} className="rounded-md border border-border bg-background px-1.5 py-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] font-semibold">{row.q}</p>
                                  {!isCounted && sectionType === "OPTIONAL" ? <span className="text-[10px] text-warning">excluded</span> : null}
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-primary leading-none">{rowTotal}/{rowExpectedTotal}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-1">
                                {partKeys.map((key) => {
                                  const expected = Number(row.expectedParts?.[key] ?? 0);
                                  const awardedDisplay = row.parts[key] && row.parts[key] !== "-" ? row.parts[key] : "0";
                                  return (
                                    <div key={key} className="rounded-md border border-border bg-card p-1 space-y-0.5">
                                      <div className="text-[9px] text-muted-foreground uppercase leading-none">Part {key}</div>
                                      <div className="flex items-end justify-between gap-1">
                                        {isFaculty ? (
                                          <input
                                            value={row.parts[key] ?? ""}
                                            onChange={(e) => handleMarkChange(idx, key, e.target.value)}
                                            className="w-10 rounded-md border border-border bg-background px-1 py-0.5 text-[11px] text-foreground text-center"
                                          />
                                        ) : (
                                          <span className="text-[11px] font-mono font-semibold text-foreground leading-none">{awardedDisplay}</span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground leading-none">/{expected}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isFaculty && (
                <button onClick={handleSaveMarks} disabled={savingMarks} className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {savingMarks ? "Saving..." : "Save Marks"}
                </button>
              )}
            </section>

            {!isFaculty && (
              <section className="rounded-xl border border-border bg-card p-3 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recheck Request</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setGrievanceType("GENERAL")}
                    className={`rounded-md px-2 py-1.5 text-[11px] ${grievanceType === "GENERAL" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setGrievanceType("PAGE_MISSING")}
                    className={`rounded-md px-2 py-1.5 text-[11px] ${grievanceType === "PAGE_MISSING" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    Page Missing
                  </button>
                  <button
                    onClick={() => setGrievanceType("FULL_SHEET_MISSING")}
                    className={`rounded-md px-2 py-1.5 text-[11px] ${grievanceType === "FULL_SHEET_MISSING" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    Full Sheet
                  </button>
                </div>

                {grievanceType === "PAGE_MISSING" && (
                  <input
                    value={missingPages}
                    onChange={(e) => setMissingPages(e.target.value)}
                    placeholder="Missing pages (e.g. 3, 7, 12)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                )}

                <textarea
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  rows={3}
                  placeholder={grievanceType === "FULL_SHEET_MISSING" ? "Optional note (complete sheet missing)" : "Describe your concern"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button onClick={handleSubmitGrievance} disabled={submitting} className="w-full rounded-lg bg-warning px-3 py-2.5 text-sm font-semibold text-warning-foreground disabled:opacity-50">
                  {submitting ? "Submitting..." : "Submit Grievance"}
                </button>

                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground">Previous Requests</p>
                  {grievanceHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No grievances submitted yet.</p>
                  ) : (
                    grievanceHistory.map((item) => (
                      <div key={item.id} className="rounded-md border border-border bg-background px-2.5 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-muted-foreground">Ref #{item.id}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] rounded bg-secondary px-1.5 py-0.5">{grievanceLabelFromComment(item.student_comment)}</span>
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{item.status}</span>
                          </div>
                        </div>
                        <p className="text-xs mt-1">{item.student_comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {isFaculty && mode === "grievance" && (
              <section className="rounded-xl border border-border bg-card p-3 grid grid-cols-2 gap-2">
                <button onClick={handleAcceptGrievance} className="rounded-lg bg-success px-3 py-2.5 text-xs font-semibold text-success-foreground">
                  Accept
                </button>
                <button onClick={handleRejectGrievance} className="rounded-lg bg-destructive px-3 py-2.5 text-xs font-semibold text-destructive-foreground">
                  Reject
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default EvaluationViewerMobile;
