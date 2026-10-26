import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SidePanel } from '../side-panel/side-panel';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let component: ConfirmDialog;
  let confirmed: number;
  let cancelled: number;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialog], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ConfirmDialog);
    component = fixture.componentInstance;
    confirmed = 0;
    cancelled = 0;
    component.confirmed.subscribe(() => confirmed++);
    component.cancelled.subscribe(() => cancelled++);
    fixture.componentRef.setInput('titleKey', 'TEST.TITLE');
    fixture.componentRef.setInput('messageKey', 'TEST.MESSAGE');
    fixture.detectChanges();
  });

  it('is an alert dialog labelled by its title and described by its message', () => {
    const dialog = el().querySelector('[role="alertdialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(el().querySelector('#' + dialog.getAttribute('aria-labelledby'))!.textContent).toContain('TEST.TITLE');
    expect(el().querySelector('#' + dialog.getAttribute('aria-describedby'))!.textContent).toContain('TEST.MESSAGE');
  });

  it('confirms and cancels with the buttons', () => {
    const [cancel, confirm] = buttons();
    cancel.click();
    confirm.click();
    expect(cancelled).toBe(1);
    expect(confirmed).toBe(1);
  });

  it('cancels with Escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(1);
  });

  it('cancels when clicking outside the dialog, not inside it', () => {
    (el().querySelector('[role="alertdialog"]') as HTMLElement).click();
    expect(cancelled).toBe(0);
    (el().firstElementChild as HTMLElement).click();
    expect(cancelled).toBe(1);
  });

  it('puts the focus on «Cancelar», the safe option', async () => {
    await fixture.whenStable();
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('ignores everything while the action is running', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    buttons().forEach((b) => expect(b.disabled).toBeTrue());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(0);
  });

  it('sits above the side panel it is opened from, so its buttons are never hidden behind it', () => {
    const panel = TestBed.createComponent(SidePanel);
    panel.componentRef.setInput('titleKey', 'TEST.PANEL');
    panel.detectChanges();
    const topLayer = (root: HTMLElement) =>
      Math.max(...Array.from(root.querySelectorAll('[class*="z-["]')).map((e) => Number(/z-\[(\d+)\]/.exec(e.className)![1])));
    expect(topLayer(el())).toBeGreaterThan(topLayer(panel.nativeElement));
  });

  it('paints the confirm button red for a dangerous action', () => {
    fixture.componentRef.setInput('tone', 'danger');
    fixture.detectChanges();
    expect(buttons()[1].className).toContain('bg-error-600');
  });
});
