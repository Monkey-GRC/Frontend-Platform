import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { Language, LanguageService } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { ThemeService } from '@core/domain/services/theme.service';
import { AuthService } from '@core/domain/services/auth.service';
import { displayNameOf, initialsOf } from '@shared/domain/utils/initials';

// El menú de la persona en sesión (el círculo con sus iniciales, arriba a la derecha): reúne lo que es suyo y no de la pantalla: sus ajustes, el idioma, el modo oscuro y
// cerrar sesión. Se cierra al elegir algo, al hacer clic fuera y con Escape.
@Component({
  selector: 'app-profile-menu',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './profile-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'close()' },
})
export class ProfileMenu {
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly language = inject(LanguageService);

  readonly open = signal(false);
  readonly languages: { value: Language; label: string }[] = [
    { value: 'es', label: 'ES' },
    { value: 'en', label: 'EN' },
  ];

  readonly user = this.session.user;
  readonly initials = computed(() => { const u = this.user(); return u ? initialsOf(u) : ''; });
  readonly displayName = computed(() => { const u = this.user(); return u ? displayNameOf(u) : ''; });
  readonly isDark = toSignal(this.theme.theme$.pipe(map((t) => t === 'dark')), { initialValue: false });

  toggle(): void {
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }

  toggleDark(): void {
    this.theme.toggleTheme();
  }

  logout(): void {
    this.close();
    const goToSignIn = () => this.router.navigateByUrl('/signin', { replaceUrl: true });
    this.auth.logout().subscribe({ next: goToSignIn, error: goToSignIn });
  }
}
