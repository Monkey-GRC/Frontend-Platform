import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { TeamActor } from '@shared/domain/models/team.models';
import { Group } from '@features/team/domain/models/group.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamOrgChart } from '../../components/team-org-chart/team-org-chart';

// El organigrama es una página del grupo Equipo (`/equipo/organigrama`): solo cabecera y composición; el dibujo y sus acciones viven en `TeamOrgChart`.
@Component({
  selector: 'app-team-org',
  imports: [PageHeader, TranslatePipe, TeamOrgChart],
  templateUrl: './team-org.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamOrgView implements OnInit {
  private readonly groupApi = inject(GroupService);
  private readonly session = inject(SessionService);

  readonly isAdmin = computed(() => isCompanyAdmin(this.session.user()?.role));
  readonly actor = computed<TeamActor>(() => (this.isAdmin() ? 'admin_empresa' : 'responsable'));
  readonly groups = signal<Group[]>([]);
  /** Hasta que los grupos llegan (o fallan) el organigrama no dice «aún no tiene equipo». */
  readonly groupsLoaded = signal(false);

  ngOnInit(): void {
    this.reloadGroups();
  }

  /** Se creó o renombró un equipo, o se movió a un delegado: los grupos cambiaron. */
  onGroupsChanged(): void {
    this.reloadGroups();
  }

  private reloadGroups(): void {
    this.groupApi.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.groupsLoaded.set(true);
      },
      error: () => {
        this.groups.set([]);
        this.groupsLoaded.set(true);
      },
    });
  }
}
