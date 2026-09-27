import { Location } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  apiError, ContainerApi, ContainerRecord, detailUrl, newUrl,
  RESOURCE_CONFIG, ResourceKind,
} from './container-api';
import { highlightDockerfile } from './dockerfile-highlight';

@Component({
  selector: 'app-record-detail-page',
  imports: [RouterLink],
  template: `
    @if (loading()) {
      <p class="status">Carregando registro...</p>
    } @else if (error()) {
      <p class="status error" role="alert">{{ error() }}</p>
      <a class="button" routerLink="/projects">Voltar aos projetos</a>
    } @else if (record(); as item) {
      <nav class="breadcrumbs" aria-label="Navegação">
        <a routerLink="/projects">Projetos</a>
        @if (config.parent && config.parentIdKey) {
          <span aria-hidden="true">/</span>
          <a [routerLink]="detailUrl(config.parent, parentId(item))">
            {{ RESOURCE_CONFIG[config.parent].singular }}
          </a>
        }
        <span aria-hidden="true">/</span>
        <span>{{ item.code }}</span>
      </nav>

      <div class="page-heading">
        <div>
          <p class="eyebrow">{{ config.singular }}</p>
          <h1>{{ item.code }}</h1>
          @if (item.description) { <p class="muted">{{ item.description.toLocaleUpperCase('pt-BR') }}</p> }
        </div>
        <div class="actions">
          <a class="button" [routerLink]="detailUrl(kind, item.id) + '/edit'">Editar</a>
          <button class="button danger" type="button" [disabled]="deleting()" (click)="remove(item)">
            {{ deleting() ? 'Excluindo...' : 'Excluir' }}
          </button>
          <button class="button" type="button" (click)="goBack()">Cancelar</button>
        </div>
      </div>

      @if (actionError()) { <p class="status error" role="alert">{{ actionError() }}</p> }

      <section class="panel" aria-label="Dados do registro">
        <h2>Detalhes</h2>
        <dl class="details-grid">
          <div><dt>Código</dt><dd>{{ item.code }}</dd></div>
          @for (field of config.fields; track field.key) {
            <div [class.full-width]="field.multiline">
              <dt>{{ field.label }}</dt>
              @if (field.key === 'definition') {
                <dd>
                  <div class="dockerfile-viewer" role="region" aria-label="Definição Dockerfile">
                    <div class="dockerfile-toolbar">
                      <span class="dockerfile-language">Dockerfile</span>
                      <span>{{ definitionLines().length }} linhas</span>
                    </div>
                    <pre class="dockerfile-code" tabindex="0"><code>@for (line of definitionLines(); track line.number) {<span class="dockerfile-line"><span class="dockerfile-line-number" aria-hidden="true">{{ line.number }}</span><span class="dockerfile-line-content">@for (token of line.tokens; track $index) {<span [class]="'dockerfile-token-' + token.kind">{{ token.text }}</span>}</span></span>}</code></pre>
                  </div>
                </dd>
              } @else if (field.key === 'token') {
                <dd>{{ item.hasToken ? 'Configurado' : 'Não configurado' }}</dd>
              } @else if (field.key === 'isPrivate') {
                <dd>{{ item.isPrivate ? 'Sim' : 'Não' }}</dd>
              } @else {
                <dd [class.preformatted]="field.multiline">{{ value(item, field.key) }}</dd>
              }
            </div>
          }
          <div><dt>Data de criação</dt><dd>{{ formatDate(item.created_date) }}</dd></div>
          <div><dt>Última modificação</dt><dd>{{ formatDate(item.last_modified_date) }}</dd></div>
        </dl>
      </section>

      @if (config.children; as childKind) {
        <section class="children-section" aria-label="{{ RESOURCE_CONFIG[childKind].plural }}">
          <div class="section-heading">
            <div>
              <p class="eyebrow">VINCULADOS A ESTE REGISTRO</p>
              <h2>{{ RESOURCE_CONFIG[childKind].plural }}</h2>
            </div>
            <div class="actions">
              @if (kind === 'projects') {
                <a class="button" [routerLink]="'/projects/' + item.id + '/setups'">Visualizar setups</a>
              }
              <a class="button primary" [routerLink]="newUrl(childKind, item.id)">
                Adicionar {{ RESOURCE_CONFIG[childKind].singular.toLowerCase() }}
              </a>
            </div>
          </div>

          @if (childrenLoading()) {
            <p class="status">Carregando {{ RESOURCE_CONFIG[childKind].plural.toLowerCase() }}...</p>
          } @else if (childrenError()) {
            <p class="status error" role="alert">{{ childrenError() }}</p>
            <button class="button" type="button" (click)="loadChildren(item.id, childKind)">Tentar novamente</button>
          } @else if (children().length === 0) {
            <div class="empty-state compact">
              <p>Nenhum{{ childKind === 'images' ? 'a' : '' }} {{ RESOURCE_CONFIG[childKind].singular.toLowerCase() }} cadastrad{{ childKind === 'images' ? 'a' : 'o' }}.</p>
            </div>
          } @else {
            <div class="record-list">
              @for (child of children(); track child.id) {
                <a class="record-row" [routerLink]="detailUrl(childKind, child.id)">
                  <span class="record-icon">{{ RESOURCE_CONFIG[childKind].singular.charAt(0) }}</span>
                  <span class="record-main">
                    <strong>{{ child.code }}</strong>
                    <span>{{ child.description?.toLocaleUpperCase('pt-BR') || child.cpu || 'Visualizar detalhes' }}</span>
                  </span>
                  <span class="row-action">Visualizar <span aria-hidden="true">→</span></span>
                </a>
              }
            </div>
          }
        </section>
      }
    }
  `,
})
export class RecordDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly api = inject(ContainerApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kind = this.route.snapshot.data['kind'] as ResourceKind;
  protected readonly config = RESOURCE_CONFIG[this.kind];
  protected readonly RESOURCE_CONFIG = RESOURCE_CONFIG;
  protected readonly detailUrl = detailUrl;
  protected readonly newUrl = newUrl;
  protected readonly record = signal<ContainerRecord | null>(null);
  protected readonly definitionLines = computed(() => highlightDockerfile(this.record()?.definition ?? ''));
  protected readonly children = signal<ContainerRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly childrenLoading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal('');
  protected readonly childrenError = signal('');
  protected readonly actionError = signal('');

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set('');
    this.record.set(null);
    this.api.get(this.kind, id).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
        if (this.config.children) this.loadChildren(id, this.config.children);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  protected loadChildren(id: number, kind: ResourceKind): void {
    this.childrenLoading.set(true);
    this.childrenError.set('');
    this.api.listChildren(kind, id).subscribe({
      next: (children) => {
        this.children.set(children);
        this.childrenLoading.set(false);
      },
      error: (error) => {
        this.childrenError.set(apiError(error));
        this.childrenLoading.set(false);
      },
    });
  }

  protected remove(record: ContainerRecord): void {
    const message = `Excluir ${this.config.article} ${this.config.singular.toLowerCase()} “${record.code}”?`;
    if (!window.confirm(message)) return;
    this.deleting.set(true);
    this.actionError.set('');
    this.api.delete(this.kind, record.id).subscribe({
      next: () => {
        const parentId = this.parentId(record);
        void this.router.navigateByUrl(this.config.parent && parentId
          ? detailUrl(this.config.parent, parentId)
          : '/projects');
      },
      error: (error) => {
        this.actionError.set(apiError(error));
        this.deleting.set(false);
      },
    });
  }

  protected goBack(): void {
    this.location.back();
  }

  protected parentId(record: ContainerRecord): number {
    return Number(this.config.parentIdKey && record[this.config.parentIdKey]);
  }

  protected value(record: ContainerRecord, key: string): string {
    const value = String(record[key as keyof ContainerRecord] ?? '');
    if (!value && (key === 'port' || key === 'volume')) return 'Não configurado';
    return key === 'description' ? value.toLocaleUpperCase('pt-BR') : value;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }
}
