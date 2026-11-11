import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ConnectionProgress } from './connection-progress';

// Mientras se conecta la cuenta de la nube y se traen sus servidores (unos 6 minutos) se ve cuánto va, para saber que no se cayó. Es una estimación por tiempo y así se dice.
describe('ConnectionProgress', () => {
  let fixture: ComponentFixture<ConnectionProgress>;
  const q = <T extends HTMLElement>(s: string) => (fixture.nativeElement as HTMLElement).querySelector(s) as T | null;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConnectionProgress], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ConnectionProgress);
    fixture.detectChanges();
  });

  it('starts at 0 % with a bar that says the same, labelled as an estimate', () => {
    expect(fixture.componentInstance.percent()).toBe(0);
    expect(q('[data-percent]')!.textContent).toContain('0');
    expect(q('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('0');
    expect(fixture.nativeElement.textContent).toContain('PROGRESS.ESTIMATED');
  });

  it('says what step it is in and how long it has been', () => {
    expect(q('[data-stage]')!.textContent).toContain('CONNECT_PROGRESS.STAGE_ACCESS');
    expect(q('[data-elapsed]')!.textContent).toContain('PROGRESS.ELAPSED');
  });

  it('advances with time, never reaches 100 by itself and warns when it is slower than usual', fakeAsync(() => {
    // El componente se crea aquí dentro para que su reloj sea el simulado.
    fixture = TestBed.createComponent(ConnectionProgress);
    fixture.detectChanges();
    tick(150_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.percent()).toBeGreaterThan(40);
    expect(q('[data-slow]')).toBeNull();
    tick(900_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.percent()).toBeLessThanOrEqual(95);
    expect(q('[data-slow]')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('never names the provider of the scan engine', () => {
    expect((fixture.nativeElement.textContent as string).toLowerCase()).not.toContain('prowler');
  });
});
