// ==========================================
// Mock evaluation service.
//
// TO CONNECT TO YOUR REAL DATABASE:
// Replace the function bodies with actual
// API/database calls. The function signatures
// and return types stay the same.
//
// SECURITY NOTES:
// ✓ User identity stored in UserSessionContext
//   (NOT in URL parameters)
// ✓ Backend (Django) handles real authentication
// ✓ Frontend only manages session state via UserSessionContext
// ✓ Backend APIs MUST validate:
//   - Students can only access their own data
//   - Faculty can only access papers assigned to them
// ✓ Use HTTP-only JWT cookies (set by backend)
// ==========================================

import {
  AnswerScript,
  StudentResult,
  MarksRow,
  createEmptyMarks,
  computeTotal,
} from "@/types/evaluation";

// ---- In-memory mock store ----

const GRADED_MARKS: MarksRow[] = [
  { q: "Q1", parts: { a: "2", b: "3", c: "5", d: "4", e: "-" } },
  { q: "Q2", parts: { a: "4", b: "-", c: "3", d: "2", e: "5" } },
  { q: "Q3", parts: { a: "5", b: "4", c: "-", d: "3", e: "2" } },
  { q: "Q4", parts: { a: "-", b: "2", c: "4", d: "5", e: "3" } },
  { q: "Q5", parts: { a: "3", b: "5", c: "2", d: "-", e: "4" } },
];

function cloneMarks(m: MarksRow[]): MarksRow[] {
  return m.map((r) => ({ ...r, parts: { ...r.parts } }));
}

let scripts: AnswerScript[] = [
  { id: "1", rollNo: "230501", subjectCode: "CS3001", submissionDate: "2025-12-10", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "2", rollNo: "230512", subjectCode: "CS3002", submissionDate: "2025-12-11", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "3", rollNo: "230523", subjectCode: "CS3003", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "4", rollNo: "230534", subjectCode: "CS3001", submissionDate: "2025-12-12", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "5", rollNo: "230545", subjectCode: "CS3004", submissionDate: "2025-12-11", status: "graded", hasGrievance: true, grievanceText: "I believe Q3 part (c) was marked incorrectly. My approach using dynamic programming is valid as per the textbook reference on page 247.", grievanceDate: "2025-12-15 14:32", marks: cloneMarks(GRADED_MARKS) },
  { id: "6", rollNo: "230547", subjectCode: "CS3002", submissionDate: "2025-12-12", status: "graded", hasGrievance: true, grievanceText: "Q2 part (b) was left unevaluated but I have written a valid solution.", grievanceDate: "2025-12-16 09:15", marks: cloneMarks(GRADED_MARKS) },
  { id: "7", rollNo: "230558", subjectCode: "CS3005", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "8", rollNo: "230569", subjectCode: "CS3003", submissionDate: "2025-12-11", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  
  // Student 230547 (Current logged-in student) - All subjects
  { id: "9", rollNo: "230547", subjectCode: "CS3001", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "10", rollNo: "230547", subjectCode: "CS3003", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "11", rollNo: "230547", subjectCode: "CS3004", submissionDate: "2025-12-11", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "12", rollNo: "230547", subjectCode: "CS3005", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "13", rollNo: "230547", subjectCode: "MA2001", submissionDate: "2025-12-12", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "14", rollNo: "230547", subjectCode: "CS3006", submissionDate: "2025-12-11", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "15", rollNo: "230547", subjectCode: "CS3007", submissionDate: "2025-12-13", status: "graded", hasGrievance: true, grievanceText: "I used an alternative approach for the neural network optimization that should be accepted.", grievanceDate: "2025-12-17 10:45", marks: cloneMarks(GRADED_MARKS) },
  { id: "16", rollNo: "230547", subjectCode: "CS3008", submissionDate: "2025-12-09", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "17", rollNo: "230547", subjectCode: "CS3009", submissionDate: "2025-12-14", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "18", rollNo: "230547", subjectCode: "CS3010", submissionDate: "2025-12-08", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "19", rollNo: "230547", subjectCode: "MA2002", submissionDate: "2025-12-12", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "20", rollNo: "230547", subjectCode: "EC2001", submissionDate: "2025-12-11", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "21", rollNo: "230547", subjectCode: "ME2001", submissionDate: "2025-12-10", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  
  // Student 2305741 (Current logged-in student) - All subjects
  { id: "22", rollNo: "2305741", subjectCode: "CS3001", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "23", rollNo: "2305741", subjectCode: "CS3002", submissionDate: "2025-12-11", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "24", rollNo: "2305741", subjectCode: "CS3003", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "25", rollNo: "2305741", subjectCode: "CS3004", submissionDate: "2025-12-11", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "26", rollNo: "2305741", subjectCode: "CS3005", submissionDate: "2025-12-10", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "27", rollNo: "2305741", subjectCode: "CS3006", submissionDate: "2025-12-11", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "28", rollNo: "2305741", subjectCode: "CS3007", submissionDate: "2025-12-13", status: "graded", hasGrievance: true, grievanceText: "I believe the grading for Q4 was too strict. The approach I used is valid.", grievanceDate: "2025-12-17 11:20", marks: cloneMarks(GRADED_MARKS) },
  { id: "29", rollNo: "2305741", subjectCode: "CS3008", submissionDate: "2025-12-09", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "30", rollNo: "2305741", subjectCode: "CS3009", submissionDate: "2025-12-14", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
  { id: "31", rollNo: "2305741", subjectCode: "CS3010", submissionDate: "2025-12-08", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "32", rollNo: "2305741", subjectCode: "MA2001", submissionDate: "2025-12-12", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "33", rollNo: "2305741", subjectCode: "MA2002", submissionDate: "2025-12-12", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "34", rollNo: "2305741", subjectCode: "EC2001", submissionDate: "2025-12-11", status: "graded", hasGrievance: false, marks: cloneMarks(GRADED_MARKS) },
  { id: "35", rollNo: "2305741", subjectCode: "ME2001", submissionDate: "2025-12-10", status: "pending", hasGrievance: false, marks: createEmptyMarks() },
];

let resultsPublished = true;

// ---- Public API ----
// Replace these with real DB calls when ready.

/** Get all scripts (faculty view) */
export function getAllScripts(): AnswerScript[] {
  return scripts.map((s) => ({ ...s, marks: cloneMarks(s.marks) }));
}

/** Get a specific script by roll + subject */
export function getScript(rollNo: string, subjectCode: string): AnswerScript | undefined {
  const s = scripts.find(
    (s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase()
  );
  return s ? { ...s, marks: cloneMarks(s.marks) } : undefined;
}

/** Save marks for a script (faculty action) */
export function saveMarks(rollNo: string, subjectCode: string, marks: MarksRow[]): void {
  const idx = scripts.findIndex(
    (s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase()
  );
  if (idx !== -1) {
    scripts[idx].marks = cloneMarks(marks);
    scripts[idx].status = "graded";
  }
}

/** Submit a grievance (student action) */
export function submitGrievance(rollNo: string, subjectCode: string, text: string): void {
  const idx = scripts.findIndex(
    (s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase()
  );
  if (idx !== -1) {
    scripts[idx].hasGrievance = true;
    scripts[idx].grievanceText = text;
    scripts[idx].grievanceDate = new Date().toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Accept grievance — faculty updates marks and clears grievance */
export function acceptGrievance(rollNo: string, subjectCode: string, updatedMarks: MarksRow[]): void {
  const idx = scripts.findIndex(
    (s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase()
  );
  if (idx !== -1) {
    scripts[idx].marks = cloneMarks(updatedMarks);
    scripts[idx].hasGrievance = false;
    scripts[idx].grievanceText = undefined;
    scripts[idx].grievanceDate = undefined;
  }
}

/** Reject grievance — clears grievance flag, marks stay */
export function rejectGrievance(rollNo: string, subjectCode: string): void {
  const idx = scripts.findIndex(
    (s) => s.rollNo === rollNo && s.subjectCode.toLowerCase() === subjectCode.toLowerCase()
  );
  if (idx !== -1) {
    scripts[idx].hasGrievance = false;
    scripts[idx].grievanceText = undefined;
    scripts[idx].grievanceDate = undefined;
  }
}

/** Get student results for a specific roll number */
export function getStudentResults(rollNo: string): StudentResult[] {
  const subjectNames: Record<string, string> = {
    CS3001: "Data Structures & Algorithms",
    CS3002: "Operating Systems",
    CS3003: "Database Management Systems",
    CS3004: "Computer Networks",
    CS3005: "Software Engineering",
    CS3006: "Web Development",
    CS3007: "Artificial Intelligence",
    CS3008: "Cloud Computing",
    CS3009: "Mobile Application Development",
    CS3010: "Cybersecurity",
    MA2001: "Discrete Mathematics",
    MA2002: "Linear Algebra",
    EC2001: "Digital Electronics",
    ME2001: "Engineering Mathematics",
  };

  return scripts
    .filter((s) => s.rollNo === rollNo)
    .map((s) => ({
      subjectCode: s.subjectCode,
      subjectName: subjectNames[s.subjectCode] || s.subjectCode,
      marks: s.status === "graded" ? computeTotal(s.marks) : null,
      recheckStatus: s.hasGrievance
        ? "under-review" as const
        : s.status === "pending"
        ? "not-submitted" as const
        : "not-submitted" as const,
    }));
}

/** Check if results are published */
export function areResultsPublished(): boolean {
  return resultsPublished;
}

/** Toggle results publication */
export function setResultsPublished(published: boolean): void {
  resultsPublished = published;
}
