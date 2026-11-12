import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
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
    expect(menuFor('admin_empresa')).toEqual(['Inicio', 'Mi empresa', 'Cumplimiento', 'Equipo', 'Asignación', 'Integraciones']);
  });

  it('gives the owner «Mi trabajo», Cumplimiento, the executor assignment and their team, and nothing of the company', () => {
    expect(menuFor('responsable')).toEqual(['Mi trabajo', 'Cumplimiento', 'Asignar ejecutor', 'Mi equipo']);
  });

  it('gives the delegate only «Mi trabajo» and Cumplimiento', () => {
    expect(menuFor('delegado')).toEqual(['Mi trabajo', 'Cumplimiento']);
  });

  it('gives the auditor Integraciones (read only) and hides what the backend refuses them (company, services, team, assignment)', () => {
    expect(menuFor('auditor')).toEqual(['Inicio', 'Cumplimiento', 'Responsables', 'Integraciones']);
  });
});

@Component({ template: '' })
class Blank {}

// Menu with groups (design system): the title of a group only opens or closes (it never navigates), the children navigate, and the state is a session signal.
describe('AppSidebarComponent · groups', () => {
  async function render(role: string, url: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([{ path: '**', component: Blank }]), provideTranslateService()],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function title(root: HTMLElement, controls: string): HTMLButtonElement {
    return root.querySelector(`button[aria-controls="${controls}"]`) as HTMLButtonElement;
  }

  function panel(root: HTMLElement, id: string): HTMLElement {
    return root.querySelector(`#${id}`) as HTMLElement;
  }

  // Sections are separated by one line between them (no titles): never before the first, never after the last, never two in a row.
  describe('section dividers', () => {
    const separators = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-nav-separator]'));

    it('draws two lines for the administrator: Start | Work | Connect', async () => {
      const fixture = await render('admin_empresa', '/');
      const root = fixture.nativeElement as HTMLElement;
      expect(separators(root).length).toBe(2);
      const nav = root.querySelector('nav > div') as HTMLElement;
      const kinds = Array.from(nav.children).map((c) => ((c as HTMLElement).hasAttribute('data-nav-separator') ? '|' : 'S'));
      expect(kinds.join('')).toBe('S|S|S');
      expect(separators(root)[0].className).toContain('border-line');
      expect(separators(root)[0].className).toContain('my-3');
      expect(root.querySelector('h2')).toBeNull();
    });

    it('draws a line that can be seen: 2 px in the stronger line token, with 12 px of air on each side', async () => {
      const fixture = await render('admin_empresa', '/');
      const sep = (fixture.nativeElement as HTMLElement).querySelector('[data-nav-separator]') as HTMLElement;
      expect(sep.className).toContain('border-t-2');
      expect(sep.className).toContain('border-line-strong');
      document.body.appendChild(fixture.nativeElement);
      const style = getComputedStyle(sep);
      expect(style.borderTopWidth).toBe('2px');
      expect(style.marginTop).toBe('12px');
      expect(style.marginBottom).toBe('12px');
      expect(style.borderTopColor).not.toBe(getComputedStyle(document.body).backgroundColor);
      expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
      (fixture.nativeElement as HTMLElement).remove();
    });

    it('leaves 16 px between the logo block and the first item, in both widths (the logo block has the same margin)', async () => {
      const fixture = await render('admin_empresa', '/');
      const logo = (fixture.nativeElement as HTMLElement).querySelector('aside > div') as HTMLElement;
      expect(logo.className).toContain('mb-4');
    });

    it('puts the integrations after the last line, and Home before the first', async () => {
      const fixture = await render('auditor', '/');
      const root = fixture.nativeElement as HTMLElement;
      const nav = root.querySelector('nav > div') as HTMLElement;
      const children = Array.from(nav.children) as HTMLElement[];
      expect(children[0].textContent).toContain('SHELL.NAV.HOME');
      expect(children[children.length - 1].textContent).toContain('SHELL.NAV.INTEGRATIONS');
      expect(children[0].hasAttribute('data-nav-separator')).toBeFalse();
      expect(children[children.length - 1].hasAttribute('data-nav-separator')).toBeFalse();
    });

    it('draws one line only when a role has two sections (the delegate: Start | Work), never double or trailing', async () => {
      const fixture = await render('delegado', '/');
      const root = fixture.nativeElement as HTMLElement;
      expect(separators(root).length).toBe(1);
      const nav = root.querySelector('nav > div') as HTMLElement;
      const last = nav.lastElementChild as HTMLElement;
      expect(last.hasAttribute('data-nav-separator')).toBeFalse();
      const children = Array.from(nav.children) as HTMLElement[];
      expect(children.some((c, i) => c.hasAttribute('data-nav-separator') && children[i + 1]?.hasAttribute('data-nav-separator'))).toBeFalse();
    });
  });

  it('animates a group: the panel is always in the DOM, goes from closed to open by its state, and the chevron turns with it', async () => {
    const fixture = await render('admin_empresa', '/');
    const root = fixture.nativeElement as HTMLElement;
    const group = panel(root, 'nav-group-equipo');
    const chevron = title(root, 'nav-group-equipo').querySelector('.menu-chevron-icon') as HTMLElement;
    expect(group.className).toContain('menu-group-panel');
    expect(group.getAttribute('data-open')).toBe('false');
    expect(chevron.getAttribute('data-open')).toBe('false');
    title(root, 'nav-group-equipo').click();
    fixture.detectChanges();
    expect(panel(root, 'nav-group-equipo')).toBe(group); // the same node: it was never destroyed, so the transition runs
    expect(group.getAttribute('data-open')).toBe('true');
    expect(chevron.getAttribute('data-open')).toBe('true');
    const list = group.querySelector('[data-nav-children]') as HTMLElement;
    expect(list.className).toContain('border-l');
    expect(list.className).toContain('ml-6');
    expect(group.querySelector('a.menu-child')!.className).toContain('menu-child');
  });

  it('starts closed and opens by clicking the title, without leaving the page', async () => {
    const fixture = await render('admin_empresa', '/');
    const button = title(fixture.nativeElement, 'nav-group-equipo');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel(fixture.nativeElement, 'nav-group-equipo').getAttribute('data-open')).toBe('false');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel(fixture.nativeElement, 'nav-group-equipo').getAttribute('data-open')).toBe('true');
    expect(TestBed.inject(Router).url).toBe('/');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('never navigates from the title of a group: Compliance, My company and Team have no link on the title', async () => {
    const fixture = await render('admin_empresa', '/');
    for (const id of ['nav-group-cumplimiento', 'nav-group-mi-empresa', 'nav-group-equipo']) {
      const button = title(fixture.nativeElement, id);
      expect(button.tagName).toBe('BUTTON');
      expect(button.closest('a')).toBeNull();
      expect(button.querySelector('a')).toBeNull();
      button.click();
      fixture.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/');
    }
  });

  it('is a real button, reachable and operable with the keyboard (Enter and Space are the native click of a button), with aria-expanded and aria-controls', async () => {
    const fixture = await render('admin_empresa', '/');
    const button = title(fixture.nativeElement, 'nav-group-cumplimiento');
    expect(button.type).toBe('button');
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel(fixture.nativeElement, 'nav-group-cumplimiento')).not.toBeNull();
  });

  it('lists the six sections of Compliance as children, in the order of the tabs they replace, for every role', async () => {
    for (const role of ['admin_empresa', 'auditor', 'responsable', 'delegado']) {
      const fixture = await render(role, '/');
      const links = Array.from(panel(fixture.nativeElement, 'nav-group-cumplimiento').querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['/cumplimiento/resumen', '/cumplimiento/riesgos', '/cumplimiento/causas', '/cumplimiento/controles', '/cumplimiento/evidencias', '/cumplimiento/exclusiones']);
    }
  });

  it('opens the group that holds the active page, marks its title as «contains the active section» (not as an active item) and marks the child as the current page', async () => {
    const fixture = await render('admin_empresa', '/cumplimiento/riesgos');
    const button = title(fixture.nativeElement, 'nav-group-cumplimiento');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.hasAttribute('data-contains-active')).toBeTrue();
    expect(button.classList).not.toContain('menu-item-active');
    expect(button.hasAttribute('aria-current')).toBeFalse();
    const current = panel(fixture.nativeElement, 'nav-group-cumplimiento').querySelector('a[aria-current="page"]');
    expect(current?.getAttribute('href')).toBe('/cumplimiento/riesgos');
    expect(title(fixture.nativeElement, 'nav-group-equipo').hasAttribute('data-contains-active')).toBeFalse();
    expect(title(fixture.nativeElement, 'nav-group-equipo').getAttribute('aria-expanded')).toBe('false');
  });

  it('also marks Compliance on the general view /cumplimiento, which is not a section', async () => {
    const fixture = await render('admin_empresa', '/cumplimiento');
    expect(title(fixture.nativeElement, 'nav-group-cumplimiento').hasAttribute('data-contains-active')).toBeTrue();
    expect(panel(fixture.nativeElement, 'nav-group-cumplimiento').querySelector('a[aria-current="page"]')).toBeNull();
  });

  it('opens by itself the group whose child route is active, and does not mark «Mis servicios» on a service page of Compliance', async () => {
    const fixture = await render('admin_empresa', '/responsables');
    expect(title(fixture.nativeElement, 'nav-group-equipo').getAttribute('aria-expanded')).toBe('true');
    expect(title(fixture.nativeElement, 'nav-group-mi-empresa').getAttribute('aria-expanded')).toBe('false');
    const onCompliance = await render('admin_empresa', '/cumplimiento/resumen');
    expect(title(onCompliance.nativeElement, 'nav-group-mi-empresa').hasAttribute('data-contains-active')).toBeFalse();
  });

  it('gives My company its own page («Contexto de la empresa») and Team its own («Personas») as the first children', async () => {
    const fixture = await render('admin_empresa', '/');
    const hrefs = (id: string) => Array.from(panel(fixture.nativeElement, id).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs('nav-group-mi-empresa')).toEqual(['/onboarding', '/services']);
    expect(hrefs('nav-group-equipo')).toEqual(['/equipo/personas', '/equipo/grupos', '/equipo/organigrama', '/responsables']);
  });

  it('gives the owner «Mi equipo» as a group with People, Groups and Org chart, and no «Cargos responsables» (the administrator reaches it under Team)', async () => {
    const fixture = await render('responsable', '/');
    const hrefs = (id: string) => Array.from(panel(fixture.nativeElement, id).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs('nav-group-mi-equipo')).toEqual(['/equipo/personas', '/equipo/grupos', '/equipo/organigrama']);
    expect(fixture.nativeElement.querySelector('#nav-group-equipo')).toBeNull();
  });

  it('opens the Team group on a page of People or Groups', async () => {
    const people = await render('admin_empresa', '/equipo/personas');
    expect(title(people.nativeElement, 'nav-group-equipo').getAttribute('aria-expanded')).toBe('true');
    const groups = await render('admin_empresa', '/equipo/grupos');
    expect(title(groups.nativeElement, 'nav-group-equipo').getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the auditor «Cargos responsables» as a simple item, with no group button for it', async () => {
    const fixture = await render('auditor', '/');
    expect(fixture.nativeElement.querySelector('button[aria-controls="nav-group-equipo"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/responsables"]')).not.toBeNull();
  });

  // The animation: the panel is always in the DOM (a node that is created and destroyed has nothing to transition from) and only its state attribute changes.
  describe('animation', () => {
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    async function attached(url = '/') {
      const fixture = await render('admin_empresa', url);
      document.body.appendChild(fixture.nativeElement);
      return fixture;
    }

    it('keeps the panel in the DOM, closed and open, and only flips its state attribute and the one of the chevron', async () => {
      const fixture = await attached();
      const root = fixture.nativeElement as HTMLElement;
      const button = title(root, 'nav-group-equipo');
      const chevron = button.querySelector('.menu-chevron-icon') as SVGElement;
      const before = panel(root, 'nav-group-equipo');
      expect(before.getAttribute('data-open')).toBe('false');
      expect(chevron.getAttribute('data-open')).toBe('false');

      button.click();
      fixture.detectChanges();
      expect(panel(root, 'nav-group-equipo')).toBe(before);
      expect(before.getAttribute('data-open')).toBe('true');
      expect(chevron.getAttribute('data-open')).toBe('true');

      button.click();
      fixture.detectChanges();
      expect(panel(root, 'nav-group-equipo')).toBe(before);
      expect(before.isConnected).toBeTrue();
      expect(before.getAttribute('data-open')).toBe('false');
      fixture.nativeElement.remove();
    });

    it('has a computed transition of 200 ms on height and opacity (and the chevron turns at the same pace), unless the system asks for reduced motion', async () => {
      if (reduced()) return pending('the system asks for reduced motion');
      const fixture = await attached();
      const root = fixture.nativeElement as HTMLElement;
      const style = getComputedStyle(panel(root, 'nav-group-equipo'));
      expect(style.transitionProperty).toContain('grid-template-rows');
      expect(style.transitionProperty).toContain('opacity');
      expect(style.transitionDuration.split(', ').slice(0, 2)).toEqual(['0.2s', '0.16s']);
      expect(style.transitionTimingFunction).toContain('cubic-bezier(0, 0, 0.2, 1)');
      const chevron = getComputedStyle(title(root, 'nav-group-equipo').querySelector('.menu-chevron-icon')!);
      expect(chevron.transitionDuration).toBe('0.2s');
      expect(chevron.transitionProperty).toBe('transform');
      root.remove();
    });

    it('really interpolates the height: a moment after opening it is taller than closed and shorter than open', async () => {
      if (reduced()) return pending('the system asks for reduced motion');
      const fixture = await attached();
      const root = fixture.nativeElement as HTMLElement;
      const target = panel(root, 'nav-group-equipo');
      const closed = target.getBoundingClientRect().height;
      expect(closed).toBe(0);
      title(root, 'nav-group-equipo').click();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 90));
      const middle = target.getBoundingClientRect().height;
      await new Promise((r) => setTimeout(r, 500));
      const open = target.getBoundingClientRect().height;
      expect(middle).toBeGreaterThan(0);
      expect(middle).toBeLessThan(open);
      root.remove();
    });

    it('paints each child as a whole box (full width, at least 40 px high), not only the letters', async () => {
      const fixture = await attached('/cumplimiento/riesgos');
      const root = fixture.nativeElement as HTMLElement;
      const links = Array.from(panel(root, 'nav-group-cumplimiento').querySelectorAll<HTMLElement>('a.menu-child'));
      expect(links.length).toBe(6);
      const width = panel(root, 'nav-group-cumplimiento').querySelector('[data-nav-children]')!.getBoundingClientRect().width - 1; // minus the 1 px guide
      for (const a of links) {
        expect(a.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
        expect(a.getBoundingClientRect().width).toBeCloseTo(width, 0);
      }
      const active = panel(root, 'nav-group-cumplimiento').querySelector('a[aria-current="page"]')!;
      expect(active.classList).toContain('menu-child-active');
      expect(getComputedStyle(active).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      root.remove();
    });
  });
});
