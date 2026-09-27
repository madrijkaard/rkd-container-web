import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { RecordFormPage } from './record-form-page';

describe('RecordFormPage resource selection', () => {
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
    const branch = page.querySelector<HTMLSelectElement>('#branch')!;
    expect(branch.disabled).toBe(true);

    repository.value = 'https://github.com/madrijkaard/rkd-survivor-engine';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne((request) => request.url === '/api/github/branches/'
      && request.params.get('repository') === repository.value)
      .flush({ branches: ['main', 'develop'] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect([...branch.options].map((option) => option.value)).toEqual(['', 'main', 'develop']);
    expect(branch.disabled).toBe(false);

    branch.value = 'develop';
    branch.dispatchEvent(new Event('change', { bubbles: true }));
    repository.value = 'https://github.com/owner/another';
    repository.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(branch.value).toBe('');
    expect(branch.disabled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    http.expectOne((request) => request.url === '/api/github/branches/'
      && request.params.get('repository') === repository.value)
      .flush({ branches: ['release'] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect([...branch.options].map((option) => option.value)).toEqual(['', 'release']);
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

    token.value = 'secret-token';
    token.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const request = http.expectOne('/api/github/branches/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ repository: repository.value, token: 'secret-token' });
    expect(request.request.urlWithParams).not.toContain('secret-token');
    request.flush({ branches: ['main'] });
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
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLInputElement>('#isPrivate')?.checked).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#token')?.value).toBe('');
    expect(page.querySelector<HTMLSelectElement>('#branch')?.value).toBe('main');
    http.verify();
  });
});
