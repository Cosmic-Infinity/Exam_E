// ==========================================
// Core types for the evaluation system.
// When connecting to a real database, these
// types stay the same — only the service
// layer (src/services/evaluationService.ts)
// needs to change.
// ==========================================

export type ScriptStatus = "pending" | "graded";
export type RecheckStatus = "not-submitted" | "under-review" | "updated" | "unchanged";

export interface Subject {
  code: string;
  name: string;
}

export interface MarksRow {
  q: string;
  parts: Record<string, string>;
}

export interface StudentResult {
  subjectCode: string;
  subjectName: string;
  marks: number | null; // null = not yet graded
  recheckStatus: RecheckStatus;
}

export interface AnswerScript {
  id: string; // unique identifier
  rollNo: string;
  subjectCode: string;
  submissionDate: string;
  status: ScriptStatus;
  hasGrievance: boolean;
  grievanceText?: string;
  grievanceDate?: string;
  marks: MarksRow[];
}

export const SUBJECTS: Subject[] = [
  { code: "CS3001", name: "Data Structures & Algorithms" },
  { code: "CS3002", name: "Operating Systems" },
  { code: "CS3003", name: "Database Management Systems" },
  { code: "CS3004", name: "Computer Networks" },
  { code: "CS3005", name: "Software Engineering" },
  { code: "MA2001", name: "Discrete Mathematics" },
];

export const SUBJECT_MAP: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.code.toLowerCase(), s.name])
);

export const EMPTY_MARKS: MarksRow[] = [
  { q: "Q1", parts: { a: "0", b: "0", c: "0", d: "0", e: "0" } },
  { q: "Q2", parts: { a: "0", b: "0", c: "0", d: "0", e: "0" } },
  { q: "Q3", parts: { a: "0", b: "0", c: "0", d: "0", e: "0" } },
  { q: "Q4", parts: { a: "0", b: "0", c: "0", d: "0", e: "0" } },
  { q: "Q5", parts: { a: "0", b: "0", c: "0", d: "0", e: "0" } },
];

export function createEmptyMarks(): MarksRow[] {
  return EMPTY_MARKS.map((r) => ({ ...r, parts: { ...r.parts } }));
}

export function computeTotal(marks: MarksRow[]): number {
  return marks.reduce(
    (sum, row) =>
      sum +
      Object.values(row.parts).reduce(
        (s, v) => s + (v === "-" || v === "" ? 0 : parseInt(v) || 0),
        0
      ),
    0
  );
}
