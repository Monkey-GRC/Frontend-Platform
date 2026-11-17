import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { ConnectionOptionCard } from './connection-option-card';

const OPTION: ConnectionOption = { value: 'cloud_shell', label: 'Con Cloud Shell', description: 'Pegas un comando.', availability: 'available', tags: ['recommended', 'fastest'] };

describe('ConnectionOptionCard', () => {
  let fixture: ComponentFixture<ConnectionOptionCard>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;
  const icon = () => (fixture.nativeElement as HTMLElement).querySelector('.material-symbols-rounded')!.textContent!.trim();

  function create(option: ConnectionOption): void {
    fixture.componentRef.setInput('option', option);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConnectionOptionCard], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ConnectionOptionCard);
  });

  it('shows the label, the description and the tags of the option, and reports its value when picked', () => {
    create(OPTION);
    const picked: string[] = [];
    fixture.componentInstance.picked.subscribe((v) => picked.push(v));
    const text = button().textContent!;
    expect(text).toContain('Con Cloud Shell');
    expect(text).toContain('Pegas un comando.');
    expect(text).toContain('TAG_RECOMMENDED');
    expect(text).toContain('TAG_FASTEST');
    expect(button().getAttribute('role')).toBe('radio');
    expect(button().getAttribute('aria-checked')).toBe('false');
    button().click();
    expect(picked).toEqual(['cloud_shell']);
  });

  it('a coming_soon one says «Próximamente» in words, is announced as disabled, hides its tags and cannot be picked', () => {
    create({ ...OPTION, value: 'terraform', availability: 'coming_soon', tags: ['advanced'] });
    let picked = 0;
    fixture.componentInstance.picked.subscribe(() => picked++);
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().textContent).toContain('WIZARD.SOON');
    expect(button().textContent).not.toContain('TAG_ADVANCED');
    button().click();
    expect(picked).toBe(0);
  });

  it('draws the icon of a known value and a generic one for a value it does not know', () => {
    create(OPTION);
    expect(icon()).toBe('terminal');
    fixture.componentRef.setInput('option', { ...OPTION, value: 'something_new' });
    fixture.detectChanges();
    expect(icon()).toBe('tune');
  });
});
