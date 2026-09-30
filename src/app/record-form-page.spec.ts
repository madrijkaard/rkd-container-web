import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { imageCodeFromRepository, RecordFormPage } from './record-form-page';

describe('image code from repository', () => {
  it('uses the repository name in uppercase with underscores', () => {
    expect(imageCodeFromRepository('https://github.com/madrijkaard/rkd-survivor-engine'))
      .toBe('RKD_SURVIVOR_ENGINE');
    expect(imageCodeFromRepository('https://github.com/owner/my.repo.git'))
      .toBe('MY_REPO');
    expect(imageCodeFromRepository('https://example.com/owner/repo')).toBe('');
  });
});

describe('RecordFormPage resource selection', () => {
  async function renderSetup(mode: 'create' | 'edit' = 'create') {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'setups', mode },
              paramMap: convertToParamMap(mode === 'edit' ? { id: '7' } : { parentId: '3' }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/system/cpu/').flush({ max_cpu: 4, source: 'docker' });
    http.expectOne('/api/system/memory/').flush({ max_memory_bytes: 4 * 1024 ** 3, source: 'docker' });
    if (mode === 'edit') {
      http.expectOne('/api/setups/7/').flush({
        id: 7, code: 'EXISTING_SETUP', image_id: 3, cpu: '1', memory: '256 MB', port: '4173:4173',
      });
    }
    http.expectOne('/api/images/3/').flush({ id: 3, code: 'IMAGE' });
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    async function change(id: string, value: string) {
      const control = page.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      control.value = value;
      control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return { fixture, http, page, change, code: page.querySelector<HTMLInputElement>('#code')! };
  }

  it('generates a disabled setup code progressively and sends it when creating the setup', async () => {
    const { fixture, http, page, change, code } = await renderSetup();
    expect(code.disabled).toBe(true);
    expect(code.value).toBe('');
    await change('cpu', '0.5');
    expect(code.value).toBe('CPU_05');
    await change('memory', '256 MB');
    expect(code.value).toBe('CPU_05_MEMORY_256MB');
    await change('port', '4173:4173');
    expect(code.value).toBe('CPU_05_MEMORY_256MB_PORT_4173');
    expect(code.disabled).toBe(true);
    const submit = page.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    submit.click();
    const request = http.expectOne('/api/images/3/setups/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      code: 'CPU_05_MEMORY_256MB_PORT_4173', cpu: '0.5', memory: '256 MB', port: '4173:4173',
    });
    request.flush({ errors: {} }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    http.verify();
  });

  it('rebuilds the generated code on changes, uses the host port and omits a cleared optional port', async () => {
    const { http, change, code } = await renderSetup();
    await change('port', '127.0.0.1:9000:4173');
    expect(code.value).toBe('PORT_9000');
    await change('memory', '1 GB');
    await change('cpu', '1.5');
    expect(code.value).toBe('CPU_15_MEMORY_1GB_PORT_9000');
    await change('cpu', '2');
    await change('memory', '256 MB');
    await change('port', '');
    expect(code.value).toBe('CPU_2_MEMORY_256MB');
    http.verify();
  });

  it('rebuilds the setup code from CPU, memory and port when editing', async () => {
    const { fixture, http, page, change, code } = await renderSetup('edit');
    expect(code.disabled).toBe(true);
    expect(code.value).toBe('CPU_1_MEMORY_256MB_PORT_4173');
    await change('cpu', '0.5');
    expect(code.value).toBe('CPU_05_MEMORY_256MB_PORT_4173');
    await change('memory', '1 GB');
    expect(code.value).toBe('CPU_05_MEMORY_1GB_PORT_4173');
    await change('port', '127.0.0.1:9000:4173');
    expect(code.value).toBe('CPU_05_MEMORY_1GB_PORT_9000');
    await change('port', '');
    expect(code.value).toBe('CPU_05_MEMORY_1GB');
    (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    const request = http.expectOne('/api/setups/7/');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toMatchObject({
      code: 'CPU_05_MEMORY_1GB', cpu: '0.5', memory: '1 GB', port: '',
    });
    request.flush({ code: 'setup_has_instances' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    http.verify();
  });

  it('does not show the edit form for a setup with instances', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'setups', mode: 'edit' },
              paramMap: convertToParamMap({ id: '7' }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/system/cpu/').flush({ max_cpu: 4, source: 'docker' });
    http.expectOne('/api/system/memory/').flush({ max_memory_bytes: 4 * 1024 ** 3, source: 'docker' });
    http.expectOne('/api/setups/7/').flush({
      id: 7, code: 'SERVER', image_id: 3, cpu: '1', memory: '512 MB', hasInstances: true,
    });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('form')).toBeNull();
    expect(page.textContent).toContain('não pode ser editado enquanto tiver instâncias');
    http.verify();
  });

  it('explains a conflict if an instance is created after the edit form loads', async () => {
    const { fixture, http, page } = await renderSetup('edit');
    (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    http.expectOne('/api/setups/7/').flush(
      { code: 'setup_has_instances' }, { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent)
      .toContain('Exclua todas as instâncias deste setup');
    http.verify();
  });

  it('uses the current CPU and memory capacities and explains their limits', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'setups', mode: 'new' },
              paramMap: convertToParamMap({ parentId: '3' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/system/cpu/').flush({ max_cpu: 4, source: 'docker' });
    http.expectOne('/api/system/memory/').flush({ max_memory_bytes: 4 * 1024 ** 3, source: 'docker' });
    http.expectOne('/api/images/3/').flush({ id: 3, code: 'BACKEND' });
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const options = [...page.querySelectorAll<HTMLSelectElement>('#cpu option')];
    expect(options.map((option) => option.value)).toEqual([
      '', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4',
    ]);
    expect(options[1].textContent).toContain('0,5 CPU');

    const helpButton = page.querySelector('.field-info-button') as HTMLButtonElement;
    helpButton.click();
    fixture.detectChanges();
    expect(helpButton.getAttribute('aria-expanded')).toBe('true');
    expect(page.querySelector('#cpu-help')?.textContent).toContain('limite atual desta máquina para containers é 4 CPUs lógicas');
    expect(page.querySelector('#cpu-help')?.textContent).toContain('não reserva CPUs específicas');

    const memoryOptions = [...page.querySelectorAll<HTMLSelectElement>('#memory option')];
    expect(memoryOptions.at(-1)?.value).toBe('4 GB');
    expect(memoryOptions.some((option) => option.value === '4.5 GB')).toBe(false);
    const memoryHelp = page.querySelector('[aria-label="Informações sobre memória"]') as HTMLButtonElement;
    memoryHelp.click();
    fixture.detectChanges();
    expect(page.querySelector('#memory-help')?.textContent).toContain('capacidade total, não à RAM');
    http.verify();
  });

  it('loads GitHub branches and clears the selection when the repository changes', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'images', mode: 'create' },
              paramMap: convertToParamMap({ parentId: '3' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/environments/3/').flush({ id: 3, code: 'DEV' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const repository = page.querySelector<HTMLInputElement>('#repository')!;
    const code = page.querySelector<HTMLInputElement>('#code')!;
    const description = page.querySelector<HTMLInputElement>('#description')!;
    const branch = page.querySelector<HTMLSelectElement>('#branch')!;
    expect(branch.disabled).toBe(true);
    expect(code.disabled).toBe(false);

    repository.value = 'https://github.com/madrijkaard/rkd-survivor-engine';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(code.value).toBe('RKD_SURVIVOR_ENGINE');
    expect(code.disabled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne((request) => request.url === '/api/github/branches/'
      && request.params.get('repository') === repository.value)
      .flush({ branches: ['main', 'develop'] });
    http.expectOne((request) => request.url === '/api/github/description/'
      && request.params.get('repository') === repository.value)
      .flush({ description: 'A survivor game engine' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect([...branch.options].map((option) => option.value)).toEqual(['', 'main', 'develop']);
    expect(branch.disabled).toBe(false);
    expect(description.value).toBe('A SURVIVOR GAME ENGINE');

    branch.value = 'develop';
    branch.dispatchEvent(new Event('change', { bubbles: true }));
    repository.value = 'https://github.com/owner/another';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(code.value).toBe('ANOTHER');
    expect(description.value).toBe('');
    expect(branch.value).toBe('');
    expect(branch.disabled).toBe(true);
    description.value = 'Meu texto';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne((request) => request.url === '/api/github/branches/'
      && request.params.get('repository') === repository.value)
      .flush({ branches: ['release'] });
    http.expectOne((request) => request.url === '/api/github/description/'
      && request.params.get('repository') === repository.value)
      .flush({ description: 'Another project' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect([...branch.options].map((option) => option.value)).toEqual(['', 'release']);
    expect(description.value).toBe('MEU TEXTO');
    branch.value = 'release';
    branch.dispatchEvent(new Event('change', { bubbles: true }));
    const definition = page.querySelector<HTMLTextAreaElement>('#definition')!;
    definition.value = 'FROM alpine';
    definition.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const save = http.expectOne('/api/environments/3/images/');
    expect(save.request.body).toMatchObject({
      code: 'ANOTHER', description: 'MEU TEXTO', repository: repository.value, branch: 'release',
    });
    save.flush({ errors: {} }, { status: 400, statusText: 'Bad Request' });
    http.verify();
  });

  it('sends a private token in the request body and clears branches when it changes', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'images', mode: 'create' },
              paramMap: convertToParamMap({ parentId: '3' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/environments/3/').flush({ id: 3, code: 'DEV' });
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const repository = page.querySelector<HTMLInputElement>('#repository')!;
    const privateCheckbox = page.querySelector<HTMLInputElement>('#isPrivate')!;
    const token = page.querySelector<HTMLInputElement>('#token')!;
    const branch = page.querySelector<HTMLSelectElement>('#branch')!;
    expect(token.disabled).toBe(true);

    privateCheckbox.click();
    repository.value = 'https://github.com/owner/private-repo';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(token.disabled).toBe(false);
    expect(branch.disabled).toBe(true);
    expect(page.textContent).toContain('Informe o token para consultar as branches.');
    http.expectNone('/api/github/branches/');
    http.expectNone('/api/github/description/');

    token.value = 'secret-token';
    token.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const request = http.expectOne('/api/github/branches/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ repository: repository.value, token: 'secret-token' });
    expect(request.request.urlWithParams).not.toContain('secret-token');
    request.flush({ branches: ['main'] });
    const descriptionRequest = http.expectOne('/api/github/description/');
    expect(descriptionRequest.request.method).toBe('POST');
    expect(descriptionRequest.request.body).toEqual({ repository: repository.value, token: 'secret-token' });
    expect(descriptionRequest.request.urlWithParams).not.toContain('secret-token');
    descriptionRequest.flush({ description: 'Private repository' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(branch.disabled).toBe(false);

    token.value = 'replacement-token';
    token.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(branch.disabled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne('/api/github/branches/').flush({ branches: ['release'] });
    http.expectOne('/api/github/description/').flush({ description: 'Updated About' });
    http.verify();
  });

  it('loads saved private branches without returning the saved token to the browser', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kind: 'images', mode: 'edit' },
              paramMap: convertToParamMap({ id: '7' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordFormPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/images/7/').flush({
      id: 7, code: 'PRIVATE', description: 'Private', definition: 'FROM alpine',
      environment_id: 3, repository: 'https://github.com/owner/private-repo',
      branch: 'main', isPrivate: 1, hasToken: true,
    });
    http.expectOne('/api/environments/3/').flush({ id: 3, code: 'DEV' });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const request = http.expectOne('/api/github/branches/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      repository: 'https://github.com/owner/private-repo', image_id: 7,
    });
    request.flush({ branches: ['main', 'develop'] });
    const descriptionRequest = http.expectOne('/api/github/description/');
    expect(descriptionRequest.request.method).toBe('POST');
    expect(descriptionRequest.request.body).toEqual({
      repository: 'https://github.com/owner/private-repo', image_id: 7,
    });
    descriptionRequest.flush({ description: 'About this private repository' });
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const code = page.querySelector<HTMLInputElement>('#code')!;
    expect(code.value).toBe('PRIVATE_REPO');
    expect(code.disabled).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#isPrivate')?.checked).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#token')?.value).toBe('');
    expect(page.querySelector<HTMLSelectElement>('#branch')?.value).toBe('main');
    expect(page.querySelector<HTMLInputElement>('#description')?.value).toBe('PRIVATE');
    const repository = page.querySelector<HTMLInputElement>('#repository')!;
    repository.value = 'https://github.com/owner/renamed-image';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(code.value).toBe('RENAMED_IMAGE');
    expect(code.disabled).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#description')?.value).toBe('');
    const token = page.querySelector<HTMLInputElement>('#token')!;
    token.value = 'replacement-token';
    token.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne('/api/github/branches/').flush({ branches: ['main'] });
    http.expectOne('/api/github/description/').flush({ description: 'Renamed image About' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector<HTMLInputElement>('#description')?.value).toBe('RENAMED IMAGE ABOUT');
    http.verify();
  });
});
