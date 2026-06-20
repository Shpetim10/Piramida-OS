import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "../auth/guards";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: 400 | 401 | 403 | 404 | 409 | 500 = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) return apiError(err.message, err.status);
  if (err instanceof ZodError) return apiError(err.issues[0]?.message ?? "Invalid input", 400);
  console.error("[API error]", err);
  return apiError("Internal server error", 500);
}
