import AuthService from "@/services/authService";
import {
  AnswerScript,
  StudentResult,
  MarksRow,
  createEmptyMarks,
  computeTotal,
} from "@/types/evaluation";

type TeacherAllocation = {
  allocation_id: number;
  course: { course_code: string; title: string };
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
  file_path: string;
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
  file_path: string;
  marks_json: unknown;
  total_score: number | null;
  evaluation_status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  question_paper_schema?: unknown;
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

  // Case 2: backend JSON object format (q1/p1... style)
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, Record<string, number | string>>;

    const rows: MarksRow[] = [];
    for (let q = 1; q <= 5; q++) {
      const qKey = `q${q}`;
      const parts = obj[qKey] || {};

      rows.push({
        q: `Q${q}`,
        parts: {
          a: String(parts.p1 ?? "0"),
          b: String(parts.p2 ?? "0"),
          c: String(parts.p3 ?? "0"),
          d: String(parts.p4 ?? "0"),
          e: String(parts.p5 ?? "0"),
        },
      });
    }

    return rows;
  }

  return createEmptyMarks();
}

function cacheKey(rollNo: string, subjectCode: string): string {
  return `${rollNo}::${subjectCode.toLowerCase()}`;
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
      file_path: detail.file_path ? `/media/${detail.file_path}` : undefined,
      question_paper_path: detail.question_paper_path ? `/media/${detail.question_paper_path}` : undefined,
      answer_key_path: detail.answer_key_path ? `/media/${detail.answer_key_path}` : undefined,
      question_paper_schema: detail.question_paper_schema,
    };
  }

  // 2) Try teacher discovery only for faculty
  if (role === "faculty") {
    try {
      const teacherScripts = await fetchTeacherScriptsInternal();
      const found = teacherScripts.find((s) => s.student_university_id === rollNo && s.exam.course_code.toLowerCase() === subjectCode.toLowerCase());
      if (found) {
        const detail = (await AuthService.get(`/teacher/paper/${found.paper_id}/`)) as TeacherPaperDetail;

        return {
          id: String(detail.paper_id),
          rollNo: detail.student_university_id,
          subjectCode: subjectCode,
          submissionDate: "",
          status: statusToScriptStatus(detail.evaluation_status),
          hasGrievance: false,
          marks: normalizeMarks(detail.marks_json),
          file_path: detail.file_path ? `/media/${detail.file_path}` : undefined,
          question_paper_path: detail.question_paper_path ? `/media/${detail.question_paper_path}` : undefined,
          answer_key_path: detail.answer_key_path ? `/media/${detail.answer_key_path}` : undefined,
          question_paper_schema: detail.question_paper_schema,
          pages: detail.pages ? detail.pages.map((p) => `/media/${p}`) : undefined,
        };
      }
    } catch {
      // ignore and fallback to student path
    }
  }

  // 3) Student fallback
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
    file_path: detail.file_path ? `/media/${detail.file_path}` : undefined,
    // Student serializer doesn't have QP/Key path yet, but could add if needed
    question_paper_schema: detail.question_paper_schema,
  };
}

/** Faculty grading update */
export async function saveMarks(
  rollNo: string,
  subjectCode: string,
  marks: MarksRow[]
): Promise<void> {
  const script = await getScript(rollNo, subjectCode);
  if (!script) throw new Error("Paper not found");

  await AuthService.put(`/teacher/paper/${script.id}/`, {
    marks_json: marks,
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
