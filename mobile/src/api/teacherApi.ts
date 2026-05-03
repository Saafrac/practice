import { env } from "../config/env";
import {
  TeacherGroupAnalyticsResponse,
  TeacherStudentReportResponse,
  TeacherStudentResultsResponse,
  TeacherStudentsResponse,
} from "../types/teacher";

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

export async function fetchTeacherStudents(token: string): Promise<TeacherStudentsResponse> {
  return authedRequest<TeacherStudentsResponse>(token, "/teacher/students", { method: "GET" });
}

export async function fetchTeacherStudentResults(
  token: string,
  studentId: number,
): Promise<TeacherStudentResultsResponse> {
  return authedRequest<TeacherStudentResultsResponse>(token, `/teacher/students/${studentId}/results`, {
    method: "GET",
  });
}

export async function fetchTeacherStudentReport(
  token: string,
  studentId: number,
): Promise<TeacherStudentReportResponse> {
  return authedRequest<TeacherStudentReportResponse>(token, `/teacher/students/${studentId}/report`, {
    method: "GET",
  });
}

export async function fetchTeacherGroupAnalytics(token: string): Promise<TeacherGroupAnalyticsResponse> {
  return authedRequest<TeacherGroupAnalyticsResponse>(token, "/teacher/group-analytics", { method: "GET" });
}
