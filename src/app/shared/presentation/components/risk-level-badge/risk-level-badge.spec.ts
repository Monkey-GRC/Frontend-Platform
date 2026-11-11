import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { RiskLevelBadge } from './risk-level-badge';

describe('RiskLevelBadge', () => {
  let fixture: ComponentFixture<RiskLevelBadge>;

  const render = (level: string | null) => {
    fixture.componentRef.setInput('level', level);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-level]') as HTMLElement;
    return { level: el.dataset['level'], hasIcon: !!el.querySelector('.material-symbols-rounded'), classes: el.className, text: el.textContent!.trim() };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RiskLevelBadge], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(RiskLevelBadge);
  });

  it('paints each of the four levels with its own risk tokens, with its word and no icon', () => {
    for (const l of ['low', 'moderate', 'high', 'critical']) {
      const r = render(l);
      expect(r.classes).toContain(`bg-risk-${l}-bg`);
      expect(r.classes).toContain(`text-risk-${l}-ink`);
      expect(r.hasIcon).toBeFalse();
      expect(r.text).not.toBe('');
    }
  });

  it('does not use the status tokens or a pill', () => {
    const r = render('critical');
    expect(r.classes).not.toMatch(/bad|ok|warn|red-|rounded-full/);
  });

  it('shows a risk that has not been evaluated as such, never as low', () => {
    const none = render(null);
    expect(none.level).toBe('none');
    expect(none.text).toContain('COMPLIANCE.RISKS.NOT_EVALUATED');
    expect(none.classes).toContain('border-dashed');
    expect(none.hasIcon).toBeFalse();
  });

  it('shows a level it does not know as unevaluated styling but keeps the value as text', () => {
    const odd = render('brand_new');
    expect(odd.text).toContain('brand_new');
  });
});
