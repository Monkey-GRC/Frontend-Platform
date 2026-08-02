export interface SuccessResponse<T = unknown> {
  message: string;
  statusCode: number;
  data?: T;
}

export interface ErrorResponse {
  message: string;
  statusCode: number;
  error?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
