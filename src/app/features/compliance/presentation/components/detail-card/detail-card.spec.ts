import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { DetailCard } from './detail-card';

@Component({
  selector: 'app-host',
  imports: [DetailCard],
  template: `
    <app-detail-card titleKey="COMPLIANCE.DETAIL.INTERPRETATION" [startOpen]="startOpen()" [forceOpen]="force()">
      <button actions type="button" data-action>Editar</button>
      <p data-body>contenido</p>
    </app-detail-card>
  `,
})
class Host {
  readonly startOpen = signal(true);
  readonly force = signal(false);
}

describe('DetailCard', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;
  const toggle = () => el().querySelector<HTMLButtonElement>('button[aria-expanded]')!;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('starts open, shows the projected actions and no decorative icon, and closes on click', () => {
    expect(el().querySelector('[data-body]')).not.toBeNull();
    expect(el().querySelector('[data-action]')).not.toBeNull();
    expect(el().querySelector('.rounded-full')).toBeNull();
    toggle().click();
    fixture.detectChanges();
    expect(el().querySelector('[data-body]')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('can start closed', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.startOpen.set(false);
    fixture.detectChanges();
    expect(el().querySelector('[data-body]')).toBeNull();
  });

  it('stays open while it is being edited', () => {
    toggle().click();
    fixture.componentInstance.force.set(true);
    fixture.detectChanges();
    expect(el().querySelector('[data-body]')).not.toBeNull();
    expect(toggle().disabled).toBeTrue();
  });
});
