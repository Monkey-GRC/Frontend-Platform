import { HttpErrorResponse } from '@angular/common/http';
import { assignmentErrorKey } from './assignment-errors';

const failure = (status: number, code: string, fields: { field: string; code: string; message: string }[] = []) =>
  new HttpErrorResponse({ status, error: { statusCode: status, message: 'x', data: null, error: { code, ...(fields.length ? { fields } : {}) } } });

describe('assignmentErrorKey', () => {
  it('has its own message for the 409 of the contract', () => {
    expect(assignmentErrorKey(failure(409, 'OWNER_NOT_ELIGIBLE'))).toBe('ASSIGNMENT.ERROR.OWNER_NOT_ELIGIBLE');
    expect(assignmentErrorKey(failure(409, 'EXECUTOR_NOT_IN_TEAM'))).toBe('ASSIGNMENT.ERROR.EXECUTOR_NOT_IN_TEAM');
    expect(assignmentErrorKey(failure(409, 'CONTROL_RETIRED'))).toBe('ASSIGNMENT.ERROR.CONTROL_RETIRED');
  });

  it('explains a 422 about the size of the batch, and leaves the rest to the message of the response', () => {
    expect(assignmentErrorKey(failure(422, 'VALIDATION_FAILED', [{ field: 'client_control_ids', code: 'array.max', message: 'm' }]))).toBe('ASSIGNMENT.ERROR.BATCH_SIZE');
    expect(assignmentErrorKey(failure(422, 'VALIDATION_FAILED', [{ field: 'owner_id', code: 'required', message: 'm' }]))).toBeNull();
    expect(assignmentErrorKey(failure(403, 'FORBIDDEN'))).toBeNull();
    expect(assignmentErrorKey(new Error('x'))).toBeNull();
  });
});
