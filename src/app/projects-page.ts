import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { apiError, ContainerApi, ContainerRecord, detailUrl } from './container-api';

@Component({
  selector: 'app-projects-page',
  imports: [RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">ORGANIZAÇÃO</p>
        <h1>Projetos</h1>
        <p class="muted">Selecione um projeto para visualizar seus ambientes.</p>
      </div>
      <a class="button primary" routerLink="/projects/new">Adicionar projeto</a>
    </div>

    @if (loading()) {
      <p class="status">Carregando projetos...</p>
    } @else if (error()) {
      <p class="status error" role="alert">{{ error() }}</p>
      <button class="button" type="button" (click)="load()">Tentar novamente</button>
    } @else if (projects().length === 0) {
      <div class="empty-state">
        <h2>Nenhum projeto cadastrado</h2>
        <p>Comece criando o primeiro projeto.</p>
        <a class="button primary" routerLink="/projects/new">Adicionar projeto</a>
      </div>
    } @else {
      <div class="record-list">
        @for (project of projects(); track project.id) {
          <a class="record-row" [routerLink]="detailUrl('projects', project.id)">
            <span class="record-icon">P</span>
            <span class="record-main">
              <strong>{{ project.code }}</strong>
              <span>{{ project.description?.toLocaleUpperCase('pt-BR') }}</span>
            </span>
            <span class="row-action">Visualizar <span aria-hidden="true">→</span></span>
          </a>
        }
      </div>
    }
  `,
})
export class ProjectsPage implements OnInit {
  private readonly api = inject(ContainerApi);
  protected readonly detailUrl = detailUrl;
  protected readonly projects = signal<ContainerRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }
}
