import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SetupInstances } from './setup-instances';

const instance = {
  id: 21, setup_id: 12, number: 1, code: 'SERVER-replica-1',
  container_id: 'abcdef1234567890', container_name: 'SERVER-replica-1',
  port: '127.0.0.1:32768:8000', created_date: '2026-09-29T00:00:00Z',
};

describe('SetupInstances', () => {
  async function render(rows = [instance]) {
    await TestBed.configureTestingModule({
      imports: [SetupInstances],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SetupInstances);
    fixture.componentRef.setInput('setupId', 12);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/setups/12/instances/').flush(rows);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  it('lists persisted replicas with their container identity and assigned port', async () => {
    const { http, page } = await render();
    expect(page.querySelector('tbody')?.textContent).toContain('SERVER-replica-1');
    expect(page.querySelector('tbody code')?.textContent).toBe('abcdef123456');
    expect(page.querySelector('tbody')?.textContent).toContain('127.0.0.1:32768:8000');
    expect(page.querySelector('tbody .instance-delete')?.getAttribute('aria-label')).toContain('SERVER-replica-1');
    http.verify();
  });

  it('adds each created replica to the setup table and prevents duplicate clicks', async () => {
    const { fixture, http, page } = await render([]);
    const button = page.querySelector('[data-action="create-instance"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    button.click();
    http.expectOne('/api/setups/12/instances/').flush(instance);
    fixture.detectChanges();
    expect(page.querySelectorAll('tbody tr').length).toBe(1);
    expect(button.disabled).toBe(false);
    button.click();
    http.expectOne('/api/setups/12/instances/').flush({ ...instance, id: 22, number: 2, code: 'SERVER-replica-2' });
    fixture.detectChanges();
    expect(page.querySelectorAll('tbody tr').length).toBe(2);
    http.verify();
  });

  it('shows creation failures without adding a phantom row', async () => {
    const { fixture, http, page } = await render([]);
    (page.querySelector('[data-action="create-instance"]') as HTMLButtonElement).click();
    http.expectOne('/api/setups/12/instances/').flush(
      { code: 'docker_unavailable' }, { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('O Docker está desligado');
    expect(page.querySelectorAll('tbody tr').length).toBe(0);
    expect((page.querySelector('[data-action="create-instance"]') as HTMLButtonElement).disabled).toBe(false);
    http.verify();
  });

  it('removes a row only after its Docker deletion succeeds', async () => {
    const { fixture, http, page } = await render();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      (page.querySelector('.instance-delete') as HTMLButtonElement).click();
      const deletion = http.expectOne('/api/instances/21/');
      expect(deletion.request.method).toBe('DELETE');
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      deletion.flush({ deleted: true });
      fixture.detectChanges();
      expect(page.querySelectorAll('tbody tr').length).toBe(0);
      expect(page.textContent).toContain('Nenhuma instância');
      http.verify();
    } finally { confirm.mockRestore(); }
  });

  it('keeps the instance visible if Docker refuses deletion', async () => {
    const { fixture, http, page } = await render();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      (page.querySelector('.instance-delete') as HTMLButtonElement).click();
      http.expectOne('/api/instances/21/').flush(
        { code: 'container_delete_failed', error: 'Confira o Docker.' },
        { status: 502, statusText: 'Bad Gateway' },
      );
      fixture.detectChanges();
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Confira o Docker');
      expect((page.querySelector('.instance-delete') as HTMLButtonElement).disabled).toBe(false);
      http.verify();
    } finally { confirm.mockRestore(); }
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const { http, page } = await render();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      (page.querySelector('.instance-delete') as HTMLButtonElement).click();
      http.expectNone('/api/instances/21/');
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      http.verify();
    } finally { confirm.mockRestore(); }
  });
});
