import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export type ResourceKind = 'projects' | 'environments' | 'images' | 'setups';

export interface ContainerRecord {
  id: number;
  code: string;
  created_date: string;
  created_by: string;
  last_modified_date: string;
  last_modified_by: string | null;
  description?: string;
  definition?: string;
  repository?: string;
  branch?: string;
  isPrivate?: number;
  hasToken?: boolean;
  cpu?: string;
  memory?: string;
  port?: string;
  volume?: string;
  project_id?: number;
  environment_id?: number;
  image_id?: number;
}

export interface ProjectSetupRow {
  id: number;
  setup_code: string;
  image_code: string;
  environment_code: string;
}

export interface ContainerCreationResult {
  container_id: string;
  container_name: string;
}

export interface CpuCapacity {
  max_cpu: number;
  source: 'docker' | 'host';
}

export interface MemoryCapacity {
  max_memory_bytes: number;
  source: 'docker' | 'host';
}

export interface FieldConfig {
  key: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  optional?: boolean;
}

export interface ResourceConfig {
  singular: string;
  plural: string;
  article: string;
  fields: FieldConfig[];
  parent?: ResourceKind;
  parentIdKey?: keyof ContainerRecord;
  children?: ResourceKind;
}

export const RESOURCE_CONFIG: Record<ResourceKind, ResourceConfig> = {
  projects: {
    singular: 'Projeto', plural: 'Projetos', article: 'o', children: 'environments',
    fields: [{ key: 'description', label: 'Descrição', maxLength: 256 }],
  },
  environments: {
    singular: 'Ambiente', plural: 'Ambientes', article: 'o',
    parent: 'projects', parentIdKey: 'project_id', children: 'images',
    fields: [{ key: 'description', label: 'Descrição', maxLength: 256 }],
  },
  images: {
    singular: 'Imagem', plural: 'Imagens', article: 'a',
    parent: 'environments', parentIdKey: 'environment_id', children: 'setups',
    fields: [
      { key: 'description', label: 'Descrição', maxLength: 256 },
      { key: 'repository', label: 'Repositório GitHub', maxLength: 256, optional: true },
      { key: 'isPrivate', label: 'É um repositório privado?' },
      { key: 'token', label: 'Token', optional: true },
      { key: 'branch', label: 'Branch', maxLength: 256, optional: true },
      { key: 'definition', label: 'Definição', multiline: true },
    ],
  },
  setups: {
    singular: 'Setup', plural: 'Setups', article: 'o',
    parent: 'images', parentIdKey: 'image_id',
    fields: [
      { key: 'cpu', label: 'CPU', maxLength: 15 },
      { key: 'memory', label: 'Memória', maxLength: 15 },
      { key: 'port', label: 'Porta', maxLength: 50, optional: true },
      { key: 'volume', label: 'Volume', maxLength: 255, optional: true },
    ],
  },
};

export function detailUrl(kind: ResourceKind, id: number): string {
  return `/${kind}/${id}`;
}

export function newUrl(kind: ResourceKind, parentId?: number): string {
  if (kind === 'projects') return '/projects/new';
  const parent = RESOURCE_CONFIG[kind].parent;
  return `/${parent}/${parentId}/${kind}/new`;
}

export function apiError(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Não foi possível conectar ao Container Core. Verifique se o servidor Django está em execução.';
  const body = error.error;
  if (body?.code === 'docker_unavailable') return 'O Docker está desligado ou indisponível. Inicie o Docker e tente novamente.';
  if (body?.code === 'invalid_resources') return 'CPU ou memória inválida. Revise os valores do setup.';
  if (body?.code === 'invalid_configuration') return body.error || 'Porta ou volume inválido. Revise o setup.';
  if (body?.code === 'invalid_definition') return 'A definição da imagem está vazia.';
  if (body?.code === 'docker_build_failed') return 'Não foi possível construir a imagem Docker. Revise a definição da imagem.';
  if (body?.code === 'container_start_failed') return 'A imagem foi construída, mas não foi possível iniciar o container.';
  if (body?.code === 'associated_records') return 'Não é possível excluir este registro porque existem registros associados.';
  if (body?.code === 'authentication_required') return 'Faça login para continuar.';
  if (body?.code === 'permission_denied') return 'Seu usuário não tem permissão para usar esta operação.';
  if (['invalid_repository', 'repository_not_found', 'github_rate_limited', 'github_unavailable', 'github_invalid_token',
      'github_access_denied', 'too_many_branches', 'token_unavailable', 'repository_clone_failed', 'git_unavailable'].includes(body?.code)) {
    return body.error;
  }
  if (body?.errors && typeof body.errors === 'object') {
    const fieldLabels: Record<string, string> = {
      code: 'Código',
      description: 'Descrição',
      definition: 'Definição',
      repository: 'Repositório GitHub',
      branch: 'Branch',
      isPrivate: 'Repositório privado',
      token: 'Token',
      cpu: 'CPU',
      memory: 'Memória',
      port: 'Porta',
      volume: 'Volume',
    };
    const fields = Object.keys(body.errors).map((field) => fieldLabels[field] ?? 'dados');
    return `Verifique os campos: ${fields.join(', ')}.`;
  }
  if (error.status === 403) return 'A operação foi recusada. Atualize a página e tente novamente.';
  if (error.status === 404) return 'Registro não encontrado.';
  if (error.status === 415) return 'A requisição deve enviar dados JSON.';
  if (error.status === 400) return 'Dados inválidos. Revise os campos e tente novamente.';
  return `Não foi possível concluir a operação (HTTP ${error.status}).`;
}

@Injectable({ providedIn: 'root' })
export class ContainerApi {
  private readonly http = inject(HttpClient);

  getSession() {
    return this.http.get<{ authenticated: boolean; username: string; turnstileRequired: boolean; turnstileSiteKey: string }>('/api/auth/session/');
  }

  login(username: string, password: string, turnstileToken: string) {
    return this.http.post<{ authenticated: boolean; username: string }>('/api/auth/login/', {
      username, password, turnstileToken,
    });
  }

  logout() {
    return this.http.post<{ authenticated: boolean }>('/api/auth/logout/', {});
  }

  listGithubBranches(repository: string, token?: string, imageId?: number) {
    if (token || imageId) {
      return this.http.post<{ branches: string[] }>('/api/github/branches/', {
        repository, ...(token ? { token } : { image_id: imageId }),
      });
    }
    return this.http.get<{ branches: string[] }>('/api/github/branches/', { params: { repository } });
  }

  getCpuCapacity() {
    return this.http.get<CpuCapacity>('/api/system/cpu/');
  }

  getMemoryCapacity() {
    return this.http.get<MemoryCapacity>('/api/system/memory/');
  }

  listProjects() {
    return this.http.get<ContainerRecord[]>('/api/projects/');
  }

  listProjectSetups(projectId: number) {
    return this.http.get<ProjectSetupRow[]>(`/api/projects/${projectId}/setups/`);
  }

  createContainer(setupId: number) {
    return this.http.post<ContainerCreationResult>(`/api/setups/${setupId}/containers/`, {});
  }

  listChildren(kind: ResourceKind, parentId: number) {
    const parent = RESOURCE_CONFIG[kind].parent;
    return this.http.get<ContainerRecord[]>(`/api/${parent}/${parentId}/${kind}/`);
  }

  get(kind: ResourceKind, id: number) {
    return this.http.get<ContainerRecord>(`/api/${kind}/${id}/`);
  }

  create(kind: ResourceKind, data: Record<string, string>, parentId?: number) {
    const path = kind === 'projects'
      ? '/api/projects/'
      : `/api/${RESOURCE_CONFIG[kind].parent}/${parentId}/${kind}/`;
    return this.http.post<ContainerRecord>(path, data);
  }

  update(kind: ResourceKind, id: number, data: Record<string, string>) {
    return this.http.put<ContainerRecord>(`/api/${kind}/${id}/`, data);
  }

  delete(kind: ResourceKind, id: number) {
    return this.http.delete<{ deleted: boolean }>(`/api/${kind}/${id}/`);
  }
}
