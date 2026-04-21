export type HistoryTrend = "up" | "down" | "stable";

export type StudentHistoryItem = {
  attempt_id: number;
  test_type: "diagnostic" | "adaptive" | "final";
  started_at: string;
  finished_at: string;
  score_percent: number;
  level_result: string;
  theta_final: number;
};

export type StudentHistorySummary = {
  total_attempts: number;
  average_score: number;
  best_score: number;
  trend: HistoryTrend;
};

export type StudentHistoryResponse = {
  summary: StudentHistorySummary;
  attempts: StudentHistoryItem[];
};
