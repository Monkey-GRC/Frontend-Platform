import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { AppSidebarComponent } from './app-sidebar.component';

// Qué ve cada rol en el menú (D102, MD-196). Ocultar es UX; la barrera real es el backend.
describe('AppSidebarComponent · menú por rol', () => {
  function menuFor(role: string): string[] {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AppSidebarComponent], providers: [provideRouter([]), provideTranslateService()] });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    return TestBed.createComponent(AppSidebarComponent).componentInstance.navItems.map((i) => i.name);
  }

  it('shows the administrator everything, including the team and the control assignment', () => {
    expect(menuFor('admin_empresa')).toEqual(['Inicio', 'Mi empresa', 'Mis servicios', 'Cumplimiento', 'Responsables', 'Equipo', 'Asignación']);
  });

  it('gives the owner «Mi trabajo», Cumplimiento, the executor assignment and their team, and nothing of the company', () => {
    expect(menuFor('responsable')).toEqual(['Mi trabajo', 'Cumplimiento', 'Asignar ejecutor', 'Mi equipo']);
  });

  it('gives the delegate only «Mi trabajo» and Cumplimiento', () => {
    expect(menuFor('delegado')).toEqual(['Mi trabajo', 'Cumplimiento']);
  });

  it('hides from the auditor what the backend refuses them (company, services, team, assignment)', () => {
    expect(menuFor('auditor')).toEqual(['Inicio', 'Cumplimiento', 'Responsables']);
  });
});
