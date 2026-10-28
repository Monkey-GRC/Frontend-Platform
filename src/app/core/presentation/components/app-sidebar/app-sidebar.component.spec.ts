import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { AppSidebarComponent } from './app-sidebar.component';

describe('AppSidebarComponent · menú por rol', () => {
  function menuFor(role: string): string[] {
    TestBed.configureTestingModule({ imports: [AppSidebarComponent], providers: [provideRouter([]), provideTranslateService()] });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    return TestBed.createComponent(AppSidebarComponent).componentInstance.navItems.map((i) => i.name);
  }

  it('shows the administrator everything, including the team', () => {
    expect(menuFor('admin_empresa')).toEqual(['Inicio', 'Mi empresa', 'Mis servicios', 'Cumplimiento', 'Responsables', 'Equipo']);
  });

  it('hides from the functional user and the auditor what the backend refuses them (company, services, team)', () => {
    for (const role of ['funcional', 'auditor']) {
      TestBed.resetTestingModule();
      expect(menuFor(role)).toEqual(['Inicio', 'Cumplimiento', 'Responsables']);
    }
  });
});