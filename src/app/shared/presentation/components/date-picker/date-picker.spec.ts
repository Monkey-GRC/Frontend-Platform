import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { DatePicker } from './date-picker';

@Component({
  imports: [DatePicker],
  template: `<app-date-picker [(value)]="value" [min]="min()" [max]="max()" [disabled]="disabled()" />`,
})
class Host {
  value = signal('2026-11-15');
  min = signal<string | null>(null);
  max = signal<string | null>(null);
  disabled = signal(false);
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => root().querySelector(s) as T | null;
  const days = () => Array.from(root().querySelectorAll<HTMLButtonElement>('[data-day]'));
  const day = (iso: string) => root().querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)!;
  const open = () => { q<HTMLButtonElement>('[data-date-trigger]')!.click(); fixture.detectChanges(); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the chosen day written out, and a hint when there is none', () => {
    expect(q('[data-date-label]')!.textContent).toMatch(/15/);
    host.value.set('');
    fixture.detectChanges();
    expect(q('[data-date-label]')).toBeNull();
    expect(q('[data-date-placeholder]')).not.toBeNull();
  });

  it('opens a calendar on the month of the chosen day, six weeks long, Monday first', () => {
    open();
    expect(q('[data-date-popover]')).not.toBeNull();
    expect(days().length).toBe(42);
    expect(q('[data-date-month]')!.textContent).toMatch(/noviembre|november/i);
    expect(day('2026-11-15').getAttribute('aria-selected')).toBe('true');
    // noviembre de 2026 empieza en domingo: la primera casilla es el lunes 26 de octubre
    expect(days()[0].getAttribute('data-iso')).toBe('2026-10-26');
  });

  it('choosing a day sets the value and closes the calendar', () => {
    open();
    day('2026-11-20').click();
    fixture.detectChanges();
    expect(host.value()).toBe('2026-11-20');
    expect(q('[data-date-popover]')).toBeNull();
  });

  it('moves between months', () => {
    open();
    q<HTMLButtonElement>('[data-date-next]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-month]')!.textContent).toMatch(/diciembre|december/i);
    q<HTMLButtonElement>('[data-date-prev]')!.click();
    q<HTMLButtonElement>('[data-date-prev]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-month]')!.textContent).toMatch(/octubre|october/i);
  });

  it('days outside min and max cannot be chosen', () => {
    host.min.set('2026-11-10');
    host.max.set('2026-11-20');
    fixture.detectChanges();
    open();
    expect(day('2026-11-09').disabled).toBeTrue();
    expect(day('2026-11-21').disabled).toBeTrue();
    expect(day('2026-11-10').disabled).toBeFalse();
    day('2026-11-09').click();
    expect(host.value()).toBe('2026-11-15');
  });

  it('clearing empties the value', () => {
    open();
    q<HTMLButtonElement>('[data-date-clear]')!.click();
    fixture.detectChanges();
    expect(host.value()).toBe('');
  });

  it('«today» picks today, unless today is out of range', () => {
    const today = new Date().toISOString().slice(0, 10);
    open();
    q<HTMLButtonElement>('[data-date-today]')!.click();
    fixture.detectChanges();
    expect(host.value()).toBe(today);

    host.max.set('2000-01-01');
    fixture.detectChanges();
    open();
    expect(q<HTMLButtonElement>('[data-date-today]')!.disabled).toBeTrue();
  });

  it('closes with Escape and by touching outside, without changing the value', () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('[data-date-popover]')).toBeNull();
    open();
    q<HTMLElement>('[data-date-backdrop]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-popover]')).toBeNull();
    expect(host.value()).toBe('2026-11-15');
  });

  it('arrow keys move the day with the keyboard: ±1 day, ±1 week, and across months', () => {
    open();
    const popover = q<HTMLElement>('[data-date-popover]')!;
    const press = (key: string) => { popover.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); fixture.detectChanges(); };
    press('ArrowRight');
    expect(day('2026-11-16').getAttribute('tabindex')).toBe('0');
    press('ArrowDown');
    expect(day('2026-11-23').getAttribute('tabindex')).toBe('0');
    press('PageDown');
    expect(q('[data-date-month]')!.textContent).toMatch(/diciembre|december/i);
    expect(day('2026-12-23').getAttribute('tabindex')).toBe('0');
  });

  it('the title leads to the years, then the months, then the days: any year in three taps', () => {
    open();
    q<HTMLButtonElement>('[data-date-month]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-years]')).not.toBeNull();
    expect(q('[data-date-month]')!.textContent).toContain('2021'); // la página de 12 años alrededor de 2026
    q<HTMLButtonElement>('[data-year="2031"]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-months]')).not.toBeNull();
    expect(q('[data-date-month]')!.textContent).toContain('2031');
    q<HTMLButtonElement>('[data-month="2"]')!.click(); // marzo
    fixture.detectChanges();
    expect(q('[data-date-popover] [data-day]')).not.toBeNull();
    expect(day('2031-03-15')).not.toBeNull();
    day('2031-03-15').click();
    fixture.detectChanges();
    expect(host.value()).toBe('2031-03-15');
  });

  it('the arrows move a month, a year or a page of twelve years, depending on what is shown', () => {
    open();
    q<HTMLButtonElement>('[data-date-month]')!.click(); // años
    q<HTMLButtonElement>('[data-date-next]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-month]')!.textContent).toContain('2033');
    q<HTMLButtonElement>('[data-date-prev]')!.click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-year="2024"]')!.click(); // meses de 2024
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-date-next]')!.click();
    fixture.detectChanges();
    expect(q('[data-date-month]')!.textContent).toContain('2025');
  });

  it('years and months outside min and max cannot be chosen', () => {
    host.min.set('2025-06-01');
    host.max.set('2027-03-31');
    fixture.detectChanges();
    open();
    q<HTMLButtonElement>('[data-date-month]')!.click();
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-year="2024"]')!.disabled).toBeTrue();
    expect(q<HTMLButtonElement>('[data-year="2026"]')!.disabled).toBeFalse();
    expect(q<HTMLButtonElement>('[data-year="2028"]')!.disabled).toBeTrue();
    q<HTMLButtonElement>('[data-year="2027"]')!.click();
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-month="3"]')!.disabled).toBeTrue(); // mayo de 2027 queda fuera
    expect(q<HTMLButtonElement>('[data-month="2"]')!.disabled).toBeFalse(); // marzo, no
  });

  it('does not open when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    open();
    expect(q('[data-date-popover]')).toBeNull();
  });
});
