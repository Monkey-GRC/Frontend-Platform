import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SecurityService } from '../../../domain/services/security.service';
import { RecoveryCodesCard } from './recovery-codes-card';

describe('RecoveryCodesCard (D94, SEG-16)', () => {
  let security: jasmine.SpyObj<SecurityService>;
  let fixture: ComponentFixture<RecoveryCodesCard>;

  beforeEach(() => {
    security = jasmine.createSpyObj<SecurityService>('SecurityService', ['regenerateRecoveryCodes']);
    TestBed.configureTestingModule({ imports: [RecoveryCodesCard], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: SecurityService, useValue: security }] });
    fixture = TestBed.createComponent(RecoveryCodesCard);
    fixture.detectChanges();
  });

  const card = () => fixture.componentInstance;
  const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('asks for the code in a modal and sends nothing until it is given', () => {
    q('recovery-codes-start')!.click();
    fixture.detectChanges();
    expect(q('factor-dialog')).not.toBeNull();
    expect(security.regenerateRecoveryCodes).not.toHaveBeenCalled();
  });

  it('offers only the app code, not a recovery code (a recovery code cannot generate more)', () => {
    q('recovery-codes-start')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('SECOND_FACTOR.USE_RECOVERY');
  });

  it('generates the new codes with the app code, closes the modal and shows them once', () => {
    security.regenerateRecoveryCodes.and.returnValue(of(['AAAAA-BBBBB', 'CCCCC-DDDDD']));
    card().start();
    card().generate({ code: '123456' });
    fixture.detectChanges();
    expect(security.regenerateRecoveryCodes).toHaveBeenCalledOnceWith('123456');
    expect(q('factor-dialog')).toBeNull();
    expect(q('recovery-codes-list')!.textContent).toContain('AAAAA-BBBBB');
    card().dismiss();
    fixture.detectChanges();
    expect(q('recovery-codes-list')).toBeNull();
  });

  it('keeps the modal open with the message when the code is wrong', () => {
    security.regenerateRecoveryCodes.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'MFA_CODE_INVALID' }, message: 'Ese código no es correcto.' } })));
    card().start();
    card().generate({ code: '000000' });
    fixture.detectChanges();
    expect(q('factor-dialog')).not.toBeNull();
    expect(q('factor-error')!.textContent).toContain('Ese código no es correcto.');
    expect(card().recoveryCodes()).toEqual([]);
  });
});
