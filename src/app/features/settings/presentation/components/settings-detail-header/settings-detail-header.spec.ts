import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SettingsDetailHeader } from './settings-detail-header';

@Component({
  imports: [SettingsDetailHeader],
  template: `<app-settings-detail-header backLink="/ajustes/seguridad" title="Contraseña" subtitle="Cámbiala cuando quieras."><button data-testid="action">Agregar</button></app-settings-detail-header>`,
})
class Host {}

describe('SettingsDetailHeader', () => {
  it('goes back to the section with a real link, and shows the title, the subtitle and the projected action', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="settings-detail-back"]')!.getAttribute('href')).toBe('/ajustes/seguridad');
    expect(el.querySelector('h1')!.textContent).toBe('Contraseña');
    expect(el.textContent).toContain('Cámbiala cuando quieras.');
    expect(el.querySelector('[data-testid="action"]')).not.toBeNull();
  });

  it('puts «Atrás» in the corner of the section pane, outside the content column', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const back = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="settings-detail-back"]')!;
    expect(back.classList).toContain('absolute');
    expect(back.classList).toContain('left-5');
    expect(back.classList).toContain('top-5');
  });
});
