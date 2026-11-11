import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { TeamActor } from '@shared/domain/models/team.models';
import { TeamOrgView } from './team-org';

describe('TeamOrgView', () => {
  let groupApi: jasmine.SpyObj<GroupService>;
  let fixture: ComponentFixture<TeamOrgView>;

  function setup(actor: TeamActor): void {
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['list', 'create', 'rename']);
    groupApi.list.and.returnValue(of([]));
    const teamApi = jasmine.createSpyObj<TeamService>('TeamService', ['listAll', 'update']);
    teamApi.listAll.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TeamOrgView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: GroupService, useValue: groupApi }, { provide: TeamService, useValue: teamApi }],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'x@acme.co', name: 'Ada', last_name: null, role: actor }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamOrgView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('renders the header with the title and the org chart', () => {
    setup('admin_empresa');
    expect(el().querySelector('app-page-header')).not.toBeNull();
    expect(el().querySelector('h1')?.textContent).toContain('TEAM.ORG.TITLE');
    expect(el().querySelector('app-team-org-chart')).not.toBeNull();
  });

  it('describes the page by role', () => {
    setup('admin_empresa');
    expect(el().textContent).toContain('TEAM.ORG.INTRO_ADMIN');
    TestBed.resetTestingModule();
    setup('responsable');
    expect(el().textContent).toContain('TEAM.ORG.INTRO_OWN');
    expect(el().textContent).not.toContain('TEAM.ORG.INTRO_ADMIN');
  });

  it('asks again for the groups when the chart reports a change', () => {
    setup('admin_empresa');
    const calls = groupApi.list.calls.count();
    fixture.componentInstance.onGroupsChanged();
    expect(groupApi.list.calls.count()).toBe(calls + 1);
  });
});
