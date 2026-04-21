export type AdminRole = "student" | "teacher" | "admin";

export type AdminUserItem = {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  created_at: string;
};

export type AdminUsersResponse = {
  users: AdminUserItem[];
};

export type AdminQuestionOption = {
  id: number;
  text: string;
  is_correct: boolean;
};

export type AdminQuestionItem = {
  id: number;
  text: string;
  question_type: string;
  difficulty: number;
  topic: string;
  explanation: string | null;
  created_at: string;
  options: AdminQuestionOption[];
};

export type AdminQuestionsResponse = {
  questions: AdminQuestionItem[];
};

export type AdminQuestionUpsertPayload = {
  text: string;
  difficulty: number;
  topic: string;
  explanation?: string | null;
  options: string[];
  correct_index: number;
};
