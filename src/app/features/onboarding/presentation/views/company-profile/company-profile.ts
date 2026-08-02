import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { CompanyProfileForm } from '../../components/company-profile-form/company-profile-form';

@Component({
  selector: 'app-company-profile',
  imports: [AuthPageLayoutComponent, CompanyProfileForm],
  templateUrl: './company-profile.html',
  styleUrl: './company-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyProfile { }
