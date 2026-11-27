import { fileKind } from './file-kind';

describe('fileKind', () => {
  it('takes the type from the extension, in capitals, with its icon', () => {
    expect(fileKind({ name: 'Política de accesos.v2.PDF', type: '' })).toEqual({ label: 'PDF', icon: 'picture_as_pdf', image: false });
    expect(fileKind({ name: 'acta.docx', type: 'application/octet-stream' })).toEqual({ label: 'DOCX', icon: 'description', image: false });
    expect(fileKind({ name: 'inventario.xlsx', type: '' })).toEqual({ label: 'XLSX', icon: 'table_chart', image: false });
  });

  it('marks pictures as images, so they show a thumbnail', () => {
    expect(fileKind({ name: 'captura.png', type: 'image/png' }).image).toBeTrue();
    expect(fileKind({ name: 'foto.JPEG', type: '' })).toEqual({ label: 'JPEG', icon: 'image', image: true });
  });

  it('falls back to the MIME type without an extension, and to a generic file icon', () => {
    expect(fileKind({ name: 'captura', type: 'image/png' })).toEqual({ label: 'PNG', icon: 'image', image: true });
    expect(fileKind({ name: 'raro.xyz', type: '' })).toEqual({ label: 'XYZ', icon: 'draft', image: false });
    expect(fileKind({ name: '.oculto', type: '' })).toEqual({ label: '—', icon: 'draft', image: false });
  });
});
