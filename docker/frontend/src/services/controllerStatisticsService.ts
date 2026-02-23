/**
 * Controller Statistics Service
 * Handles fetching institution-wide statistics organized by semester, subject, and section
 */

import AuthService from "@/services/authService";

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
  sectionsCount: number;
  totalStudents: number;
  totalGrievances: number;
}

export interface SectionStatistics {
  sectionName: string;
  totalStudents: number;
  checkingProgress: number; // Papers in IN_PROGRESS status
  markingProgress: number; // Papers in COMPLETED status
  pendingProgress: number; // Papers in PENDING status
  grievanceCount: number;
  grievanceDetails: GrievanceDetail[];
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

    // Group subjects by semester (extract from course code pattern or use a default grouping)
    // For now, we'll use a practical grouping based on course code patterns
    const semesterMap = new Map<number, SemesterData>();

    subjects.forEach((subject) => {
      // Try to extract semester from course code (e.g., CS301 -> semester 3)
      // If pattern doesn't match, use default semester assignment
      let semester = 5; // default semester
      const codeMatch = subject.course_code.match(/(\d)0\d/);
      if (codeMatch) {
        semester = parseInt(codeMatch[1]);
      }

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

    // Filter subjects by semester and convert to SubjectData format
    const semesterSubjects: SubjectData[] = subjects
      .map((subject) => {
        // Extract semester from course code pattern (e.g., CS301 -> semester 3)
        let detectedSemester = 5; // default
        const codeMatch = subject.course_code.match(/(\d)0\d/);
        if (codeMatch) {
          detectedSemester = parseInt(codeMatch[1]);
        }

        return {
          courseCode: subject.course_code,
          courseTitle: subject.title,
          semester: detectedSemester,
          sectionsCount: 3, // Default assumption, could be enhanced with actual data
          totalStudents: subject.total_students,
          totalGrievances: subject.grievances,
        };
      })
      .filter((s) => s.semester === semester);

    return semesterSubjects;
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
    const sectionStatistics: SectionStatistics[] = sections.map((section: any) => ({
      sectionName: section.section_name || `Section ${String.fromCharCode(65 + sections.indexOf(section))}`,
      totalStudents: section.total_students || 0,
      checkingProgress: section.checked || 0,
      markingProgress: section.checked || 0, // reusing checked as marking progress
      pendingProgress: section.pending || 0,
      grievanceCount: grievanceMap.get(section.section_name) || section.grievances || 0,
      grievanceDetails: [],
    }));

    return sectionStatistics;
  } catch (error) {
    console.error("Error fetching section statistics:", error);
    throw new Error(`Failed to fetch section statistics for ${courseCode}`);
  }
}

