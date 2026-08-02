import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { RegisterForm } from '../../components/register-form/register-form';

@Component({
  selector: 'app-register',
  imports: [AuthPageLayoutComponent, RegisterForm],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register { }
