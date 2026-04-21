export type TeacherStudentItem = {
  id: number;
  full_name: string;
  email: string;
  attempts_count: number;
  average_score: number;
  last_level: string | null;
};

export type TeacherStudentsResponse = {
  students: TeacherStudentItem[];
};

export type TeacherStudentResultItem = {
  attempt_id: number;
  test_type: "diagnostic" | "adaptive" | "final";
  finished_at: string;
  score_percent: number;
  level_result: string;
  theta_final: number;
};

export type TeacherStudentResultsResponse = {
  student_id: number;
  student_name: string;
  results: TeacherStudentResultItem[];
};

export type TeacherWeakTopicItem = {
  topic: string;
  total_questions: number;
  wrong_answers: number;
  accuracy_percent: number;
};

export type TeacherGroupAnalyticsResponse = {
  students_count: number;
  total_attempts: number;
  average_score: number;
  weak_topics: TeacherWeakTopicItem[];
};
