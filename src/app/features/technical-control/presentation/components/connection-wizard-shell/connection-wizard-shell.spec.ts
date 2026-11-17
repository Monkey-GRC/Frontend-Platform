import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { WizardLeaveService } from '@features/technical-control/domain/services/wizard-leave.service';
import { ConnectionWizardShell } from './connection-wizard-shell';

@Component({
  imports: [ConnectionWizardShell],
  template: `
    <app-connection-wizard-shell titleKey="T" [titleParams]="{ name: 'X' }" [steps]="steps" [current]="2" [showBack]="showBack()" [nextDisabled]="disabled()" [busy]="busy()" [leaveMode]="leaveMode()" nextLabelKey="N"
      (closed)="events.push('closed')" (back)="events.push('back')" (next)="events.push('next')">
      <p data-body>cuerpo</p>
    </app-connection-wizard-shell>
  `,
})
class Host {
  readonly steps = [{ icon: 'a', label: 'A' }, { icon: 'b', label: 'B' }, { icon: 'c', label: 'C' }];
  readonly showBack = signal(true);
  readonly disabled = signal(false);
  readonly busy = signal(false);
  readonly leaveMode = signal<'none' | 'discard' | 'saved'>('none');
  readonly events: string[] = [];
}

describe('ConnectionWizardShell', () => {
  let fixture: ComponentFixture<Host>;
  const q = <T extends HTMLElement>(s: string) => (fixture.nativeElement as HTMLElement).querySelector(s) as T | null;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('is a full-screen frame: minimal header, centred horizontal stepper, content and fixed footer', () => {
    expect(q('[data-wizard-title]')!.textContent).toContain('T');
    expect(q('[data-wizard-steps] app-stepper li[aria-current="step"]')!.getAttribute('data-step')).toBe('1');
    expect(q('[data-wizard-content] [data-body]')).not.toBeNull();
    expect(q('[data-wizard-footer]')).not.toBeNull();
    expect(q('app-sidebar, app-header, app-breadcrumb')).toBeNull();
  });

  it('reports close, back and next without deciding anything', () => {
    q<HTMLButtonElement>('[data-wizard-close]')!.click();
    q<HTMLButtonElement>('[data-wizard-back]')!.click();
    q<HTMLButtonElement>('[data-wizard-next]')!.click();
    expect(fixture.componentInstance.events).toEqual(['closed', 'back', 'next']);
  });

  it('disables the main button when the step is not ready and both buttons while busy', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.disabled).toBe(true);
    fixture.componentInstance.disabled.set(false);
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.getAttribute('aria-disabled')).toBe('true');
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.getAttribute('aria-busy')).toBe('true');
    expect(q<HTMLButtonElement>('[data-wizard-back]')!.disabled).toBe(true);
  });

  it('hides «Atrás» on the first step', () => {
    fixture.componentInstance.showBack.set(false);
    fixture.detectChanges();
    expect(q('[data-wizard-back]')).toBeNull();
  });

  describe('leaving', () => {
    const leave = () => TestBed.inject(WizardLeaveService);
    const dialog = () => q('app-confirm-dialog');
    const buttons = () => Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('button'));

    it('passes its leave mode to the service and clears it when it is destroyed', () => {
      fixture.componentInstance.leaveMode.set('saved');
      fixture.detectChanges();
      expect(leave().mode()).toBe('saved');
      fixture.destroy();
      expect(leave().mode()).toBe('none');
    });

    it('asks nothing when there is nothing to lose', async () => {
      expect(await leave().request()).toBeTrue();
      expect(dialog()).toBeNull();
    });

    it('warns that what was typed is lost, with a destructive «Leave without saving», and stays on «Continue»', async () => {
      fixture.componentInstance.leaveMode.set('discard');
      fixture.detectChanges();
      const result = leave().request();
      fixture.detectChanges();
      expect(dialog()!.textContent).toContain('LEAVE.DISCARD');
      expect(dialog()!.textContent).not.toContain('LEAVE.SAVED');
      const [stay, exit] = buttons();
      expect(stay.textContent).toContain('LEAVE.STAY');
      expect(exit.textContent).toContain('LEAVE.EXIT_DISCARD');
      expect(exit.className).toContain('mk-btn-danger');
      stay.click();
      expect(await result).toBeFalse();
      fixture.detectChanges();
      expect(dialog()).toBeNull();
    });

    it('says the progress is saved, with a neutral «Leave», and leaves on it', async () => {
      fixture.componentInstance.leaveMode.set('saved');
      fixture.detectChanges();
      const result = leave().request();
      fixture.detectChanges();
      expect(dialog()!.textContent).toContain('LEAVE.SAVED');
      const exit = buttons()[1];
      expect(exit.textContent).toContain('LEAVE.EXIT');
      expect(exit.className).toContain('mk-btn-secondary');
      expect(exit.className).not.toContain('mk-btn-danger');
      exit.click();
      expect(await result).toBeTrue();
    });
  });
});
