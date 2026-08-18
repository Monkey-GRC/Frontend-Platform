import { OperatorFunction, map } from 'rxjs';
import { ApiResponse, SuccessResponse } from '../models/api-response.model';

export function unwrapData<T>(): OperatorFunction<ApiResponse<T>, T> {
  return map((response) => (response as SuccessResponse<T>).data as T);
}
