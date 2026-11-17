import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { GCP_CONNECTION_SCOPE, GCP_SETUP_METHOD } from '@shared/testing/connection-options';
import { GcpChooseStep } from './gcp-choose-step';

describe('GcpChooseStep', () => {
  let fixture: ComponentFixture<GcpChooseStep>;
  const qa = (s: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(s));
  const card = (id: string) => qa(`[data-option="${id}"] button`)[0];

  function create(state: 'loading' | 'error' | 'ready'): void {
    TestBed.configureTestingModule({ imports: [GcpChooseStep], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(GcpChooseStep);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('scopes', GCP_CONNECTION_SCOPE);
    fixture.componentRef.setInput('methods', GCP_SETUP_METHOD);
    fixture.componentRef.setInput('scope', 'project');
    fixture.componentRef.setInput('method', 'cloud_shell');
    fixture.detectChanges();
  }

  it('builds its cards from the catalog: label and description of every option, in the order served', () => {
    create('ready');
    expect(qa('[data-scope-group] [data-option]').map((e) => e.getAttribute('data-option'))).toEqual(['project', 'organization']);
    expect(qa('[data-method-group] [data-option]').map((e) => e.getAttribute('data-option'))).toEqual(['cloud_shell', 'terraform']);
    expect(card('cloud_shell').textContent).toContain('Con Cloud Shell');
    expect(card('terraform').textContent).toContain('Aplicas una configuración');
  });

  it('has the available ones selected and the coming_soon ones locked with «Próximamente»', () => {
    create('ready');
    expect(card('project').getAttribute('aria-checked')).toBe('true');
    expect(card('cloud_shell').getAttribute('aria-checked')).toBe('true');
    for (const id of ['organization', 'terraform']) {
      expect(card(id).getAttribute('aria-disabled')).toBe('true');
      expect(card(id).textContent).toContain('WIZARD.SOON');
    }
    expect(card('cloud_shell').getAttribute('aria-disabled')).toBeNull();
  });

  it('shows the tags of the catalog as text and no estimated time', () => {
    create('ready');
    const shell = card('cloud_shell').textContent!;
    expect(shell).toContain('TAG_RECOMMENDED');
    expect(shell).toContain('TAG_FASTEST');
    expect(shell).not.toContain('MINUTES');
  });

  it('emits a choice for an available option and ignores a locked one', () => {
    create('ready');
    const picked: string[] = [];
    fixture.componentInstance.scopeChange.subscribe((v) => picked.push(v));
    fixture.componentInstance.methodChange.subscribe((v) => picked.push(v));
    card('terraform').click();
    card('organization').click();
    expect(picked).toEqual([]);
    card('cloud_shell').click();
    expect(picked).toEqual(['cloud_shell']);
  });

  it('shows the skeleton while loading and an error with «Reintentar» when the catalog failed', () => {
    create('loading');
    expect(qa('app-skeleton-region[data-options-loading]').length).toBe(1);
    expect(qa('app-loading-spinner').length).toBe(0);
    TestBed.resetTestingModule();
    create('error');
    expect(qa('[data-option-card]').length).toBe(0);
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    qa('[data-options-retry]')[0].click();
    expect(retried).toBe(1);
  });
});
