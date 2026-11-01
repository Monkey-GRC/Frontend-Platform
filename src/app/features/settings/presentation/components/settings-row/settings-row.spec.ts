import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SettingsRow } from './settings-row';

@Component({
  imports: [SettingsRow],
  template: `
    <app-settings-row title="Contraseña" description="Cambia la contraseña." link="/ajustes/seguridad/contrasena" />
    <app-settings-row title="Aplicación" description="Códigos de un solo uso."><span data-testid="slot">Obligatoria</span></app-settings-row>
    <app-settings-row title="Sin descripción" />
  `,
})
class Host {}

describe('SettingsRow', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  const rows = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-settings-row'));

  it('with a link the whole row is an anchor to that screen and shows the chevron', () => {
    const row = rows()[0];
    const anchor = row.querySelector('a[data-testid="settings-row-link"]')!;
    expect(anchor.getAttribute('href')).toBe('/ajustes/seguridad/contrasena');
    expect(row.textContent).toContain('Contraseña');
    expect(row.textContent).toContain('Cambia la contraseña.');
    expect(row.textContent).toContain('chevron_right');
  });

  it('without a link it is informational: no anchor, no chevron, and shows what is projected', () => {
    const row = rows()[1];
    expect(row.querySelector('a')).toBeNull();
    expect(row.querySelector('[data-testid="settings-row-static"]')).not.toBeNull();
    expect(row.textContent).not.toContain('chevron_right');
    expect(row.querySelector('[data-testid="slot"]')!.textContent).toBe('Obligatoria');
  });

  it('omits the description line when there is none', () => {
    expect(rows()[2].querySelectorAll('p').length).toBe(1);
  });
});
