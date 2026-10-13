import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { FileProblem } from '@shared/domain/utils/file-validation';
import { FileUpload } from './file-upload';

describe('FileUpload', () => {
  let fixture: ComponentFixture<FileUpload>;
  let component: FileUpload;
  let rejected: FileProblem[];
  const el = () => fixture.nativeElement as HTMLElement;

  const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name);
  const choose = (f: File) => {
    const input = el().querySelector('input[type="file"]') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(f);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUpload], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(FileUpload);
    component = fixture.componentInstance;
    rejected = [];
    fixture.componentRef.setInput('accept', ['.pdf', '.docx']);
    fixture.componentRef.setInput('maxBytes', 1024);
    component.rejected.subscribe((p) => rejected.push(p));
    fixture.detectChanges();
  });

  it('is a real file input restricted to the allowed types (keyboard friendly)', () => {
    const input = el().querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.docx');
    expect(el().querySelector('label[for]')).not.toBeNull();
  });

  it('accepts a valid file and shows it', () => {
    choose(file('politica.pdf', 100));
    expect(component.file()?.name).toBe('politica.pdf');
    expect(el().querySelector('[data-testid="file-chosen"]')!.textContent).toContain('politica.pdf');
    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a clear error for a type that is not allowed and keeps no file', () => {
    choose(file('foto.png', 100));
    expect(component.file()).toBeNull();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('COMMON.FILE.ERROR_TYPE');
    expect(rejected[0].key).toBe('COMMON.FILE.ERROR_TYPE');
  });

  it('shows a clear error for a file over the size limit', () => {
    choose(file('grande.pdf', 2048));
    expect(component.file()).toBeNull();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('COMMON.FILE.ERROR_SIZE');
  });

  it('lets the user remove the chosen file', () => {
    choose(file('politica.pdf', 100));
    (el().querySelector('[data-testid="file-chosen"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.file()).toBeNull();
    expect(el().querySelector('input[type="file"]')).not.toBeNull();
  });

  it('shows an error that comes from outside (for example the server)', () => {
    fixture.componentRef.setInput('externalError', 'No se pudo subir');
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('No se pudo subir');
  });
});
