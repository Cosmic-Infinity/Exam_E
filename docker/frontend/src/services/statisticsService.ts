/**
 * Statistics Service
 * Handles fetching section-wise evaluation statistics for course coordinators
 */

export interface SectionStatistics {
  sectionName: string;
  totalStudents: number;
  checkingProgress: number; // Papers in IN_PROGRESS status
  markingProgress: number;  // Papers in COMPLETED status
  pendingProgress: number;  // Papers in PENDING status
  grievanceCount: number;
  grievanceDetails: GrievanceDetail[];
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

/**
 * Fetch statistics for a specific course
 * Gathers data from multiple endpoints and aggregates it
 */
export async function fetchCourseStatistics(courseCode: string): Promise<CourseStatistics> {
  try {
    const [grievanceData, scoresData] = await Promise.all([
      fetchGrievanceStats(courseCode),
      fetchScoresData(courseCode),
    ]);

    return {
      courseCode: courseCode,
      courseTitle: extractCourseTitle(courseCode),
      sections: aggregateSectionStats(grievanceData, scoresData),
    };
  } catch (error) {
    console.error('Error fetching course statistics:', error);
    throw error;
  }
}

/**
 * Fetch grievance statistics for a course
 * Returns data grouped by section
 */
async function fetchGrievanceStats(courseCode: string) {
  const response = await fetch(`/api/stats/grievances/?course_code=${courseCode}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch grievance stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch students in various score ranges for a course
 * Helps determine checking and marking progress
 */
async function fetchScoresData(courseCode: string) {
  const response = await fetch(`/api/stats/scores/?course_code=${courseCode}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scores data: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch students in a specific score range
 * Useful for getting section details
 */
export async function fetchStudentsInRange(
  courseCode: string,
  minScore: number,
  maxScore: number
) {
  const response = await fetch(
    `/api/stats/students/?course_code=${courseCode}&min=${minScore}&max=${maxScore}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch students data: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Aggregate section statistics from multiple data sources
 */
function aggregateSectionStats(grievanceData: any, scoresData: any): SectionStatistics[] {
  const sectionMap = new Map<string, SectionStatistics>();

  // Initialize sections from grievance data
  if (grievanceData.chart_data && Array.isArray(grievanceData.chart_data)) {
    grievanceData.chart_data.forEach((item: any) => {
      const section = item.label || 'Unknown Section';
      if (!sectionMap.has(section)) {
        sectionMap.set(section, {
          sectionName: section,
          totalStudents: 0,
          checkingProgress: 0,
          markingProgress: 0,
          pendingProgress: 0,
          grievanceCount: item.count || 0,
          grievanceDetails: [],
        });
      }
    });
  }

  // If no sections found in grievance data, initialize with mock sections
  if (sectionMap.size === 0) {
    const defaultSections = ['Section A', 'Section B', 'Section C'];
    defaultSections.forEach((section) => {
      sectionMap.set(section, {
        sectionName: section,
        totalStudents: 0,
        checkingProgress: 0,
        markingProgress: 0,
        pendingProgress: 0,
        grievanceCount: 0,
        grievanceDetails: [],
      });
    });
  }

  return Array.from(sectionMap.values());
}

/**
 * Extract course title from course code (fallback)
 */
function extractCourseTitle(courseCode: string): string {
  return courseCode;
}

/**
 * Fetch all accessible courses for the coordinator
 */
export async function fetchAccessibleCourses() {
  try {
    const response = await fetch('/api/stats/dashboard/data/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch courses: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching accessible courses:', error);
    throw error;
  }
}
