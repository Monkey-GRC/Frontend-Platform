import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { AuthService } from '@core/domain/services/auth.service';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

// Un correo pegado suele traer espacios al final: se valida ya recortado (el envío también lo recorta), para que no se rechace por algo que la persona no ve.
const trimmedEmail: ValidatorFn = (control: AbstractControl): ValidationErrors | null => Validators.email({ value: String(control.value ?? '').trim() } as AbstractControl);

// «Olvidé mi contraseña» (D101): el correo y nada más. La respuesta es la misma exista o no la cuenta, así que la pantalla tampoco lo dice.
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthPageLayoutComponent, Busy, BusyFields],
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, trimmedEmail]] });

  submit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.auth.forgotPassword(this.form.getRawValue().email.trim().toLowerCase()).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.FORGOT.ERROR_FALLBACK')));
      },
    });
  }
}
