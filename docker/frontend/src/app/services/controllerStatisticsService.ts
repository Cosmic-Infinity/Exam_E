/**
 * Controller Statistics Service
 * Handles fetching institution-wide statistics organized by semester, subject, and section
 */

import AuthService from "@/app/services/authService";

export interface SemesterData {
  semester: number;
  totalCourses: number;
  totalStudents: number;
  subjectsCount: number;
}

export interface SubjectData {
  courseCode: string;
  courseTitle: string;
  semester: number;
  sectionsCount: number | null;
  totalStudents: number;
  totalGrievances: number;
}

export interface SectionStatistics {
  sectionName: string;
  totalStudents: number;
  checkingProgress: number; // Papers in IN_PROGRESS status
  markingProgress: number | null; // Backend does not provide this on current endpoint
  markingProgressAvailable?: boolean;
  pendingProgress: number; // Papers in PENDING status
  grievanceCount: number;
  grievanceDetails: GrievanceDetail[];
  grievanceDetailsAvailable?: boolean;
}

const UNKNOWN_SEMESTER = 0;

function parseSemesterFromCourseCode(courseCode: string): number | null {
  const codeMatch = courseCode.match(/(\d)0\d/);
  if (!codeMatch) {
    return null;
  }
  return parseInt(codeMatch[1], 10);
}

export interface GrievanceDetail {
  studentId: string;
  studentName: string;
  grievanceType: string;
  rollNo: string;
}

/**
 * Fetch all semesters with their statistics
 */
export async function fetchAllSemesters(): Promise<SemesterData[]> {
  try {
    // Fetch all accessible subjects
    const subjectsResponse = (await AuthService.get("/stats/subjects/")) as {
      subjects: Array<{
        course_code: string;
        title: string;
        total_students: number;
        checked: number;
        pending: number;
        grievances: number;
      }>;
    };

    const subjects = subjectsResponse.subjects || [];

    // Group subjects by semester derived from course code when possible.
    // Unknown semester values are grouped under 0 and shown as "Data not available" in UI.
    const semesterMap = new Map<number, SemesterData>();

    subjects.forEach((subject) => {
      const semester = parseSemesterFromCourseCode(subject.course_code) ?? UNKNOWN_SEMESTER;

      if (!semesterMap.has(semester)) {
        semesterMap.set(semester, {
          semester,
          totalCourses: 0,
          totalStudents: 0,
          subjectsCount: 0,
        });
      }

      const semesterData = semesterMap.get(semester)!;
      semesterData.totalCourses += 1;
      semesterData.totalStudents += subject.total_students;
      semesterData.subjectsCount += 1;
    });

    // Return sorted semesters
    return Array.from(semesterMap.values()).sort((a, b) => a.semester - b.semester);
  } catch (error) {
    console.error("Error fetching semesters:", error);
    throw new Error("Failed to fetch semester data");
  }
}

/**
 * Fetch all subjects (courses) for a specific semester
 */
export async function fetchSubjectsBySemester(semester: number): Promise<SubjectData[]> {
  try {
    // Fetch all accessible subjects
    const subjectsResponse = (await AuthService.get("/stats/subjects/")) as {
      subjects: Array<{
        course_code: string;
        title: string;
        total_students: number;
        checked: number;
        pending: number;
        grievances: number;
      }>;
    };

    const subjects = subjectsResponse.subjects || [];

    const filteredSubjects = subjects
      .map((subject) => ({
        raw: subject,
        detectedSemester: parseSemesterFromCourseCode(subject.course_code) ?? UNKNOWN_SEMESTER,
      }))
      .filter((s) => s.detectedSemester === semester);

    const subjectsWithSections = await Promise.all(
      filteredSubjects.map(async ({ raw, detectedSemester }) => {
        let sectionsCount: number | null = null;
        try {
          const sectionResp = (await AuthService.get(
            `/stats/sections/?course_code=${encodeURIComponent(raw.course_code)}`
          )) as { sections?: Array<unknown> };
          sectionsCount = Array.isArray(sectionResp.sections) ? sectionResp.sections.length : null;
        } catch {
          sectionsCount = null;
        }

        return {
          courseCode: raw.course_code,
          courseTitle: raw.title,
          semester: detectedSemester,
          sectionsCount,
          totalStudents: raw.total_students,
          totalGrievances: raw.grievances,
        };
      })
    );

    return subjectsWithSections;
  } catch (error) {
    console.error("Error fetching subjects:", error);
    throw new Error(`Failed to fetch subjects for semester ${semester}`);
  }
}

/**
 * Fetch section statistics for a specific course/subject
 */
export async function fetchSectionsByCourse(courseCode: string): Promise<SectionStatistics[]> {
  try {
    // Fetch sections and grievance data in parallel
    const [sectionsResponse, grievanceResponse] = await Promise.all([
      AuthService.get(`/stats/sections/?course_code=${encodeURIComponent(courseCode)}`),
      AuthService.get(`/stats/grievances/?course_code=${encodeURIComponent(courseCode)}`),
    ]);

    const sections = (sectionsResponse as any).sections || [];
    const grievanceData = (grievanceResponse as any).chart_data || [];

    // Map grievance count by section name
    const grievanceMap = new Map<string, number>();
    grievanceData.forEach((item: any) => {
      grievanceMap.set(item.label || "Unknown", item.count || 0);
    });

    // Transform sections response to SectionStatistics format
    const sectionStatistics: SectionStatistics[] = sections.map((section: any, index: number) => ({
      sectionName: section.section_name || `Data not available (${index + 1})`,
      totalStudents: section.total_students || 0,
      checkingProgress: section.checked || 0,
      markingProgress: null,
      markingProgressAvailable: false,
      pendingProgress: section.pending || 0,
      grievanceCount: grievanceMap.get(section.section_name) || section.grievances || 0,
      grievanceDetails: [],
      grievanceDetailsAvailable: false,
    }));

    return sectionStatistics;
  } catch (error) {
    console.error("Error fetching section statistics:", error);
    throw new Error(`Failed to fetch section statistics for ${courseCode}`);
  }
}

