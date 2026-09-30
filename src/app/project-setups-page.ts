import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { apiError, ContainerApi, ContainerRecord, ProjectSetupRow } from './container-api';

@Component({
  selector: 'app-project-setups-page',
  imports: [RouterLink],
  template: `
    @if (loading()) {
      <p class="status">Carregando setups...</p>
    } @else if (loadError()) {
      <p class="status error" role="alert">{{ loadError() }}</p>
      <a class="button" routerLink="/projects">Voltar aos projetos</a>
    } @else if (project(); as item) {
      <nav class="breadcrumbs" aria-label="Navegação">
        <a routerLink="/projects">Projetos</a>
        <span aria-hidden="true">/</span>
        <a [routerLink]="'/projects/' + item.id">{{ item.code }}</a>
        <span aria-hidden="true">/</span>
        <span>Setups</span>
      </nav>

      <div class="page-heading">
        <div>
          <p class="eyebrow">PROJETO {{ item.code }}</p>
          <h1>Setups do projeto</h1>
          <p class="muted">Setups de todos os ambientes e imagens deste projeto.</p>
        </div>
      </div>

      @if (setups().length === 0) {
        <div class="empty-state compact"><p>Nenhum setup cadastrado neste projeto.</p></div>
      } @else {
        <div class="table-wrapper">
          <table class="setup-table">
            <thead>
              <tr>
                <th scope="col">Código do setup</th>
                <th scope="col">Código da imagem</th>
                <th scope="col">Código do ambiente</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (setup of setups(); track setup.id) {
                <tr>
                  <td><strong>{{ setup.setup_code }}</strong></td>
                  <td>{{ setup.image_code }}</td>
                  <td>{{ setup.environment_code }}</td>
                  <td>
                    <div class="actions">
                      <a class="button" [routerLink]="'/setups/' + setup.id">Visualizar</a>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class ProjectSetupsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContainerApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly project = signal<ContainerRecord | null>(null);
  protected readonly setups = signal<ProjectSetupRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(Number(params.get('id')));
    });
  }

  private load(projectId: number): void {
    this.loading.set(true);
    this.loadError.set('');
    this.project.set(null);
    forkJoin({
      project: this.api.get('projects', projectId),
      setups: this.api.listProjectSetups(projectId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ project, setups }) => {
        this.project.set(project);
        this.setups.set(setups);
        this.loading.set(false);
      },
      error: (error) => {
        this.loadError.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

}
