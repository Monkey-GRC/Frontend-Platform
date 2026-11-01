import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService (el modo se recuerda al recargar)', () => {
  const clean = () => {
    localStorage.removeItem('theme');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark:bg-gray-900');
  };
  beforeEach(clean);
  afterEach(clean);

  it('restores the dark mode the person had when it starts', () => {
    localStorage.setItem('theme', 'dark');
    TestBed.inject(ThemeService);
    expect(document.documentElement.classList).toContain('dark');
  });

  it('starts light when nothing was saved', () => {
    TestBed.inject(ThemeService);
    expect(document.documentElement.classList).not.toContain('dark');
  });

  it('saves the choice so the next reload keeps it', () => {
    const service = TestBed.inject(ThemeService);
    service.toggleTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList).toContain('dark');
    service.toggleTheme();
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList).not.toContain('dark');
  });
});
