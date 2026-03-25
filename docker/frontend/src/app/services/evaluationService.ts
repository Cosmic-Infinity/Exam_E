import AuthService from "@/app/services/authService";
import {
  AnswerScript,
  StudentResult,
  MarksRow,
  createEmptyMarks,
  computeTotal,
} from "@/app/types/evaluation";

type TeacherAllocation = {
  allocation_id: number;
  course: { course_code: string; title: string };
  section_name?: string;
};

type TeacherExam = {
  exam_id: number;
  exam_type: string;
};

type TeacherPaperListItem = {
  paper_id: number;
  student_university_id: string;
  student_name: string;
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  has_grievance?: boolean;
};

type TeacherPaperDetail = {
  paper_id: number;
  student_university_id: string;
  student_name: string;
  marks_json: unknown;
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  has_grievance?: boolean;
  grievance_text?: string | null;
  grievance_date?: number | null;
  question_paper_path?: string;
  answer_key_path?: string;
  question_paper_schema?: unknown;
  pages?: string[];
};

type StudentPaperListItem = {
  paper_id: number;
  exam: {
    exam_id: number;
    exam_type: string;
    total_marks: number;
    passing_marks: number;
    course_code: string;
    course_title: string;
  };
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};

type StudentPaperDetail = {
  paper_id: number;
  exam: {
    exam_id: number;
    exam_type: string;
    total_marks: number;
    passing_marks: number;
    course_code: string;
    course_title: string;
  };
  marks_json: unknown;
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  question_paper_schema?: unknown;
  question_paper_path?: string;
  answer_key_path?: string;
  pages?: string[];
};
type StudentEnrollmentItem = {
  enrollment_id: number;
  allocation: {
    allocation_id: number;
    course: {
      course_code: string;
      title: string;
    };
  };
  enrollment_type: string;
  status: string;
};

export type StudentGrievanceItem = {
  id: number;
  paper: number;
  student_comment: string;
  status: "OPEN" | "RESOLVED" | "REJECTED";
};

export type FacultyGrievanceFilter = "all" | "my_section" | "other_section";

export type FacultyGrievanceItem = {
  id: number;
  paper_id: number;
  status: "OPEN" | "RESOLVED" | "REJECTED";
  student_comment: string;
  student_university_id: string;
  student_name: string;
  subject_code: string;
  subject_title: string;
  section_name: string;
  original_faculty_id: number | null;
  original_faculty_name: string | null;
  assigned_faculty_id: number | null;
  assigned_faculty_name: string | null;
  grievance_type: "PAGE_MISSING" | "FULL_SHEET_MISSING" | "GENERAL";
  grievance_type_label: string;
  assignment_status: "ASSIGNED_TO_YOU" | "ASSIGNED_TO_ANOTHER_FACULTY" | "UNASSIGNED_AT_PRESENT";
  can_resolve: boolean;
};

export type FacultyGrievanceStats = {
  assigned_open_count: number;
  to_resolve_count: number;
  resolved_count: number;
  rejected_count: number;
  visible_open_count: number;
  total_visible_count: number;
  by_section: Array<{
    section_name: string;
    total: number;
    open: number;
    resolved: number;
    rejected: number;
  }>;
};

type TeacherPaperMarkingDetailResponse = {
  paper_id: number;
  page_index: number;
  markings: unknown | null;
  updated_by: number | null;
  updated_at: string | null;
};

type PaperMeta = {
  id: string;
  rollNo: string;
  subjectCode: string;
  subjectName: string;
  examId?: number;
};

const paperMetaCache = new Map<string, PaperMeta>();

function statusToScriptStatus(status: string): "pending" | "graded" {
  return status === "COMPLETED" ? "graded" : "pending";
}

function normalizeMarks(raw: unknown): MarksRow[] {
  // Case 1: already in frontend array format
  if (Array.isArray(raw)) return raw as MarksRow[];

  // Case 2: ground-truth backend schema format ({ sections: [...] })
  if (raw && typeof raw === "object" && Array.isArray((raw as { sections?: unknown[] }).sections)) {
    const marksObj = raw as {
      sections: Array<{
        questions?: Array<{
          q_no?: number;
          parts?: Array<{
            part_no?: number;
            expected_marks?: number;
            awarded_marks?: number | null;
          }>;
          expected_total?: number;
        }>;
      }>;
    };

    const rows: MarksRow[] = [];
    const labels = "abcdefghijklmnopqrstuvwxyz";

    for (const section of marksObj.sections) {
      const sectionIndex = Number((section as { section_index?: number }).section_index ?? 0) || undefined;
      const sectionType = String((section as { type?: string }).type || "COMPULSORY").toUpperCase();
      const sectionChoose =
        (section as { choose?: number | null }).choose === null || (section as { choose?: number | null }).choose === undefined ? null : Number((section as { choose?: number | null }).choose);

      for (const question of section.questions || []) {
        const qNo = question.q_no ?? rows.length + 1;
        const sortedParts = [...(question.parts || [])].sort((a, b) => (a.part_no || 0) - (b.part_no || 0));
        const parts: Record<string, string> = {};
        const expectedParts: Record<string, number> = {};

        sortedParts.forEach((part, idx) => {
          const col = labels[idx] || `p${idx + 1}`;
          const awarded = part.awarded_marks;
          parts[col] = awarded === null || awarded === undefined ? "" : String(awarded);
          expectedParts[col] = Number(part.expected_marks ?? 0);
        });

        const expectedTotal = Number(question.expected_total ?? sortedParts.reduce((acc, p) => acc + Number(p.expected_marks ?? 0), 0));

        rows.push({
          q: `Q${qNo}`,
          parts,
          expectedParts,
          expectedTotal,
          sectionIndex,
          sectionType,
          sectionChoose,
          questionNo: Number(qNo),
        });
      }
    }

    if (rows.length > 0) {
      return rows;
    }
  }

  return createEmptyMarks();
}

function cacheKey(rollNo: string, subjectCode: string): string {
  return `${rollNo}::${subjectCode.toLowerCase()}`;
}

function normalizeAssetPath(path?: string): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildSectionMarksPayload(raw: unknown, rows: MarksRow[]) {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { sections?: unknown[] }).sections)) {
    return raw;
  }

  const rowMap = new Map<number, MarksRow>();
  for (const row of rows) {
    const qNo = Number(String(row.q).replace(/[^0-9]/g, ""));
    if (!Number.isNaN(qNo) && qNo > 0) {
      rowMap.set(qNo, row);
    }
  }

  const payload = JSON.parse(JSON.stringify(raw)) as {
    sections: Array<{
      questions?: Array<{
        q_no?: number;
        parts?: Array<{
          part_no?: number;
          expected_marks?: number;
          awarded_marks?: number | null;
        }>;
        awarded_total?: number | null;
      }>;
    }>;
  };

  for (const section of payload.sections) {
    for (const question of section.questions || []) {
      const qNo = question.q_no;
      if (!qNo || !question.parts) {
        continue;
      }

      const row = rowMap.get(qNo);
      if (!row) {
        continue;
      }

      const sortedParts = [...question.parts].sort((a, b) => (a.part_no || 0) - (b.part_no || 0));
      const rowPartKeys = Object.keys(row.parts).sort();

      let awardedTotal = 0;
      sortedParts.forEach((part, idx) => {
        const rowKey = rowPartKeys[idx];
        const value = rowKey ? row.parts[rowKey] : "";
        const awarded = value === "-" || value === "" ? 0 : Number(value) || 0;
        part.awarded_marks = awarded;
        awardedTotal += awarded;
      });

      question.awarded_total = awardedTotal;
    }
  }

  return payload;
}

async function fetchTeacherScriptsInternal(): Promise<AnswerScript[]> {
  const allocations = (await AuthService.get("/teacher/allocations/")) as TeacherAllocation[];
  const scripts: AnswerScript[] = [];

  for (const allocation of allocations) {
    const exams = (await AuthService.get(`/teacher/exams/${allocation.allocation_id}/`)) as TeacherExam[];

    for (const exam of exams) {
      const papers = (await AuthService.get(`/teacher/papers/?exam_id=${exam.exam_id}`)) as TeacherPaperListItem[];

      for (const paper of papers) {
        const subjectCode = allocation.course.course_code;
        const key = cacheKey(paper.student_university_id, subjectCode);

        paperMetaCache.set(key, {
          id: String(paper.paper_id),
          rollNo: paper.student_university_id,
          subjectCode,
          subjectName: allocation.course.title,
          examId: exam.exam_id,
        });

        scripts.push({
          id: String(paper.paper_id),
          rollNo: paper.student_university_id,
          studentName: paper.student_name,
          section: allocation.section_name,
          subjectCode,
          subjectName: allocation.course.title,
          submissionDate: "",
          status: statusToScriptStatus(paper.evaluation_status),
          hasGrievance: Boolean(paper.has_grievance),
          marks: createEmptyMarks(),
        });
      }
    }
  }

  return scripts;
}

async function fetchStudentPapersInternal(): Promise<StudentPaperListItem[]> {
  return (await AuthService.get("/student/papers/")) as StudentPaperListItem[];
}

async function fetchStudentEnrollmentsInternal(): Promise<StudentEnrollmentItem[]> {
  return (await AuthService.get("/student/enrollments/")) as StudentEnrollmentItem[];
}

async function resolveStudentPaperBySubject(subjectCode: string) {
  const papers = await fetchStudentPapersInternal();
  return papers.find((p) => p.exam.course_code.toLowerCase() === subjectCode.toLowerCase());
}

/** Faculty list */
export async function getAllScripts(): Promise<AnswerScript[]> {
  return fetchTeacherScriptsInternal();
}

/** Lookup by roll + subject for viewer compatibility */
export async function getScript(rollNo: string, subjectCode: string, role: "student" | "faculty" = "student"): Promise<AnswerScript | undefined> {
  // 1) Try cached metadata
  const key = cacheKey(rollNo, subjectCode);
  const cached = paperMetaCache.get(key);
  if (cached && role === "faculty") {
    const detail = (await AuthService.get(`/teacher/paper/${cached.id}/`)) as TeacherPaperDetail;

    return {
      id: String(detail.paper_id),
      rollNo: detail.student_university_id,
      subjectCode: cached.subjectCode,
      subjectName: cached.subjectName || cached.subjectCode,
      submissionDate: "",
      status: statusToScriptStatus(detail.evaluation_status),
      hasGrievance: Boolean(detail.has_grievance),
      grievanceText: detail.grievance_text || undefined,
      grievanceDate: detail.grievance_date ? `Ref #${detail.grievance_date}` : undefined,
      marks: normalizeMarks(detail.marks_json),
      question_paper_path: normalizeAssetPath(detail.question_paper_path),
      answer_key_path: normalizeAssetPath(detail.answer_key_path),
      question_paper_schema: detail.question_paper_schema,
      pages: detail.pages ? detail.pages.map((p) => normalizeAssetPath(p)).filter((p): p is string => Boolean(p)) : undefined,
      marksUnavailable: detail.marks_json === null,
    };
  } // 2) Try teacher discovery only for faculty
  if (role === "faculty") {
    try {
      const teacherScripts = await fetchTeacherScriptsInternal();
      const found = teacherScripts.find((s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase());
      if (found) {
        const detail = (await AuthService.get(`/teacher/paper/${found.id}/`)) as TeacherPaperDetail;

        return {
          id: String(detail.paper_id),
          rollNo: detail.student_university_id,
          subjectCode: subjectCode,
          subjectName: subjectCode,
          submissionDate: "",
          status: statusToScriptStatus(detail.evaluation_status),
          hasGrievance: Boolean(detail.has_grievance),
          grievanceText: detail.grievance_text || undefined,
          grievanceDate: detail.grievance_date ? `Ref #${detail.grievance_date}` : undefined,
          marks: normalizeMarks(detail.marks_json),
          question_paper_path: normalizeAssetPath(detail.question_paper_path),
          answer_key_path: normalizeAssetPath(detail.answer_key_path),
          question_paper_schema: detail.question_paper_schema,
          pages: detail.pages ? detail.pages.map((p) => normalizeAssetPath(p)).filter((p): p is string => Boolean(p)) : undefined,
          marksUnavailable: detail.marks_json === null,
        };
      }

      // Cross-section grievance assignment fallback.
      const grievanceItems = await getFacultyGrievances("all");
      const matchedGrievance = grievanceItems.find((item) => item.student_university_id === rollNo && item.subject_code.toLowerCase() === subjectCode.toLowerCase());

      if (matchedGrievance) {
        const detail = (await AuthService.get(`/teacher/paper/${matchedGrievance.paper_id}/`)) as TeacherPaperDetail;

        return {
          id: String(detail.paper_id),
          rollNo: detail.student_university_id,
          subjectCode: matchedGrievance.subject_code,
          subjectName: matchedGrievance.subject_code,
          submissionDate: "",
          status: statusToScriptStatus(detail.evaluation_status),
          hasGrievance: Boolean(detail.has_grievance),
          grievanceText: detail.grievance_text || undefined,
          grievanceDate: detail.grievance_date ? `Ref #${detail.grievance_date}` : undefined,
          marks: normalizeMarks(detail.marks_json),
          question_paper_path: normalizeAssetPath(detail.question_paper_path),
          answer_key_path: normalizeAssetPath(detail.answer_key_path),
          question_paper_schema: detail.question_paper_schema,
          pages: detail.pages ? detail.pages.map((p) => normalizeAssetPath(p)).filter((p): p is string => Boolean(p)) : undefined,
          marksUnavailable: detail.marks_json === null,
        };
      }
    } catch {
      // ignore and fallback to student path
    }
  }

  // 3) Student fallback (only if not faculty)
  if (role === "faculty") {
    // Faculty should only use teacher API, not student API
    return undefined;
  }

  const p = await resolveStudentPaperBySubject(subjectCode);
  if (!p) return undefined;

  const detail = (await AuthService.get(`/student/paper/${p.paper_id}/`)) as StudentPaperDetail;

  return {
    id: String(detail.paper_id),
    rollNo,
    subjectCode: detail.exam.course_code,
    subjectName: detail.exam.course_title || detail.exam.course_code,
    submissionDate: "",
    status: statusToScriptStatus(detail.evaluation_status),
    hasGrievance: false,
    marks: normalizeMarks(detail.marks_json),
    question_paper_path: normalizeAssetPath(detail.question_paper_path),
    answer_key_path: normalizeAssetPath(detail.answer_key_path),
    question_paper_schema: detail.question_paper_schema,
    pages: detail.pages ? detail.pages.map((p: string) => normalizeAssetPath(p)).filter((p): p is string => Boolean(p)) : undefined,
    marksUnavailable: detail.marks_json === null,
  };
}

/** Faculty grading update */
export async function saveMarks(rollNo: string, subjectCode: string, marks: MarksRow[], role: "student" | "faculty" = "student"): Promise<void> {
  const script = await getScript(rollNo, subjectCode, role);
  if (!script) throw new Error("Paper not found");

  const detail = (await AuthService.get(`/teacher/paper/${script.id}/`)) as TeacherPaperDetail;
  const marksPayload = buildSectionMarksPayload(detail.marks_json, marks);

  await AuthService.put(`/teacher/paper/${script.id}/`, {
    marks_json: marksPayload,
    total_score: computeTotal(marks),
    evaluation_status: "COMPLETED",
  });
}

/** Student grievance submission */
export async function submitGrievance(_rollNo: string, subjectCode: string, text: string): Promise<void> {
  const paper = await resolveStudentPaperBySubject(subjectCode);
  if (!paper) throw new Error("Completed paper not found for this subject");

  await AuthService.post("/student/grievance/", {
    paper: paper.paper_id,
    student_comment: text,
  });
}

export async function getStudentGrievancesBySubject(subjectCode: string): Promise<StudentGrievanceItem[]> {
  const paper = await resolveStudentPaperBySubject(subjectCode);
  if (!paper) return [];

  return (await AuthService.get(`/student/grievances/?paper=${paper.paper_id}`)) as StudentGrievanceItem[];
}

export async function getFacultyGrievances(filter: FacultyGrievanceFilter): Promise<FacultyGrievanceItem[]> {
  const query = encodeURIComponent(filter);
  return (await AuthService.get(`/teacher/grievances/?filter=${query}`)) as FacultyGrievanceItem[];
}

export async function getFacultyGrievanceStats(): Promise<FacultyGrievanceStats> {
  return (await AuthService.get("/teacher/grievances/stats/")) as FacultyGrievanceStats;
}

export async function decideFacultyGrievance(
  grievanceId: number,
  payload: {
    status: "RESOLVED" | "REJECTED";
    marks_json?: unknown;
    total_score?: number;
  },
): Promise<void> {
  await AuthService.post(`/teacher/grievances/${grievanceId}/decision/`, payload);
}

/**
 * Compatibility wrappers used by EvaluationViewer.
 */
export async function acceptGrievance(rollNo: string, subjectCode: string, updatedMarks: MarksRow[], grievanceId?: number): Promise<void> {
  const script = await getScript(rollNo, subjectCode, "faculty");
  if (!script) throw new Error("Paper not found");

  const resolvedGrievanceId = grievanceId ?? Number((script.grievanceDate || "").replace(/[^0-9]/g, ""));
  if (!resolvedGrievanceId) {
    throw new Error("No actionable grievance found for this script.");
  }

  const detail = (await AuthService.get(`/teacher/paper/${script.id}/`)) as TeacherPaperDetail;
  const marksPayload = buildSectionMarksPayload(detail.marks_json, updatedMarks);

  await decideFacultyGrievance(resolvedGrievanceId, {
    status: "RESOLVED",
    marks_json: marksPayload,
    total_score: computeTotal(updatedMarks),
  });
}

export async function rejectGrievance(rollNo: string, subjectCode: string, grievanceId?: number): Promise<void> {
  const script = await getScript(rollNo, subjectCode, "faculty");
  if (!script) throw new Error("Paper not found");

  const resolvedGrievanceId = grievanceId ?? Number((script.grievanceDate || "").replace(/[^0-9]/g, ""));
  if (!resolvedGrievanceId) {
    throw new Error("No actionable grievance found for this script.");
  }

  await decideFacultyGrievance(resolvedGrievanceId, { status: "REJECTED" });
}

export async function getTeacherPaperMarkings(paperId: string | number, pageIndex: number): Promise<unknown | null> {
  const response = (await AuthService.get(`/teacher/paper/${paperId}/markings/${pageIndex}/`)) as TeacherPaperMarkingDetailResponse;
  return response?.markings ?? null;
}

export async function getStudentPaperMarkings(paperId: string | number, pageIndex: number): Promise<unknown | null> {
  const response = (await AuthService.get(`/student/paper/${paperId}/markings/${pageIndex}/`)) as TeacherPaperMarkingDetailResponse;
  return response?.markings ?? null;
}

export async function saveTeacherPaperMarkings(paperId: string | number, pageIndex: number, markings: unknown): Promise<void> {
  await AuthService.put(`/teacher/paper/${paperId}/markings/${pageIndex}/`, {
    markings,
  });
}

/** Student results from backend (no hardcoded subjects) */
export async function getStudentResults(_rollNo: string): Promise<StudentResult[]> {
  const [enrollments, papers, grievances] = await Promise.all([
    fetchStudentEnrollmentsInternal(),
    fetchStudentPapersInternal(),
    AuthService.get("/student/grievances/") as Promise<StudentGrievanceItem[]>,
  ]);

  const papersByCourse = new Map<string, StudentPaperListItem>();
  for (const p of papers) {
    papersByCourse.set(p.exam.course_code.toLowerCase(), p);
  }

  const grievanceByPaper = new Map<number, StudentGrievanceItem>();
  for (const g of grievances) {
    if (!grievanceByPaper.has(g.paper)) {
      grievanceByPaper.set(g.paper, g);
    }
  }

  return enrollments.map((enr) => {
    const subjectCode = enr.allocation.course.course_code;
    const paper = papersByCourse.get(subjectCode.toLowerCase());
    const latestGrievance = paper ? grievanceByPaper.get(paper.paper_id) : undefined;
    const recheckStatus = latestGrievance ? (latestGrievance.status === "OPEN" ? "under-review" : latestGrievance.status === "RESOLVED" ? "updated" : "unchanged") : "not-submitted";

    return {
      subjectCode,
      subjectName: enr.allocation.course.title || subjectCode,
      marks: paper && paper.evaluation_status === "COMPLETED" ? (paper.total_score ?? 0) : null,
      recheckStatus,
    };
  });
}

/** Backend releases completed papers; keep always true in current UI contract */
export function areResultsPublished(): boolean {
  return true;
}

/** No frontend toggle; backend controls visibility/state */
export function setResultsPublished(_published: boolean): void {
  // no-op
}

/** Fetch full paper details for a student by subject code */
export async function getStudentPaperDetailsBySubject(subjectCode: string): Promise<StudentPaperDetail | null> {
  try {
    const paper = await resolveStudentPaperBySubject(subjectCode);
    if (!paper) return null;

    const detail = (await AuthService.get(`/student/paper/${paper.paper_id}/`)) as StudentPaperDetail;
    return detail;
  } catch (error) {
    console.error(`Failed to fetch paper details for ${subjectCode}:`, error);
    return null;
  }
}

/** Download a file from the given path */
function parseFilenameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = headerValue.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return null;
}

function extensionFromMimeType(contentType: string | null): string | null {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("application/pdf")) return "pdf";
  return null;
}

function hasFileExtension(name: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(name);
}

export async function downloadFile(filePath: string, fileName: string): Promise<void> {
  try {
    const normalized = normalizeAssetPath(filePath);
    if (!normalized) {
      throw new Error("Invalid file path");
    }

    // Keep absolute URLs untouched; preserve /api, /media, /Data; prefix /media only for plain relative asset paths.
    const isAbsolute = normalized.startsWith("http://") || normalized.startsWith("https://");
    const url = isAbsolute
      ? normalized
      : (
          normalized.startsWith("/api/") ||
          normalized.startsWith("/media/") ||
          normalized.startsWith("/Data/")
            ? normalized
            : `/media${normalized}`
        );

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("Received empty file content");
    }

    const dispositionName = parseFilenameFromContentDisposition(response.headers.get("content-disposition"));
    const mimeExt = extensionFromMimeType(response.headers.get("content-type"));
    let finalName = (fileName || dispositionName || filePath.split("/").pop() || "download").trim();

    if (!hasFileExtension(finalName) && mimeExt) {
      finalName = `${finalName}.${mimeExt}`;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    console.error(`Failed to download file ${filePath}:`, error);
    throw new Error(`Failed to download ${fileName}`);
  }
}
