import { booleanAttribute, ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { Stepper, StepperItem } from '@shared/presentation/components/stepper/stepper';
import { LeaveMode, WizardLeaveService } from '@features/technical-control/domain/services/wizard-leave.service';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

/** El recorrido de toda plataforma, con el mismo nombre y orden: cómo conectar → datos → dar acceso → comprobar → resultado. Cada plataforma pone su contenido en cada paso. */
export const CONNECTION_STEPS: StepperItem[] = [
  { icon: 'tune', label: 'TECHNICAL_CONTROL.WIZARD.STEP.CHOOSE' },
  { icon: 'edit_note', label: 'TECHNICAL_CONTROL.WIZARD.STEP.DATA' },
  { icon: 'key', label: 'TECHNICAL_CONTROL.WIZARD.STEP.ACCESS' },
  { icon: 'verified_user', label: 'TECHNICAL_CONTROL.WIZARD.STEP.CHECK' },
  { icon: 'task_alt', label: 'TECHNICAL_CONTROL.WIZARD.STEP.RESULT' },
];

/**
 * El asistente de conexión a pantalla completa, estándar para toda plataforma que se conecta. Vive FUERA del shell de la app (sin menú lateral, encabezado ni migas):
 * una cabecera mínima (cerrar a la izquierda, título «Conectar <plataforma>» y una ayuda opcional en `[help]`), el recorrido (`app-stepper` horizontal y centrado),
 * el contenido centrado con ancho máximo y un pie fijo con «Atrás» y el botón principal. No decide nada: avisa `closed`, `back` y `next`, y quien lo usa aplica la regla.
 *
 *   <app-connection-wizard-shell titleKey="…" [titleParams]="{ name }" [steps]="steps" [current]="2" nextLabelKey="…" [showBack]="true" (closed)="leave()" (back)="…" (next)="…">…</app-connection-wizard-shell>
 */
@Component({
  selector: 'app-connection-wizard-shell',
  imports: [Stepper, ConfirmDialog, TranslatePipe, Busy, BusyFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex min-h-dvh flex-col bg-surface text-ink" data-wizard-shell>
      <header class="sticky top-0 z-10 border-b border-line bg-surface">
        <div class="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <button type="button" (click)="closed.emit()" data-wizard-close [attr.aria-label]="closeLabelKey() | translate"
            class="flex size-10 shrink-0 items-center justify-center rounded-control text-ink-muted transition hover:bg-tint hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40">
            <span class="material-symbols-rounded text-[22px]" aria-hidden="true">close</span>
          </button>
          <h1 class="min-w-0 flex-1 truncate text-base font-semibold text-ink sm:text-lg" data-wizard-title>{{ titleKey() | translate: titleParams() }}</h1>
          <div class="shrink-0 text-sm"><ng-content select="[help]" /></div>
        </div>
      </header>

      @if (steps().length > 0) {
        <nav class="mx-auto w-full max-w-3xl px-4 pt-6" [attr.aria-label]="stepperLabelKey() | translate" data-wizard-steps>
          <app-stepper [steps]="steps()" [current]="current()" [ariaLabel]="stepperLabelKey() | translate" />
        </nav>
      }

      <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-8" data-wizard-content [appBusyFields]="busy()">
        <ng-content />
      </main>

      @if (showFooter()) {
        <footer class="sticky bottom-0 z-10 border-t border-line bg-surface" data-wizard-footer>
          <div class="mx-auto flex h-18 w-full max-w-2xl items-center justify-between gap-3 px-4">
            @if (showBack()) {
              <button type="button" (click)="back.emit()" [disabled]="busy()" data-wizard-back class="mk-btn-secondary">
                <span class="material-symbols-rounded text-[18px]" aria-hidden="true">arrow_back</span>
                {{ 'TECHNICAL_CONTROL.WIZARD.BACK' | translate }}
              </button>
            } @else {
              <span></span>
            }
            @if (showNext()) {
              <button type="button" (click)="onNext()" [disabled]="nextDisabled()" [appBusy]="busy()" data-wizard-next class="mk-btn">{{ nextLabelKey() | translate }}</button>
            }
          </div>
        </footer>
      }
    </div>

    @if (leave.asking()) {
      <app-confirm-dialog titleKey="TECHNICAL_CONTROL.WIZARD.LEAVE.TITLE" [messageKey]="leave.mode() === 'saved' ? 'TECHNICAL_CONTROL.WIZARD.LEAVE.SAVED' : 'TECHNICAL_CONTROL.WIZARD.LEAVE.DISCARD'"
        [confirmLabelKey]="leave.mode() === 'saved' ? 'TECHNICAL_CONTROL.WIZARD.LEAVE.EXIT' : 'TECHNICAL_CONTROL.WIZARD.LEAVE.EXIT_DISCARD'" cancelLabelKey="TECHNICAL_CONTROL.WIZARD.LEAVE.STAY"
        [tone]="leave.mode() === 'saved' ? 'neutral' : 'danger'" (confirmed)="leave.answer(true)" (cancelled)="leave.answer(false)" />
    }
  `,
})
export class ConnectionWizardShell implements OnDestroy {
  protected readonly leave = inject(WizardLeaveService);
  /** Qué se pierde al salir; el asistente de cada plataforma lo calcula. La salida pregunta (guard `wizardLeaveGuard`) y sin nada que perder sale directo. */
  readonly leaveMode = input<LeaveMode>('none');

  readonly titleKey = input.required<string>();
  readonly titleParams = input<Record<string, unknown>>({});
  readonly steps = input<StepperItem[]>([]);
  readonly current = input(1);
  readonly closeLabelKey = input('TECHNICAL_CONTROL.WIZARD.CLOSE');
  readonly stepperLabelKey = input('TECHNICAL_CONTROL.WIZARD.STEPS_ARIA');
  readonly nextLabelKey = input('TECHNICAL_CONTROL.WIZARD.NEXT');
  readonly showFooter = input(true, { transform: booleanAttribute });
  readonly showBack = input(false, { transform: booleanAttribute });
  readonly showNext = input(true, { transform: booleanAttribute });
  readonly nextDisabled = input(false, { transform: booleanAttribute });
  readonly busy = input(false, { transform: booleanAttribute });

  constructor() {
    effect(() => this.leave.mode.set(this.leaveMode()));
  }

  ngOnDestroy(): void {
    this.leave.reset();
  }

  readonly closed = output<void>();
  readonly back = output<void>();
  readonly next = output<void>();

  protected onNext(): void {
    if (this.busy() || this.nextDisabled()) return;
    this.next.emit();
  }
}
