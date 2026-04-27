import { env } from "../config/env";
import { StudentHistoryResponse } from "../types/student";

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

  return (await response.json()) as T;
}

export async function fetchStudentHistory(token: string): Promise<StudentHistoryResponse> {
  return authedRequest<StudentHistoryResponse>(token, "/student/history", { method: "GET" });
}
