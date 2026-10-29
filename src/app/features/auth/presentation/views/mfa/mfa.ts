import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { MfaForm } from '../../components/mfa-form/mfa-form';

@Component({
  selector: 'app-mfa',
  imports: [AuthPageLayoutComponent, MfaForm],
  templateUrl: './mfa.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Mfa {}

