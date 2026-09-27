import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, Subject, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import {
  apiError, ContainerApi, ContainerRecord, detailUrl, FieldConfig,
  RESOURCE_CONFIG, ResourceKind,
} from './container-api';
import { CodeInputDirective, normalizeCode } from './code-input.directive';
import { UppercaseInputDirective, uppercaseDescription } from './uppercase-input.directive';

@Component({
  selector: 'app-record-form-page',
  imports: [CodeInputDirective, UppercaseInputDirective, FormsModule, RouterLink],
  template: `
    <nav class="breadcrumbs" aria-label="Navegação">
      <a routerLink="/projects">Projetos</a>
      @if (config.parent && parentId()) {
        <span aria-hidden="true">/</span>
        <a [routerLink]="detailUrl(config.parent, parentId()!)">
          {{ RESOURCE_CONFIG[config.parent].singular }} {{ parent()?.code || '' }}
        </a>
      }
      <span aria-hidden="true">/</span>
      <span>{{ isEdit ? 'Editar' : 'Adicionar' }} {{ config.singular.toLowerCase() }}</span>
    </nav>

    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ config.singular }}</p>
        <h1>{{ isEdit ? 'Editar' : 'Adicionar' }} {{ config.singular.toLowerCase() }}</h1>
        <p class="muted">Preencha os campos para {{ isEdit ? 'atualizar' : 'cadastrar' }} o registro.</p>
      </div>
    </div>

    @if (loading()) {
      <p class="status">Carregando registro...</p>
    } @else if (loadError()) {
      <p class="status error" role="alert">{{ loadError() }}</p>
      <a class="button" routerLink="/projects">Voltar aos projetos</a>
    } @else {
      <form class="panel record-form" #recordForm="ngForm" (ngSubmit)="save()">
        @for (field of formFields; track field.key) {
          <div class="form-field">
            <label [for]="field.key">{{ field.label }}</label>
            @if (field.key === 'code') {
              <input
                appCodeInput [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                [attr.maxlength]="field.maxLength ?? null" pattern="[A-Z0-9_]+"
                autocapitalize="characters" autocomplete="off" spellcheck="false" required
              />
            } @else if (field.key === 'description') {
              <input
                appUppercaseInput [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                [attr.maxlength]="field.maxLength ?? null" required
              />
            } @else if (field.key === 'repository') {
              <input
                [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                (ngModelChange)="repositoryChanged($event)"
                [attr.maxlength]="field.maxLength ?? null" type="url"
                placeholder="https://github.com/owner/repo" autocomplete="url"
              />
            } @else if (field.key === 'isPrivate') {
              <input
                [id]="field.key" type="checkbox" [checked]="form['isPrivate'] === '1'"
                (change)="privateChanged($any($event.target).checked)"
              />
            } @else if (field.key === 'token') {
              <input
                [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                (ngModelChange)="tokenChanged()" type="password" autocomplete="off"
                [disabled]="form['isPrivate'] !== '1'"
                [placeholder]="savedTokenAvailable() ? 'Deixe vazio para manter o token salvo' : 'Token do GitHub'"
              />
            } @else if (field.key === 'branch') {
              <select
                [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                [disabled]="!form['repository'] || branchLoading() || !!branchError() || branchOptions().length === 0"
                [required]="!!form['repository']"
              >
                <option value="" disabled>
                  {{ branchLoading() ? 'Consultando branches...' : 'Selecione uma branch' }}
                </option>
                @for (branch of branchOptions(); track branch) {
                  <option [value]="branch">{{ branch }}</option>
                }
              </select>
            } @else if (field.multiline) {
              <textarea
                [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                [attr.maxlength]="field.maxLength ?? null" rows="8" required
              ></textarea>
            } @else if (field.key === 'cpu') {
              <div class="field-control-row">
                <select
                  [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                  [disabled]="cpuLoading()" [attr.aria-describedby]="cpuHelpOpen() ? 'cpu-help' : null"
                  required
                >
                  <option value="" disabled>Selecione a quantidade de CPU</option>
                  @for (option of cpuChoices(); track option) {
                    <option [value]="option">{{ formatCpu(option) }} CPU</option>
                  }
                </select>
                <button
                  class="field-info-button" type="button" aria-label="Informações sobre CPU"
                  aria-controls="cpu-help" [attr.aria-expanded]="cpuHelpOpen()"
                  (click)="cpuHelpOpen.set(!cpuHelpOpen())"
                >i</button>
              </div>
              @if (cpuHelpOpen()) {
                <div class="field-help" id="cpu-help" role="note">
                  O valor limita o tempo de processamento do container. Por exemplo, 0,5 CPU
                  equivale a metade da capacidade de uma CPU lógica; 2 CPUs permitem até o
                  equivalente a duas CPUs lógicas. O Docker pode distribuir esse uso entre
                  núcleos e não reserva CPUs específicas.
                  @if (maxCpu() > 0) {
                    <strong>O limite atual desta máquina para containers é {{ maxCpu() }} CPUs lógicas.</strong>
                    @if (cpuSource() === 'host') {
                      <span>O Docker está indisponível; esse limite foi obtido do sistema e será conferido novamente ao iniciar o container.</span>
                    }
                  } @else {
                    <span>Consultando o limite da máquina...</span>
                  }
                </div>
              }
            } @else if (field.key === 'memory') {
              <div class="field-control-row">
                <select
                  [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                  [disabled]="memoryLoading()" [attr.aria-describedby]="memoryHelpOpen() ? 'memory-help' : null"
                  required
                >
                  <option value="" disabled>Selecione o limite de memória</option>
                  @for (option of memoryChoices(); track option) {
                    <option [value]="option">{{ formatMemoryOption(option) }}</option>
                  }
                </select>
                <button
                  class="field-info-button" type="button" aria-label="Informações sobre memória"
                  aria-controls="memory-help" [attr.aria-expanded]="memoryHelpOpen()"
                  (click)="memoryHelpOpen.set(!memoryHelpOpen())"
                >i</button>
              </div>
              @if (memoryHelpOpen()) {
                <div class="field-help" id="memory-help" role="note">
                  A memória define o máximo de RAM que o container pode usar; ela não é reservada
                  antecipadamente. Se o processo ultrapassar o limite, ele pode ser encerrado por
                  falta de memória. O máximo do seletor corresponde à capacidade total, não à RAM
                  livre neste momento.
                  @if (maxMemoryBytes() > 0) {
                    <strong>Capacidade atual para containers: {{ memoryCapacityLabel() }}.</strong>
                    @if (memorySource() === 'host') {
                      <span>O Docker está indisponível; esse valor veio do sistema e será conferido novamente ao iniciar o container.</span>
                    }
                  } @else {
                    <span>Consultando o limite da máquina...</span>
                  }
                </div>
              }
            } @else {
              <input
                [id]="field.key" [name]="field.key" [(ngModel)]="form[field.key]"
                [attr.maxlength]="field.maxLength ?? null" [required]="!field.optional"
              />
            }
            @if (field.key === 'code') {
              <small>Somente letras maiúsculas, números e _; sem espaços. Máximo de 100 caracteres.</small>
            } @else if (field.key === 'description') {
              <small>Texto livre, convertido para maiúsculas. Máximo de 256 caracteres.</small>
            } @else if (field.key === 'repository') {
              <small>Opcional. URL do GitHub. Ex.: https://github.com/madrijkaard/rkd-survivor-engine.</small>
            } @else if (field.key === 'isPrivate') {
              <small>Marque para consultar e baixar um repositório privado com token.</small>
            } @else if (field.key === 'token') {
              <small>O token é enviado ao backend e não aparece novamente após salvar.</small>
            } @else if (field.key === 'branch') {
              @if (branchError()) {
                <small class="field-error" role="alert">{{ branchError() }}</small>
              } @else if (form['repository'] && !branchLoading() && branchOptions().length === 0) {
                <small>Nenhuma branch disponível neste repositório.</small>
              } @else {
                <small>Selecione uma branch do repositório informado.</small>
              }
            } @else if (field.key === 'cpu') {
              <small>
                @if (cpuLoading()) { Consultando CPUs disponíveis... }
                @else { Opções de 0,5 em 0,5 CPU, até {{ maxCpu() }} CPUs lógicas. }
              </small>
              @if (cpuExceedsLimit()) {
                <small class="field-error" role="alert">O valor anterior excede o limite atual. Selecione outro valor.</small>
              }
            } @else if (field.key === 'memory') {
              <small>
                @if (memoryLoading()) { Consultando memória disponível... }
                @else { Selecione até {{ memoryCapacityLabel() }} de memória total. }
              </small>
              @if (memoryInvalidSelection()) {
                <small class="field-error" role="alert">O valor anterior é inválido ou excede o limite atual. Selecione outro valor.</small>
              }
            } @else if (field.key === 'port') {
              <small>Opcional. Porta do host:porta do container. Ex.: 8000:8000. Sem IP, publica apenas em 127.0.0.1.</small>
            } @else if (field.key === 'volume') {
              <small>Opcional. Volume nomeado:caminho no container. Ex.: backend_data:/data.</small>
            } @else if (field.maxLength) {
              <small>Máximo de {{ field.maxLength }} caracteres.</small>
            }
          </div>
        }

        @if (saveError()) { <p class="status error" role="alert">{{ saveError() }}</p> }
        <div class="form-actions">
          <a class="button" [routerLink]="cancelUrl()">Cancelar</a>
          <button class="button primary" type="submit" [disabled]="saving() || recordForm.invalid || !branchValid() || (kind === 'setups' && (cpuLoading() || cpuExceedsLimit() || memoryLoading() || memoryInvalidSelection()))">
            {{ saving() ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Cadastrar') }}
          </button>
        </div>
      </form>
    }
  `,
})
export class RecordFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ContainerApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repositoryChanges = new Subject<{
    repository: string; selectedBranch: string; token?: string; imageId?: number; missingToken: boolean;
  }>();
  private savedRepository = '';
  private savedHasToken = false;
  private editingImageId: number | undefined;

  protected readonly kind = this.route.snapshot.data['kind'] as ResourceKind;
  protected readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  protected readonly config = RESOURCE_CONFIG[this.kind];
  protected readonly RESOURCE_CONFIG = RESOURCE_CONFIG;
  protected readonly detailUrl = detailUrl;
  protected readonly formFields: FieldConfig[] = [
    { key: 'code', label: 'Código', maxLength: 100 },
    ...this.config.fields,
  ];
  protected readonly form: Record<string, string> = {};
  protected readonly parentId = signal<number | null>(null);
  protected readonly parent = signal<ContainerRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal('');
  protected readonly saveError = signal('');
  protected readonly branchLoading = signal(false);
  protected readonly branchError = signal('');
  protected readonly branchOptions = signal<string[]>([]);
  protected readonly cpuLoading = signal(false);
  protected readonly maxCpu = signal(0);
  protected readonly cpuSource = signal<'docker' | 'host'>('host');
  protected readonly cpuHelpOpen = signal(false);
  private readonly cpuOptions = signal<string[]>([]);
  protected readonly memoryLoading = signal(false);
  protected readonly maxMemoryBytes = signal(0);
  protected readonly memorySource = signal<'docker' | 'host'>('host');
  protected readonly memoryHelpOpen = signal(false);
  private readonly memoryOptions = signal<string[]>([]);

  ngOnInit(): void {
    for (const field of this.formFields) this.form[field.key] = '';
    if (this.kind === 'images') this.form['isPrivate'] = '0';
    if (this.kind === 'images') {
      this.repositoryChanges.pipe(
        switchMap(({ repository, selectedBranch, token, imageId, missingToken }) => !repository
          ? of({ branches: [] as string[], selectedBranch: '', error: '' })
          : missingToken
          ? of({ branches: [] as string[], selectedBranch: '', error: 'Informe o token para consultar as branches.' })
          : timer(350).pipe(
              switchMap(() => this.api.listGithubBranches(repository, token, imageId)),
              map(({ branches }) => ({ branches, selectedBranch, error: '' })),
              catchError((error) => of({ branches: [] as string[], selectedBranch: '', error: apiError(error) })),
            )),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(({ branches, selectedBranch, error }) => {
        this.branchOptions.set(branches);
        this.branchError.set(error || (selectedBranch && !branches.includes(selectedBranch)
          ? 'A branch salva não está mais disponível. Selecione outra.' : ''));
        this.form['branch'] = branches.includes(selectedBranch) ? selectedBranch : '';
        this.branchLoading.set(false);
      });
    }
    if (this.kind === 'setups') {
      this.loadCpuCapacity();
      this.loadMemoryCapacity();
    }
    if (this.isEdit) {
      this.loading.set(true);
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.api.get(this.kind, id).subscribe({
        next: (record) => {
          for (const field of this.formFields) {
            const value = String(record[field.key as keyof ContainerRecord] ?? '');
            this.form[field.key] = field.key === 'code'
              ? normalizeCode(value)
              : field.key === 'description' ? uppercaseDescription(value) : value;
          }
          if (this.kind === 'images') {
            this.savedRepository = record.repository ?? '';
            this.savedHasToken = !!record.hasToken;
            this.editingImageId = id;
            this.form['token'] = '';
          }
          if (this.kind === 'images' && this.form['repository']) {
            this.refreshBranches(this.form['repository'], this.form['branch']);
          }
          if (this.config.parentIdKey) {
            const parentId = Number(record[this.config.parentIdKey]);
            this.parentId.set(parentId);
            this.loadParent(parentId);
          }
          this.loading.set(false);
        },
        error: (error) => {
          this.loadError.set(apiError(error));
          this.loading.set(false);
        },
      });
    } else if (this.config.parent) {
      const parentId = Number(this.route.snapshot.paramMap.get('parentId'));
      this.parentId.set(parentId);
      this.loadParent(parentId);
    }
  }

  protected repositoryChanged(repository: string): void {
    this.refreshBranches(repository, '');
  }

  protected privateChanged(checked: boolean): void {
    this.form['isPrivate'] = checked ? '1' : '0';
    this.form['token'] = '';
    this.refreshBranches(this.form['repository'] ?? '', '');
  }

  protected tokenChanged(): void {
    this.refreshBranches(this.form['repository'] ?? '', '');
  }

  protected savedTokenAvailable(): boolean {
    return this.savedHasToken && this.form['repository'] === this.savedRepository;
  }

  private refreshBranches(repository: string, selectedBranch: string): void {
    this.branchOptions.set([]);
    this.branchError.set('');
    const isPrivate = this.form['isPrivate'] === '1';
    const token = isPrivate ? this.form['token']?.trim() : undefined;
    const imageId = isPrivate && !token && this.savedTokenAvailable()
      ? this.editingImageId : undefined;
    const missingToken = isPrivate && !token && !imageId;
    this.branchLoading.set(!!repository.trim() && !missingToken);
    this.form['branch'] = selectedBranch;
    this.repositoryChanges.next({ repository: repository.trim(), selectedBranch, token, imageId, missingToken });
  }

  protected branchValid(): boolean {
    if (this.kind !== 'images') return true;
    if (this.form['isPrivate'] === '1'
      && (!this.form['repository']?.trim() || (!this.form['token']?.trim() && !this.savedTokenAvailable()))) return false;
    if (!this.form['repository']?.trim()) return !this.form['branch'];
    return !this.branchLoading() && !this.branchError()
      && this.branchOptions().includes(this.form['branch']);
  }

  private loadCpuCapacity(): void {
    this.cpuLoading.set(true);
    this.api.getCpuCapacity().subscribe({
      next: ({ max_cpu, source }) => {
        if (!Number.isSafeInteger(max_cpu) || max_cpu < 1) {
          this.loadError.set('Não foi possível determinar o limite de CPU desta máquina.');
        } else {
          this.maxCpu.set(max_cpu);
          this.cpuSource.set(source);
          this.cpuOptions.set(Array.from({ length: max_cpu * 2 }, (_, index) => String((index + 1) / 2)));
        }
        this.cpuLoading.set(false);
      },
      error: (error) => {
        this.loadError.set(`Não foi possível consultar o limite de CPU. ${apiError(error)}`);
        this.cpuLoading.set(false);
      },
    });
  }

  protected cpuChoices(): string[] {
    const choices = this.cpuOptions();
    const current = this.form['cpu'];
    if (current && !choices.includes(current) && !this.cpuExceedsLimit()) {
      return [...choices, current].sort((a, b) => Number(a) - Number(b));
    }
    return choices;
  }

  protected formatCpu(value: string): string {
    return value.replace('.', ',');
  }

  protected cpuExceedsLimit(): boolean {
    const value = Number((this.form['cpu'] ?? '').replace(',', '.'));
    return this.maxCpu() > 0 && value > this.maxCpu();
  }

  private loadMemoryCapacity(): void {
    this.memoryLoading.set(true);
    this.api.getMemoryCapacity().subscribe({
      next: ({ max_memory_bytes, source }) => {
        if (!Number.isSafeInteger(max_memory_bytes) || max_memory_bytes < 6 * 1024 ** 2) {
          this.loadError.set('Não foi possível determinar o limite de memória desta máquina.');
        } else {
          this.maxMemoryBytes.set(max_memory_bytes);
          this.memorySource.set(source);
          this.memoryOptions.set(this.buildMemoryOptions(Math.floor(max_memory_bytes / 1024 ** 2)));
        }
        this.memoryLoading.set(false);
      },
      error: (error) => {
        this.loadError.set(`Não foi possível consultar o limite de memória. ${apiError(error)}`);
        this.memoryLoading.set(false);
      },
    });
  }

  private buildMemoryOptions(maxMb: number): string[] {
    const values = [6, 16, 32, 64, 128, 256].filter((value) => value <= maxMb);
    let next = 384;
    while (next < maxMb && values.length < 200) {
      values.push(next);
      next += next < 1024 ? 128 : next < 4096 ? 256 : next < 16384 ? 512 :
        next < 65536 ? 1024 : Math.max(2048, Math.ceil(maxMb / 100 / 1024) * 1024);
    }
    if (!values.includes(maxMb)) values.push(maxMb);
    return values.map((value) => value >= 1024 && value % 128 === 0
      ? `${value / 1024} GB` : `${value} MB`);
  }

  protected memoryChoices(): string[] {
    const choices = this.memoryOptions();
    const current = this.form['memory'];
    if (current && !choices.includes(current) && !this.memoryInvalidSelection()) {
      return [...choices, current].sort((a, b) => this.memoryBytes(a) - this.memoryBytes(b));
    }
    return choices;
  }

  protected formatMemoryOption(value: string): string {
    return value.replace('.', ',');
  }

  protected memoryCapacityLabel(): string {
    const mb = Math.floor(this.maxMemoryBytes() / 1024 ** 2);
    if (mb < 1024) return `${mb} MB`;
    const gb = Math.floor(mb / 1024 * 100) / 100;
    return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
  }

  private memoryBytes(value: string): number {
    const match = /^\s*(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|K|M|G)\s*$/i.exec(value);
    if (!match) return Number.NaN;
    const units: Record<string, number> = {
      B: 1, K: 1024, KB: 1024, M: 1024 ** 2, MB: 1024 ** 2,
      G: 1024 ** 3, GB: 1024 ** 3,
    };
    return Number(match[1].replace(',', '.')) * units[match[2].toUpperCase()];
  }

  protected memoryInvalidSelection(): boolean {
    const value = this.form['memory'];
    if (!value || this.maxMemoryBytes() === 0) return false;
    const bytes = this.memoryBytes(value);
    return !Number.isFinite(bytes) || bytes < 6 * 1024 ** 2 || bytes > this.maxMemoryBytes();
  }

  private loadParent(id: number): void {
    if (!this.config.parent) return;
    this.api.get(this.config.parent, id).subscribe({
      next: (record) => this.parent.set(record),
      error: (error) => this.loadError.set(apiError(error)),
    });
  }

  protected cancelUrl(): string {
    if (this.isEdit) return detailUrl(this.kind, Number(this.route.snapshot.paramMap.get('id')));
    return this.config.parent && this.parentId()
      ? detailUrl(this.config.parent, this.parentId()!)
      : '/projects';
  }

  protected save(): void {
    if (this.saving() || (this.kind === 'setups' &&
      (this.cpuLoading() || this.cpuExceedsLimit() || this.memoryLoading() || this.memoryInvalidSelection()))
      || !this.branchValid()) return;
    this.form['code'] = normalizeCode(this.form['code'] ?? '');
    if ('description' in this.form) {
      this.form['description'] = uppercaseDescription(this.form['description']);
    }
    if (!this.form['code']) {
      this.saveError.set('Informe um código com letras, números ou _.');
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    const operation = this.isEdit
      ? this.api.update(this.kind, Number(this.route.snapshot.paramMap.get('id')), this.form)
      : this.api.create(this.kind, this.form, this.parentId() ?? undefined);
    operation.subscribe({
      next: (record) => { void this.router.navigateByUrl(detailUrl(this.kind, record.id)); },
      error: (error) => {
        this.saveError.set(apiError(error));
        this.saving.set(false);
      },
    });
  }
}
