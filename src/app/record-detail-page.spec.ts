import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RecordDetailPage } from './record-detail-page';

describe('RecordDetailPage', () => {
  it('renders an image definition as readable, escaped Dockerfile code', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { kind: 'images' } },
            paramMap: of(convertToParamMap({ id: '2' })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordDetailPage);
    const http = TestBed.inject(HttpTestingController);
    const definition = 'FROM python:3.12-slim\n# base image\nRUN echo "<img src=x onerror=alert(1)>"\n';
    fixture.detectChanges();
    http.expectOne('/api/images/2/').flush({
      id: 2, code: 'BACKEND', description: 'Backend', environment_id: 1, definition,
      created_date: '2026-09-25T00:00:00Z', last_modified_date: '2026-09-25T00:00:00Z',
    });
    http.expectOne('/api/images/2/setups/').flush([]);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const lines = [...page.querySelectorAll('.dockerfile-line-content')];
    expect(lines.map((line) => line.textContent).join('\n')).toBe(definition.trimEnd());
    expect(page.querySelector('.dockerfile-token-instruction')?.textContent).toBe('FROM');
    expect(page.querySelector('.dockerfile-token-comment')?.textContent).toBe('# base image');
    expect(page.querySelector('.dockerfile-viewer img')).toBeNull();
    http.verify();
  });

  it('shows an association warning when deleting a project with children', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { kind: 'projects' } },
            paramMap: of(convertToParamMap({ id: '7' })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordDetailPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/projects/7/').flush({
      id: 7, code: 'PROJECT', description: 'Project',
      created_date: '2026-09-25T00:00:00Z', last_modified_date: '2026-09-25T00:00:00Z',
    });
    http.expectOne('/api/projects/7/environments/').flush([
      { id: 8, code: 'DEV', description: 'Development' },
    ]);
    fixture.detectChanges();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const page = fixture.nativeElement as HTMLElement;
      (page.querySelector('.page-heading .danger') as HTMLButtonElement).click();
      http.expectOne('/api/projects/7/').flush(
        { code: 'associated_records', error: 'This record has associated records.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('existem registros associados');
      expect(page.querySelector('h1')?.textContent).toContain('PROJECT');
      http.verify();
    } finally {
      confirm.mockRestore();
    }
  });

  it('blocks setup editing while an instance exists and unlocks it after deletion', async () => {
    await TestBed.configureTestingModule({
      imports: [RecordDetailPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { kind: 'setups' } },
            paramMap: of(convertToParamMap({ id: '7' })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecordDetailPage);
    const http = TestBed.inject(HttpTestingController);
    const setup = {
      id: 7, code: 'SERVER', image_id: 3, cpu: '1', memory: '512 MB',
      hasInstances: true,
      created_date: '2026-09-29T00:00:00Z', last_modified_date: '2026-09-29T00:00:00Z',
    };
    fixture.detectChanges();
    http.expectOne('/api/setups/7/').flush(setup);
    fixture.detectChanges();
    http.expectOne('/api/setups/7/instances/').flush([{
      id: 21, setup_id: 7, number: 1, code: 'SERVER-replica-1',
      container_id: 'docker-id', port: '', created_date: '2026-09-29T00:00:00Z',
    }]);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLButtonElement>('.page-heading button[title]')?.disabled).toBe(true);
    expect(page.querySelector('a[href="/setups/7/edit"]')).toBeNull();
    expect(page.textContent).toContain('não pode ser editado enquanto tiver instâncias');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      (page.querySelector('.instance-delete') as HTMLButtonElement).click();
      http.expectOne('/api/instances/21/').flush({ deleted: true });
      http.expectOne('/api/setups/7/').flush({ ...setup, hasInstances: false });
      fixture.detectChanges();
      expect(page.querySelector('a[href="/setups/7/edit"]')).not.toBeNull();
      http.verify();
    } finally { confirm.mockRestore(); }
  });
});
