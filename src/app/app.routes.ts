import { Routes } from '@angular/router';

import { ProjectsPage } from './projects-page';
import { ProjectSetupsPage } from './project-setups-page';
import { RecordDetailPage } from './record-detail-page';
import { RecordFormPage } from './record-form-page';
import { LoginPage } from './login-page';
import { operatorGuard } from './auth.service';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: '', canActivateChild: [operatorGuard], children: [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'projects', component: ProjectsPage },
  { path: 'projects/new', component: RecordFormPage, data: { kind: 'projects', mode: 'create' } },
  { path: 'projects/:parentId/environments/new', component: RecordFormPage, data: { kind: 'environments', mode: 'create' } },
  { path: 'environments/:parentId/images/new', component: RecordFormPage, data: { kind: 'images', mode: 'create' } },
  { path: 'images/:parentId/setups/new', component: RecordFormPage, data: { kind: 'setups', mode: 'create' } },
  { path: 'projects/:id/edit', component: RecordFormPage, data: { kind: 'projects', mode: 'edit' } },
  { path: 'environments/:id/edit', component: RecordFormPage, data: { kind: 'environments', mode: 'edit' } },
  { path: 'images/:id/edit', component: RecordFormPage, data: { kind: 'images', mode: 'edit' } },
  { path: 'setups/:id/edit', component: RecordFormPage, data: { kind: 'setups', mode: 'edit' } },
  { path: 'projects/:id/setups', component: ProjectSetupsPage },
  { path: 'projects/:id', component: RecordDetailPage, data: { kind: 'projects' } },
  { path: 'environments/:id', component: RecordDetailPage, data: { kind: 'environments' } },
  { path: 'images/:id', component: RecordDetailPage, data: { kind: 'images' } },
  { path: 'setups/:id', component: RecordDetailPage, data: { kind: 'setups' } },
  { path: '**', redirectTo: 'projects' },
  ] },
];
