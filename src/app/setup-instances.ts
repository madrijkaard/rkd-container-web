import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { apiError, ContainerApi, InstanceRecord } from './container-api';

@Component({
  selector: 'app-setup-instances',
  styles: `
    .instance-table td:last-child { min-width: 80px; width: 80px; }
    .instance-delete { padding: 0.65rem; }
    .instance-delete svg { display: block; width: 20px; height: 20px; }
  `,
  template: `
    <section class="children-section" aria-label="Instâncias do setup">
      <div class="section-heading">
        <div>
          <p class="eyebrow">CONTAINERS DESTE SETUP</p>
          <h2>Instâncias</h2>
          <p class="muted">Cada instância é uma réplica do programa com as configurações deste setup.</p>
        </div>
        <button class="button primary" type="button" data-action="create-instance"
          [disabled]="creating() || deletingId() !== null || loading() || !!loadError()"
          (click)="create()">
          {{ creating() ? 'Criando instância...' : 'Criar instância' }}
        </button>
      </div>

      @if (notification()) {
        <p class="status" [class.error]="notificationIsError()"
          [attr.role]="notificationIsError() ? 'alert' : 'status'">{{ notification() }}</p>
      }
      @if (loading()) {
        <p class="status">Carregando instâncias...</p>
      } @else if (loadError()) {
        <p class="status error" role="alert">{{ loadError() }}</p>
        <button class="button" type="button" (click)="load()">Tentar novamente</button>
      } @else if (instances().length === 0) {
        <div class="empty-state compact"><p>Nenhuma instância criada para este setup.</p></div>
      } @else {
        <div class="table-wrapper">
          <table class="setup-table instance-table">
            <thead>
              <tr>
                <th scope="col">Código da instância</th>
                <th scope="col">Container</th>
                <th scope="col">Porta publicada</th>
                <th scope="col">Criada em</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (instance of instances(); track instance.id) {
                <tr>
                  <td><strong>{{ instance.code }}</strong></td>
                  <td><code [title]="instance.container_id">{{ instance.container_id.slice(0, 12) }}</code></td>
                  <td>{{ instance.port || 'Não informada' }}</td>
                  <td>{{ formatDate(instance.created_date) }}</td>
                  <td>
                    <button class="button danger instance-delete" type="button"
                      [attr.aria-label]="'Excluir instância ' + instance.code"
                      [title]="'Excluir instância ' + instance.code"
                      [disabled]="creating() || deletingId() !== null" (click)="remove(instance)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                      </svg>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class SetupInstances implements OnInit {
  readonly setupId = input.required<number>();
  readonly instancesChanged = output<void>();
  private readonly api = inject(ContainerApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly instances = signal<InstanceRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly creating = signal(false);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly notification = signal('');
  protected readonly notificationIsError = signal(false);

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.listInstances(this.setupId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (instances) => {
        this.instances.set(instances);
        this.loading.set(false);
      },
      error: (error) => {
        this.loadError.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  protected create(): void {
    if (this.creating() || this.deletingId() !== null || this.loading() || this.loadError()) return;
    this.creating.set(true);
    this.notification.set('');
    this.api.createInstance(this.setupId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (instance) => {
        this.instances.update((rows) => [...rows, instance].sort((a, b) => a.number - b.number));
        this.notificationIsError.set(false);
        this.notification.set(`Instância ${instance.code} criada.`);
        this.creating.set(false);
        this.instancesChanged.emit();
      },
      error: (error) => {
        this.notificationIsError.set(true);
        this.notification.set(apiError(error));
        this.creating.set(false);
      },
    });
  }

  protected remove(instance: InstanceRecord): void {
    if (this.creating() || this.deletingId() !== null) return;
    if (!window.confirm(`Excluir a instância “${instance.code}” e seu container Docker?`)) return;
    this.deletingId.set(instance.id);
    this.notification.set('');
    this.api.deleteInstance(instance.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.instances.update((rows) => rows.filter((row) => row.id !== instance.id));
        this.notificationIsError.set(false);
        this.notification.set(`Instância ${instance.code} excluída.`);
        this.deletingId.set(null);
        this.instancesChanged.emit();
      },
      error: (error) => {
        this.notificationIsError.set(true);
        this.notification.set(apiError(error));
        this.deletingId.set(null);
      },
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }
}
