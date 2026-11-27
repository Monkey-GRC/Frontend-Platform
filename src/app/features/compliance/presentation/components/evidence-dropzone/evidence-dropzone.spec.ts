import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { EvidenceDropzone } from './evidence-dropzone';

describe('EvidenceDropzone (MD-505: choose, preview, upload)', () => {
  let fixture: ComponentFixture<EvidenceDropzone>;
  let uploads: File[];
  let chosen: (File | null)[];
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => el().querySelector<HTMLElement>(selector);

  function setup(): void {
    TestBed.configureTestingModule({ imports: [EvidenceDropzone], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(EvidenceDropzone);
    fixture.componentRef.setInput('accept', ['.pdf', '.png']);
    fixture.componentRef.setInput('maxBytes', 1024);
    uploads = [];
    chosen = [];
    fixture.componentInstance.upload.subscribe((f) => uploads.push(f));
    fixture.componentInstance.chosen.subscribe((f) => chosen.push(f));
    fixture.detectChanges();
  }

  function set(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  function choose(file: File): void {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = el().querySelector<HTMLInputElement>('input[type="file"]')!;
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('checks type and size before the preview: a wrong file never reaches it', () => {
    setup();
    choose(new File(['x'], 'raro.exe'));
    expect(q('[data-file-preview]')).toBeNull();
    expect(q('[data-problem]')!.textContent).toContain('COMMON.FILE.ERROR_TYPE');
    const big = new File(['x'], 'grande.pdf');
    Object.defineProperty(big, 'size', { value: 4096 });
    choose(big);
    expect(q('[data-file-preview]')).toBeNull();
    expect(q('[data-problem]')!.textContent).toContain('COMMON.FILE.ERROR_SIZE');
    expect(chosen).toEqual([]);
  });

  it('a valid file opens its preview and is only sent with «Subir»', () => {
    setup();
    const file = new File(['abc'], 'acta.pdf', { type: 'application/pdf' });
    choose(file);
    expect(chosen).toEqual([file]);
    expect(uploads).toEqual([]);
    expect(q('[data-file-meta]')!.textContent).toContain('PDF');
    q('[data-upload-file]')!.click();
    expect(uploads).toEqual([file]);
  });

  it('shows the real percent while uploading, and an animated bar (never a full still one) once the bytes are sent or without a total', () => {
    setup();
    choose(new File(['abc'], 'acta.pdf'));
    set('busy', true);
    set('percent', 30);
    expect(q('app-progress-line')!.getAttribute('data-value')).toBe('30');
    expect(q('[data-upload-indeterminate]')).toBeNull();
    set('percent', 100);
    expect(q('[data-upload-indeterminate]')).not.toBeNull();
    expect(q('[data-upload-state]')!.textContent).toContain('COMPLIANCE.EVIDENCE.PROCESSING');
    set('percent', null);
    expect(q('[data-upload-indeterminate]')).not.toBeNull();
    expect(q('[data-upload-state]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOADING');
    expect(q('[data-remove-file]')).toBeNull();
  });

  it('an error keeps the preview with the message and «Reintentar»; success closes it and says so', () => {
    setup();
    choose(new File(['abc'], 'acta.pdf'));
    set('message', 'No se pudo subir');
    set('messageTone', 'error');
    expect(q('[data-file-preview] [data-message]')!.textContent).toContain('No se pudo subir');
    expect(q('[data-upload-file]')!.textContent).toContain('COMMON.RETRY');
    set('messageTone', 'success');
    set('message', 'Subido: acta.pdf');
    expect(q('[data-file-preview]')).toBeNull();
    expect(q('[data-dropzone]')).not.toBeNull();
    expect(q('[data-message][data-tone="success"]')!.textContent).toContain('Subido: acta.pdf');
  });

  it('«Quitar» goes back to the empty zone and tells the owner', () => {
    setup();
    choose(new File(['abc'], 'acta.pdf'));
    q('[data-remove-file]')!.click();
    fixture.detectChanges();
    expect(q('[data-file-preview]')).toBeNull();
    expect(chosen[chosen.length - 1]).toBeNull();
  });
});
