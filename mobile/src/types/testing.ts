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

export type AttemptResultResponse = {
  attempt_id: number;
  started_at: string;
  finished_at: string;
  score_percent: number;
  level_result: string;
  theta_final: number;
  total_questions: number;
  correct_answers: number;
  insight: string;
  weak_topics: string[];
  recommendations: string[];
};
