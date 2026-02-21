/**
 * Controller Statistics Service
 * Handles fetching institution-wide statistics organized by semester, subject, and section
 */

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

/**
 * Fetch all semesters with their statistics
 */
export async function fetchAllSemesters(): Promise<SemesterData[]> {
  try {
    // This would aggregate data from courses grouped by semester
    const response = await fetch("/api/stats/semesters/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch semesters: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching semesters:", error);
    // Return mock semesters if API not available
    return generateMockSemesters();
  }
}

/**
 * Fetch all subjects (courses) for a specific semester
 */
export async function fetchSubjectsBySemester(semester: number): Promise<SubjectData[]> {
  try {
    const response = await fetch(`/api/stats/semesters/${semester}/subjects/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subjects: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching subjects:", error);
    // Return mock subjects if API not available
    return generateMockSubjects(semester);
  }
}

/**
 * Fetch section statistics for a specific course/subject
 */
export async function fetchSectionsByCourse(courseCode: string): Promise<SectionStatistics[]> {
  try {
    const [grievanceData, scoresData] = await Promise.all([
      fetchGrievanceStats(courseCode),
      fetchScoresData(courseCode),
    ]);

    return aggregateSectionStats(grievanceData, scoresData);
  } catch (error) {
    console.error("Error fetching section statistics:", error);
    return generateMockSections();
  }
}

/**
 * Fetch grievance statistics for a course
 * Returns data grouped by section
 */
async function fetchGrievanceStats(courseCode: string) {
  const response = await fetch(`/api/stats/grievances/?course_code=${courseCode}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch grievance stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch scores data for a course
 */
async function fetchScoresData(courseCode: string) {
  const response = await fetch(`/api/stats/scores/?course_code=${courseCode}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scores data: ${response.statusText}`);
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
      const section = item.label || "Unknown Section";
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
    return generateMockSections();
  }

  return Array.from(sectionMap.values());
}

/**
 * Generate mock semesters data
 */
function generateMockSemesters(): SemesterData[] {
  return [
    { semester: 1, totalCourses: 5, totalStudents: 300, subjectsCount: 5 },
    { semester: 2, totalCourses: 5, totalStudents: 280, subjectsCount: 5 },
    { semester: 3, totalCourses: 6, totalStudents: 270, subjectsCount: 6 },
    { semester: 4, totalCourses: 6, totalStudents: 265, subjectsCount: 6 },
    { semester: 5, totalCourses: 6, totalStudents: 250, subjectsCount: 6 },
    { semester: 6, totalCourses: 6, totalStudents: 240, subjectsCount: 6 },
    { semester: 7, totalCourses: 5, totalStudents: 200, subjectsCount: 5 },
    { semester: 8, totalCourses: 5, totalStudents: 195, subjectsCount: 5 },
  ];
}

/**
 * Generate mock subjects data for a semester
 */
function generateMockSubjects(semester: number): SubjectData[] {
  const mockSubjects: SubjectData[] = [
    {
      courseCode: `CS${semester}01`,
      courseTitle: "Data Structures",
      semester: semester,
      sectionsCount: 3,
      totalStudents: 90,
      totalGrievances: 3,
    },
    {
      courseCode: `CS${semester}02`,
      courseTitle: "Algorithms",
      semester: semester,
      sectionsCount: 3,
      totalStudents: 87,
      totalGrievances: 2,
    },
    {
      courseCode: `CS${semester}03`,
      courseTitle: "Database Management",
      semester: semester,
      sectionsCount: 3,
      totalStudents: 85,
      totalGrievances: 5,
    },
    {
      courseCode: `CS${semester}04`,
      courseTitle: "Operating Systems",
      semester: semester,
      sectionsCount: 3,
      totalStudents: 88,
      totalGrievances: 1,
    },
    {
      courseCode: `CS${semester}05`,
      courseTitle: "Computer Networks",
      semester: semester,
      sectionsCount: 3,
      totalStudents: 86,
      totalGrievances: 4,
    },
  ];

  if (semester > 6) {
    mockSubjects.pop();
  }

  return mockSubjects;
}

/**
 * Generate mock sections data
 */
function generateMockSections(): SectionStatistics[] {
  return [
    {
      sectionName: "Section A",
      totalStudents: 60,
      checkingProgress: 45,
      markingProgress: 30,
      pendingProgress: 15,
      grievanceCount: 3,
      grievanceDetails: [
        {
          studentId: "STU001",
          studentName: "Aarav Kumar",
          grievanceType: "Marking Error",
          rollNo: "001",
        },
        {
          studentId: "STU002",
          studentName: "Priya Singh",
          grievanceType: "Question Clarity",
          rollNo: "002",
        },
        {
          studentId: "STU003",
          studentName: "Ravi Sharma",
          grievanceType: "Answer Verification",
          rollNo: "003",
        },
      ],
    },
    {
      sectionName: "Section B",
      totalStudents: 55,
      checkingProgress: 40,
      markingProgress: 25,
      pendingProgress: 15,
      grievanceCount: 2,
      grievanceDetails: [
        {
          studentId: "STU101",
          studentName: "Neha Patel",
          grievanceType: "Calculation Error",
          rollNo: "004",
        },
        {
          studentId: "STU102",
          studentName: "Arjun Verma",
          grievanceType: "Marking Mismatch",
          rollNo: "005",
        },
      ],
    },
    {
      sectionName: "Section C",
      totalStudents: 58,
      checkingProgress: 50,
      markingProgress: 40,
      pendingProgress: 8,
      grievanceCount: 5,
      grievanceDetails: [
        {
          studentId: "STU201",
          studentName: "Divya Sharma",
          grievanceType: "Evaluation Error",
          rollNo: "006",
        },
        {
          studentId: "STU202",
          studentName: "Rohan Gupta",
          grievanceType: "Marking Appeal",
          rollNo: "007",
        },
        {
          studentId: "STU203",
          studentName: "Sakshi Verma",
          grievanceType: "Score Mismatch",
          rollNo: "008",
        },
        {
          studentId: "STU204",
          studentName: "Karan Singh",
          grievanceType: "Answer Review",
          rollNo: "009",
        },
        {
          studentId: "STU205",
          studentName: "Anjali Kumari",
          grievanceType: "Calculation Error",
          rollNo: "010",
        },
      ],
    },
  ];
}
