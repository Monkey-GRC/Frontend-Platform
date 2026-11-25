import { apiErrorCode, apiFieldErrors } from '@core/domain/utils/api-error';

/**
 * La clave i18n del mensaje de un error de asignar (409 y 422 con su código; contracts/gestion-usuarios.md). Un error que no tiene mensaje propio devuelve `null` y quien
 * llama usa el mensaje que ya trae la respuesta o uno genérico.
 */
export function assignmentErrorKey(error: unknown): string | null {
  switch (apiErrorCode(error)) {
    case 'OWNER_NOT_ELIGIBLE': return 'ASSIGNMENT.ERROR.OWNER_NOT_ELIGIBLE';
    case 'EXECUTOR_NOT_IN_TEAM': return 'ASSIGNMENT.ERROR.EXECUTOR_NOT_IN_TEAM';
    case 'CONTROL_RETIRED': return 'ASSIGNMENT.ERROR.CONTROL_RETIRED';
    case 'VALIDATION_FAILED': return apiFieldErrors(error).some((f) => f.code.startsWith('array.')) ? 'ASSIGNMENT.ERROR.BATCH_SIZE' : null;
    default: return null;
  }
}
