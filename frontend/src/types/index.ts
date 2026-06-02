// src/types/index.ts

export interface Student {
  id: number;
  hall_ticket: string;
  student_name: string;
  father_name: string | null;
  mother_name: string | null;
  program: string | null;
  created_at: string;
}

export interface Semester {
  id: number;
  student_id: number;
  semester_name: string;
  exam_month_year: string;
  sgpa: string | null;
  overall_result: string | null;
  results?: SemesterResult[];
}

export interface Subject {
  id: number;
  course_code: string;
  course_title: string;
  credits: number | null;
}

export interface SemesterResult {
  id: number;
  semester_id: number;
  subject_id: number;
  grade: string | null;
  subject_result: string | null;
  month_year: string | null;
  subject?: Subject;
}

export interface StudentProfile extends Student {
  semesters: (Semester & { results: (SemesterResult & { subject: Subject })[] })[];
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  error?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search & Filter types
export interface StudentSearchParams {
  q?: string;
  program?: string;
  semester?: string;
  page?: number;
  limit?: number;
  sortBy?: 'student_name' | 'hall_ticket' | 'program';
  sortOrder?: 'asc' | 'desc';
}

// Analytics types
export interface BranchStats {
  program: string;
  studentCount: number;
  avgSgpa: number;
  passPercentage: number;
  topSgpa: number;
}

export interface SemesterStats {
  semester_name: string;
  exam_month_year: string;
  totalStudents: number;
  passCount: number;
  failCount: number;
  promotedCount: number;
  avgSgpa: number;
  topSgpa: number;
}

export interface LeaderboardEntry {
  rank: number;
  student: Student;
  sgpa: number | null;
  semester_name?: string;
  exam_month_year?: string;
}

export interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
}

// Export types
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeCharts?: boolean;
  includeRankings?: boolean;
  studentIds?: number[];
  program?: string;
  semester?: string;
}