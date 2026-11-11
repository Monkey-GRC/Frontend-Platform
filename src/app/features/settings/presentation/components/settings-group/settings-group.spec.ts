import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SettingsGroup } from './settings-group';

@Component({ imports: [SettingsGroup], template: `<app-settings-group title="Cómo inicias sesión"><p data-testid="inside">fila</p></app-settings-group>` })
class Host {}

describe('SettingsGroup', () => {
  it('shows the category title above a card that holds its rows', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toBe('Cómo inicias sesión');
    expect(el.querySelector('.rounded-card [data-testid="inside"]')).not.toBeNull();
  });
});
