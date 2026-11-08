import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ComingSoonView } from './coming-soon';

describe('ComingSoonView', () => {
  function render(data: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({ imports: [ComingSoonView], providers: [provideTranslateService(), { provide: ActivatedRoute, useValue: { data: of(data) } }] });
    const fixture = TestBed.createComponent(ComingSoonView);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the title and icon the route brings, and says the section is under construction', () => {
    const el = render({ titleKey: 'SHELL.NAV.MY_WORK', icon: 'assignment_ind' });
    expect(el.textContent).toContain('SHELL.NAV.MY_WORK');
    expect(el.textContent).toContain('SHELL.COMING_SOON');
    expect(el.textContent).toContain('assignment_ind');
  });
});
