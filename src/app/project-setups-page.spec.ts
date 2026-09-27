import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProjectSetupsPage } from './project-setups-page';

describe('ProjectSetupsPage', () => {
  it('lists the project setups and announces when Docker is unavailable', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSetupsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectSetupsPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/projects/7/').flush({ id: 7, code: 'PROJECT' });
    http.expectOne('/api/projects/7/setups/').flush([{
      id: 12, setup_code: 'SERVER', image_code: 'ALPINE', environment_code: 'DEV',
    }]);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('tbody')?.textContent).toContain('SERVER');
    expect(page.querySelector('tbody')?.textContent).toContain('ALPINE');
    expect(page.querySelector('tbody')?.textContent).toContain('DEV');
    expect(page.querySelector('tbody a')?.getAttribute('href')).toBe('/setups/12');

    (page.querySelector('tbody button') as HTMLButtonElement).click();
    http.expectOne('/api/setups/12/containers/').flush(
      { code: 'docker_unavailable', error: 'Docker is unavailable.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('O Docker está desligado');
    http.verify();
  });
});
