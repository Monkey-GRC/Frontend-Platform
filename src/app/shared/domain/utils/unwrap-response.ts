import { OperatorFunction, map } from 'rxjs';
import { SuccessResponse } from '@shared/domain/models/api-response.model';

export class MissingResponseDataError extends Error {
  constructor() {
    super('La respuesta del servidor no trae datos');
    this.name = 'MissingResponseDataError';
    Object.setPrototypeOf(this, MissingResponseDataError.prototype);
  }
}

export function requireData<T>(response: SuccessResponse<T>): T {
  if (response.data === undefined || response.data === null) throw new MissingResponseDataError();
  return response.data;
}

export function unwrapData<T>(): OperatorFunction<SuccessResponse<T>, T> {
  return map((response) => requireData(response));
}
