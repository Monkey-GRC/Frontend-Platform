import { HttpErrorResponse } from '@angular/common/http';

// Lee el sobre de error del backend (contracts/conventions.md): el `message` ya viene traducido y,
// en un 422, `error.fields` trae el problema de cada campo.
export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function apiFieldErrors(error: unknown): ApiFieldError[] {
  if (!(error instanceof HttpErrorResponse)) return [];
  const fields = error.error?.error?.fields;
  return Array.isArray(fields) ? fields : [];
}

export function apiErrorCode(error: unknown): string | null {
  return error instanceof HttpErrorResponse ? (error.error?.error?.code ?? null) : null;
}
