import AuthService from "@/app/services/authService";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const STATS_CACHE_TTL_MS = 5 * 60 * 1000;
const statsCache = new Map<string, CacheEntry<unknown>>();

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getCachedValue<T>(key: string): T | null {
  const now = Date.now();
  const memoryEntry = statsCache.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return cloneValue(memoryEntry.value);
  }

  try {
    const raw = window.sessionStorage.getItem(`stats-cache:${key}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt <= now) {
      window.sessionStorage.removeItem(`stats-cache:${key}`);
      return null;
    }
    statsCache.set(key, parsed as CacheEntry<unknown>);
    return cloneValue(parsed.value);
  } catch {
    return null;
  }
}

function setCachedValue<T>(key: string, value: T, ttlMs: number = STATS_CACHE_TTL_MS): void {
  const entry: CacheEntry<T> = {
    expiresAt: Date.now() + ttlMs,
    value: cloneValue(value),
  };

  statsCache.set(key, entry as CacheEntry<unknown>);
  try {
    window.sessionStorage.setItem(`stats-cache:${key}`, JSON.stringify(entry));
  } catch {
    // sessionStorage might be unavailable in strict browser contexts
  }
}

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
  grievanceComment?: string;
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
  const cacheKey = `course-statistics:${courseCode}`;
  const cached = getCachedValue<CourseStatistics>(cacheKey);
  if (cached) {
    return cached;
  }

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

  const payload: CourseStatistics = {
    courseCode,
    courseTitle: "Data not available",
    sections,
  };

  setCachedValue(cacheKey, payload);
  return payload;
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
  const cacheKey = `score-distribution:${courseCode}`;
  const cached = getCachedValue<ScoreDistribution>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = (await AuthService.get(
    `/stats/scores/?course_code=${encodeURIComponent(courseCode)}`
  )) as ScoreDistribution;
  setCachedValue(cacheKey, data);
  return data;
}

export async function fetchStudentsInRange(
  courseCode: string,
  minScore: number = 0,
  maxScore: number = 100
) {
  const cacheKey = `students-in-range:${courseCode}:${minScore}:${maxScore}`;
  const cached = getCachedValue<{ students: StudentStats[] }>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = (await AuthService.get(
    `/stats/students/?course_code=${encodeURIComponent(courseCode)}&min=${minScore}&max=${maxScore}`
  )) as { students: StudentStats[] };

  setCachedValue(cacheKey, response);
  return response;
}

export interface StudentStats {
  name: string;
  university_id: string;
  score: number;
  section: string;
  paper_id: number;
}

export async function fetchAccessibleCourses() {
  const cacheKey = "accessible-courses";
  const cached = getCachedValue<{ courses: Array<{ course_code: string; title: string }> }>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = (await AuthService.get("/stats/dashboard/data/")) as {
    courses: Array<{ course_code: string; title: string }>;
  };
  setCachedValue(cacheKey, response);
  return response;
}
