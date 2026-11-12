import { OperatorFunction, map } from 'rxjs';
import { SuccessResponse } from '@shared/domain/models/api-response.model';

export const MISSING_DATA_KEY = 'COMMON.ERRORS.MISSING_DATA';

// El mensaje es una clave i18n; se traduce al leerlo, con el idioma activo en ese momento (el traductor lo registra el LanguageService al arrancar).
let translateKey: (key: string) => string = (key) => key;
export function setMissingDataTranslator(translator: (key: string) => string): void {
  translateKey = translator;
}

export class MissingResponseDataError extends Error {
  readonly translationKey = MISSING_DATA_KEY;

  constructor() {
    super(MISSING_DATA_KEY);
    this.name = 'MissingResponseDataError';
    Object.defineProperty(this, 'message', { get: () => translateKey(MISSING_DATA_KEY), configurable: true });
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
