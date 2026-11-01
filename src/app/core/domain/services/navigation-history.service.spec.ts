import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NavigationHistoryService } from './navigation-history.service';

@Component({ template: '' })
class Blank {}

describe('NavigationHistoryService (volver desde Ajustes)', () => {
  let router: Router;
  let history: NavigationHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'services', component: Blank },
          { path: 'services/:id', component: Blank },
          { path: 'ajustes', children: [{ path: 'seguridad', component: Blank }, { path: '', redirectTo: 'seguridad', pathMatch: 'full' }] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    history = TestBed.inject(NavigationHistoryService);
  });

  it('returns to the home when the person entered Settings directly', async () => {
    await router.navigateByUrl('/ajustes');
    expect(history.returnUrl).toBe('/');
  });

  it('remembers the last app screen, with its parameters, and keeps it while moving inside Settings', async () => {
    await router.navigateByUrl('/services/abc?tab=risks');
    await router.navigateByUrl('/ajustes');
    expect(router.url).toBe('/ajustes/seguridad');
    expect(history.returnUrl).toBe('/services/abc?tab=risks');
    await router.navigateByUrl('/ajustes/seguridad');
    expect(history.returnUrl).toBe('/services/abc?tab=risks');
  });

  it('follows the person around the app until they open Settings', async () => {
    await router.navigateByUrl('/services');
    await router.navigateByUrl('/services/xyz');
    expect(history.returnUrl).toBe('/services/xyz');
  });
});
