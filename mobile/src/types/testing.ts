export type TestType = "diagnostic" | "adaptive" | "final";

export type TestQuestionOption = {
  id: number;
  text: string;
};

export type TestQuestion = {
  id: number;
  text: string;
  topic: string;
  difficulty: number;
  options: TestQuestionOption[];
};

export type StartDiagnosticResponse = {
  attempt_id: number;
  test_id: number;
  test_title: string;
  test_type: TestType;
  max_questions: number;
};

export type NextQuestionResponse = {
  attempt_id: number;
  test_type: TestType;
  answered_questions: number;
  max_questions: number;
  is_finished: boolean;
  current_theta: number;
  question: TestQuestion | null;
};

export type SubmitAnswerPayload = {
  question_id: number;
  selected_option_id: number;
};

export type SubmitAnswerResponse = {
  attempt_id: number;
  test_type: TestType;
  is_correct: boolean;
  answered_questions: number;
  max_questions: number;
  is_finished: boolean;
  theta_before: number;
  theta_after: number;
};

export type ErrorProfileItem = {
  topic: string;
  total_questions: number;
  wrong_answers: number;
  accuracy_percent: number;
};

export type RecommendationCardItem = {
  category: string;
  reason: string;
  suggested_activity: string;
  estimated_time: string;
  priority: "High" | "Medium" | "Low" | string;
  source?: string;
};

export type AttemptResultResponse = {
  attempt_id: number;
  test_type: TestType;
  started_at: string;
  finished_at: string;
  score_percent: number;
  level_result: string;
  cefr: string;
  theta_final: number;
  total_questions: number;
  correct_answers: number;
  previous_score_percent: number | null;
  score_delta: number | null;
  previous_theta_final: number | null;
  theta_delta: number | null;
  insight: string;
  weak_topics: string[];
  recommendations: string[];
  recommendation_cards?: RecommendationCardItem[];
  error_profile?: ErrorProfileItem[];
};
