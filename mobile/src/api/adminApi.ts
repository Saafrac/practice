import { env } from "../config/env";
import {
  AdminQuestionItem,
  AdminQuestionUpsertPayload,
  AdminQuestionsResponse,
  AdminRole,
  AdminUserItem,
  AdminUsersResponse,
} from "../types/admin";

async function authedRequest<T>(token: string, path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim().length > 0) {
        message = data.detail;
      }
    } catch {
      message = "Network or server error";
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchAdminUsers(token: string): Promise<AdminUsersResponse> {
  return authedRequest<AdminUsersResponse>(token, "/admin/users", { method: "GET" });
}

export async function updateAdminUserRole(
  token: string,
  userId: number,
  role: AdminRole,
): Promise<AdminUserItem> {
  return authedRequest<AdminUserItem>(token, `/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function fetchAdminQuestions(
  token: string,
  filters?: { difficulty?: number; topic?: string },
): Promise<AdminQuestionsResponse> {
  const params = new URLSearchParams();
  if (typeof filters?.difficulty === "number") {
    params.set("difficulty", String(filters.difficulty));
  }
  if (filters?.topic && filters.topic.trim()) {
    params.set("topic", filters.topic.trim());
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return authedRequest<AdminQuestionsResponse>(token, `/admin/questions${query}`, { method: "GET" });
}

export async function createAdminQuestion(
  token: string,
  payload: AdminQuestionUpsertPayload,
): Promise<AdminQuestionItem> {
  return authedRequest<AdminQuestionItem>(token, "/admin/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminQuestion(
  token: string,
  questionId: number,
  payload: AdminQuestionUpsertPayload,
): Promise<AdminQuestionItem> {
  return authedRequest<AdminQuestionItem>(token, `/admin/questions/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminQuestion(token: string, questionId: number): Promise<void> {
  await authedRequest<void>(token, `/admin/questions/${questionId}`, { method: "DELETE" });
}
