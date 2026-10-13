import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SidePanel } from './side-panel';

@Component({
  imports: [SidePanel],
  template: `
    <app-side-panel titleKey="TEST.TITLE" subtitleKey="TEST.SUBTITLE" (closed)="closed = closed + 1">
      <p id="body">contenido</p>
      @if (withFooter) {
        <button panelFooter id="save">Guardar</button>
      }
    </app-side-panel>
  `,
})
class Host {
  closed = 0;
  withFooter = false;
}

describe('SidePanel', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('is a modal dialog labelled by its title, with the content inside', () => {
    const dialog = el().querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(el().querySelector('#' + dialog.getAttribute('aria-labelledby'))!.textContent).toContain('TEST.TITLE');
    expect(el().querySelector('#body')).not.toBeNull();
    expect(el().textContent).toContain('TEST.SUBTITLE');
  });

  it('closes with the button, with Escape and by clicking outside', () => {
    (el().querySelector('header button') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el().querySelector('[aria-hidden="true"].fixed') as HTMLElement).click();
    expect(host.closed).toBe(3);
  });

  it('puts the focus on the close button when it opens', async () => {
    await fixture.whenStable();
    expect(document.activeElement).toBe(el().querySelector('header button'));
  });

  it('hides the footer when nothing is projected and shows it when something is', () => {
    expect(el().querySelector('footer')!.querySelector('#save')).toBeNull();
    expect(getComputedStyle(el().querySelector('footer')!).display).toBe('none');
    host.withFooter = true;
    fixture.detectChanges();
    expect(el().querySelector('footer #save')).not.toBeNull();
  });
});
