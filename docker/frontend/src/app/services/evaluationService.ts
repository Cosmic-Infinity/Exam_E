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
};

type TeacherPaperDetail = {
  paper_id: number;
  student_university_id: string;
  student_name: string;
  marks_json: unknown;
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
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
    const exams = (await AuthService.get(`/teacher/allocations/${allocation.allocation_id}/exams/`)) as TeacherExam[];

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
          submissionDate: "",
          status: statusToScriptStatus(paper.evaluation_status),
          hasGrievance: false,
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
      submissionDate: "",
      status: statusToScriptStatus(detail.evaluation_status),
      hasGrievance: false,
      marks: normalizeMarks(detail.marks_json),
      question_paper_path: detail.question_paper_path ? `/${detail.question_paper_path}` : undefined,
      answer_key_path: detail.answer_key_path ? `/${detail.answer_key_path}` : undefined,
      question_paper_schema: detail.question_paper_schema,
      pages: detail.pages ? detail.pages.map((p) => `/${p}`) : undefined,
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
          submissionDate: "",
          status: statusToScriptStatus(detail.evaluation_status),
          hasGrievance: false,
          marks: normalizeMarks(detail.marks_json),
          question_paper_path: detail.question_paper_path ? `/${detail.question_paper_path}` : undefined,
          answer_key_path: detail.answer_key_path ? `/${detail.answer_key_path}` : undefined,
          question_paper_schema: detail.question_paper_schema,
          pages: detail.pages ? detail.pages.map((p) => `/${p}`) : undefined,
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
    submissionDate: "",
    status: statusToScriptStatus(detail.evaluation_status),
    hasGrievance: false,
    marks: normalizeMarks(detail.marks_json),
    question_paper_path: detail.question_paper_path ? `/${detail.question_paper_path}` : undefined,
    answer_key_path: detail.answer_key_path ? `/${detail.answer_key_path}` : undefined,
    question_paper_schema: detail.question_paper_schema,
    pages: detail.pages ? detail.pages.map((p: string) => `/${p}`) : undefined,
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
export async function submitGrievance(
  _rollNo: string,
  subjectCode: string,
  text: string
): Promise<void> {
  const paper = await resolveStudentPaperBySubject(subjectCode);
  if (!paper) throw new Error("Completed paper not found for this subject");

  await AuthService.post("/student/grievance/", {
    paper: paper.paper_id,
    student_comment: text,
  });
}

/**
 * Backend currently has no explicit teacher grievance decision endpoint.
 * Keep these wrappers for UI compatibility.
 */
export async function acceptGrievance(
  rollNo: string,
  subjectCode: string,
  updatedMarks: MarksRow[]
): Promise<void> {
  await saveMarks(rollNo, subjectCode, updatedMarks);
}

export async function rejectGrievance(
  _rollNo: string,
  _subjectCode: string
): Promise<void> {
  return;
}

/** Student results from backend (no hardcoded subjects) */
export async function getStudentResults(_rollNo: string): Promise<StudentResult[]> {
  const [enrollments, papers] = await Promise.all([
    fetchStudentEnrollmentsInternal(),
    fetchStudentPapersInternal(),
  ]);

  const papersByCourse = new Map<string, StudentPaperListItem>();
  for (const p of papers) {
    papersByCourse.set(p.exam.course_code.toLowerCase(), p);
  }

  return enrollments.map((enr) => {
    const subjectCode = enr.allocation.course.course_code;
    const paper = papersByCourse.get(subjectCode.toLowerCase());

    return {
      subjectCode,
      subjectName: enr.allocation.course.title || subjectCode,
      marks:
        paper && paper.evaluation_status === "COMPLETED"
          ? (paper.total_score ?? 0)
          : null,
      recheckStatus: "not-submitted",
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
export async function getStudentPaperDetailsBySubject(
  subjectCode: string
): Promise<StudentPaperDetail | null> {
  try {
    const paper = await resolveStudentPaperBySubject(subjectCode);
    if (!paper) return null;

    const detail = (await AuthService.get(
      `/student/paper/${paper.paper_id}/`
    )) as StudentPaperDetail;
    return detail;
  } catch (error) {
    console.error(`Failed to fetch paper details for ${subjectCode}:`, error);
    return null;
  }
}

/** Download a file from the given path */
export function downloadFile(filePath: string, fileName: string): void {
  try {
    // Handle both cases: paths with and without /media/ prefix
    const url = filePath.startsWith("/media/") ? filePath : `/media/${filePath}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || filePath.split("/").pop() || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error(`Failed to download file ${filePath}:`, error);
    throw new Error(`Failed to download ${fileName}`);
  }
}
