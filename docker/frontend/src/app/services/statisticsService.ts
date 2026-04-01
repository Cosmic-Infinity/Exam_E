import AuthService from "@/app/services/authService";

export interface SectionStatistics {
  sectionName: string;
  teacherName: string;
  totalStudents: number;
  checkingProgress: number;
  markingProgress: number | null;
  markingProgressAvailable?: boolean;
  pendingProgress: number;
  grievanceCount: number;
  grievanceDetails: GrievanceDetail[];
  grievanceDetailsAvailable?: boolean;
}

export interface GrievanceDetail {
  studentId: string;
  studentName: string;
  grievanceType: string;
  rollNo: string;
}

export interface CourseStatistics {
  courseCode: string;
  courseTitle: string;
  sections: SectionStatistics[];
}

type StatsSectionsResponse = {
  sections: Array<{
    allocation_id: number;
    section_name: string;
    teacher__full_name: string;
    total_students: number;
    checked: number;
    pending: number;
    grievances: number;
  }>;
};

export async function fetchCourseStatistics(courseCode: string): Promise<CourseStatistics> {
  const sectionData = (await AuthService.get(
    `/stats/sections/?course_code=${encodeURIComponent(courseCode)}`
  )) as StatsSectionsResponse;

  const sections: SectionStatistics[] = (sectionData.sections || []).map((s) => ({
    sectionName: s.section_name,
    teacherName: s.teacher__full_name || "Data not available",
    totalStudents: Number(s.total_students ?? 0),
    checkingProgress: Number(s.checked ?? 0),
    // Backend does not provide a dedicated "marked" metric on this endpoint.
    markingProgress: null,
    markingProgressAvailable: false,
    pendingProgress: Number(s.pending ?? 0),
    grievanceCount: Number(s.grievances ?? 0),
    grievanceDetails: [],
    grievanceDetailsAvailable: false,
  }));

  return {
    courseCode,
    courseTitle: "Data not available",
    sections,
  };
}

export interface ScoreDistribution {
  labels: string[];
  distribution: number[];
  meta: {
    count: number;
    avg: number;
  };
}

export async function fetchScoreDistribution(courseCode: string): Promise<ScoreDistribution> {
  const data = (await AuthService.get(
    `/stats/scores/?course_code=${encodeURIComponent(courseCode)}`
  )) as ScoreDistribution;
  return data;
}

export async function fetchStudentsInRange(
  courseCode: string,
  minScore: number = 0,
  maxScore: number = 100
) {
  return AuthService.get(
    `/stats/students/?course_code=${encodeURIComponent(courseCode)}&min=${minScore}&max=${maxScore}`
  );
}

export interface StudentStats {
  name: string;
  university_id: string;
  score: number;
  section: string;
  paper_id: number;
}

export async function fetchAccessibleCourses() {
  return AuthService.get("/stats/dashboard/data/");
}
