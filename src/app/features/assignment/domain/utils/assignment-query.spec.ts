import { convertToParamMap } from '@angular/router';
import { assignmentQueryParams, hasActiveFilters, parseAssignmentQuery } from './assignment-query';

describe('assignment-query', () => {
  it('reads the service and the filters of the link (the one the notification builds)', () => {
    const view = parseAssignmentQuery(convertToParamMap({ servicio: 's-1', asignacion: 'unassigned' }));
    expect(view).toEqual({ serviceId: 's-1', assignment: 'unassigned', ownerId: null, executorId: null, status: null, q: '' });
    expect(hasActiveFilters(view)).toBeTrue();
  });

  it('ignores a value that is not in the list instead of breaking the screen', () => {
    const view = parseAssignmentQuery(convertToParamMap({ asignacion: 'sin_asignar', estado: 'otro' }));
    expect(view.assignment).toBeNull();
    expect(view.status).toBeNull();
    expect(hasActiveFilters(view)).toBeFalse();
  });

  it('reads owner, delegate, status and search', () => {
    const view = parseAssignmentQuery(convertToParamMap({ dueno: 'u-1', delegado: 'u-2', estado: 'expired', q: ' CC6 ' }));
    expect(view).toEqual({ serviceId: null, assignment: null, ownerId: 'u-1', executorId: 'u-2', status: 'expired', q: 'CC6' });
  });

  it('writes the empty ones as null so that the navigation removes them from the address', () => {
    const params = assignmentQueryParams({ serviceId: 's-1', assignment: null, ownerId: null, executorId: null, status: 'effective', q: '  ' });
    expect(params).toEqual({ servicio: 's-1', asignacion: null, dueno: null, delegado: null, estado: 'effective', q: null });
  });
});
