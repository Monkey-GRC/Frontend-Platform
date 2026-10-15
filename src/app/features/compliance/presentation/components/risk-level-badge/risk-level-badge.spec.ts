import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { RiskLevelBadge } from './risk-level-badge';

describe('RiskLevelBadge', () => {
  let fixture: ComponentFixture<RiskLevelBadge>;

  const render = (level: string | null) => {
    fixture.componentRef.setInput('level', level);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-level]') as HTMLElement;
    return { level: el.dataset['level'], icon: el.querySelector('.material-symbols-rounded')!.textContent!.trim(), classes: el.className, text: el.textContent!.trim() };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RiskLevelBadge], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(RiskLevelBadge);
  });

  it('gives each of the four levels its own icon', () => {
    const icons = ['low', 'moderate', 'high', 'critical'].map((l) => render(l).icon);
    expect(new Set(icons).size).toBe(4);
  });

  it('shows a risk that has not been evaluated as such, never as low', () => {
    const none = render(null);
    expect(none.level).toBe('none');
    expect(none.text).toContain('COMPLIANCE.RISKS.NOT_EVALUATED');
    expect(none.classes).toContain('border-dashed');
    expect(none.icon).not.toBe(render('low').icon);
  });

  it('shows a level it does not know as unevaluated styling but keeps the value as text', () => {
    const odd = render('brand_new');
    expect(odd.text).toContain('brand_new');
  });
});
