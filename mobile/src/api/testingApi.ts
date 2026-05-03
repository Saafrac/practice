import { env } from "../config/env";
import {
  AttemptResultResponse,
  NextQuestionResponse,
  StartDiagnosticResponse,
  SubmitAnswerPayload,
  SubmitAnswerResponse,
} from "../types/testing";

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

export async function startDiagnostic(token: string): Promise<StartDiagnosticResponse> {
  return authedRequest<StartDiagnosticResponse>(token, "/tests/diagnostic/start", {
    method: "POST",
  });
}

export async function startAdaptive(token: string): Promise<StartDiagnosticResponse> {
  return authedRequest<StartDiagnosticResponse>(token, "/tests/adaptive/start", {
    method: "POST",
  });
}

export async function startFinal(token: string): Promise<StartDiagnosticResponse> {
  return authedRequest<StartDiagnosticResponse>(token, "/tests/final/start", {
    method: "POST",
  });
}

export async function fetchNextQuestion(
  token: string,
  attemptId: number,
): Promise<NextQuestionResponse> {
  return authedRequest<NextQuestionResponse>(token, `/tests/${attemptId}/next-question`, {
    method: "GET",
  });
}

export async function submitAnswer(
  token: string,
  attemptId: number,
  payload: SubmitAnswerPayload,
): Promise<SubmitAnswerResponse> {
  return authedRequest<SubmitAnswerResponse>(token, `/tests/${attemptId}/answer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAttemptResult(
  token: string,
  attemptId: number,
): Promise<AttemptResultResponse> {
  return authedRequest<AttemptResultResponse>(token, `/tests/${attemptId}/result`, {
    method: "GET",
  });
}

