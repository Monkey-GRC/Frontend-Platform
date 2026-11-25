import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { DetailCard } from './detail-card';

@Component({
  selector: 'app-host',
  imports: [DetailCard],
  template: `
    <app-detail-card titleKey="COMPLIANCE.DETAIL.INTERPRETATION" [count]="count()">
      <button actions type="button" data-action>Editar</button>
      <p data-body>contenido</p>
    </app-detail-card>
  `,
})
class Host {
  readonly count = signal<number | null>(null);
}

describe('DetailCard', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('is a section labelled by its title, with the actions at the right and the content always visible, without a box or a decorative icon', () => {
    const section = el().querySelector('section')!;
    expect(el().querySelector('#' + section.getAttribute('aria-labelledby'))!.textContent).toContain('COMPLIANCE.DETAIL.INTERPRETATION');
    expect(el().querySelector('[data-body]')).not.toBeNull();
    expect(el().querySelector('[data-action]')).not.toBeNull();
    expect(el().querySelector('.rounded-full')).toBeNull();
    expect(section.className).not.toContain('border ');
    expect(el().querySelector('[aria-expanded]')).toBeNull();
  });

  it('shows how many items it lists only when it is told', () => {
    expect(el().querySelector('[data-section-count]')).toBeNull();
    fixture.componentInstance.count.set(3);
    fixture.detectChanges();
    expect(el().querySelector('[data-section-count]')!.textContent).toBe('3');
  });
});
