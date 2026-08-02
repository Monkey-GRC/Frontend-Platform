import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { AccountSetupForm } from '../../components/account-setup-form/account-setup-form';

@Component({
  selector: 'app-account-setup',
  imports: [AuthPageLayoutComponent, AccountSetupForm],
  templateUrl: './account-setup.html',
  styleUrl: './account-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSetup { }
