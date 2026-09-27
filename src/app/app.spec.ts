import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.setItem('container-web-theme', 'light');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    })
      .compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('container-web-theme');
    delete document.documentElement.dataset['theme'];
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should show the theme control in place of the projects link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Container Web');
    expect(compiled.querySelector('nav')).toBeNull();
    expect(compiled.querySelector('.theme-toggle')?.getAttribute('aria-label')).toBe('Ativar modo escuro');
  });

  it('should switch themes and remember the selected mode', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('container-web-theme')).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Ativar modo claro');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fixture.destroy();
    const reopened = TestBed.createComponent(App);
    reopened.detectChanges();
    expect(reopened.nativeElement.querySelector('.theme-toggle').getAttribute('aria-label'))
      .toBe('Ativar modo claro');
  });
});
