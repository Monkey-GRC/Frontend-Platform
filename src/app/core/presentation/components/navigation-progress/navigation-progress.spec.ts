import { Component } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NavigationProgress } from './navigation-progress';

@Component({ template: '' })
class Blank {}

describe('NavigationProgress', () => {
  it('shows the bar while a navigation is in flight and hides it when it ends', async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => (release = resolve));
    TestBed.configureTestingModule({
      providers: [provideTranslateService(), provideRouter([{ path: 'slow', component: Blank, canActivate: [() => slow.then(() => true)] }, { path: '', component: Blank }])],
    });
    const fixture = TestBed.createComponent(NavigationProgress);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="navigation-progress"]')).toBeNull();

    const navigation = TestBed.inject(Router).navigateByUrl('/slow');
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="navigation-progress"]')).not.toBeNull();

    release();
    await navigation;
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="navigation-progress"]')).toBeNull();
  });
});
