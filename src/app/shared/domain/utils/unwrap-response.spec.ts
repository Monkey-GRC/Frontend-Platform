import { of, lastValueFrom } from 'rxjs';
import { MissingResponseDataError, requireData, unwrapData } from './unwrap-response';

describe('unwrapData', () => {
  it('devuelve el contenido de data', async () => {
    const value = await lastValueFrom(of({ message: 'ok', statusCode: 200, data: { id: 1 } }).pipe(unwrapData()));
    expect(value).toEqual({ id: 1 });
  });

  it('conserva valores falsos válidos como 0 o la lista vacía', () => {
    expect(requireData({ message: 'ok', statusCode: 200, data: 0 })).toBe(0);
    expect(requireData({ message: 'ok', statusCode: 200, data: [] })).toEqual([]);
  });

  it('lanza un error tipado si data falta', () => {
    expect(() => requireData({ message: 'ok', statusCode: 200 })).toThrowError(MissingResponseDataError);
    expect(() => requireData({ message: 'ok', statusCode: 200, data: undefined })).toThrowError(MissingResponseDataError);
  });

  it('el error llega por el canal de error del observable', async () => {
    await expectAsync(lastValueFrom(of({ message: 'ok', statusCode: 200 }).pipe(unwrapData()))).toBeRejectedWith(jasmine.any(MissingResponseDataError));
  });
});
