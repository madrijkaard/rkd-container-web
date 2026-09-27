import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { CodeInputDirective } from './code-input.directive';

@Component({
  imports: [CodeInputDirective, FormsModule],
  template: '<input appCodeInput name="code" [(ngModel)]="code" />',
})
class TestHost {
  code = '';
}

describe('CodeInputDirective', () => {
  it('converts input to uppercase and keeps only letters, numbers and underscores', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'abc! 12_def-ghi#';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(input.value).toBe('ABC12_DEFGHI');
    expect(fixture.componentInstance.code).toBe('ABC12_DEFGHI');
  });
});
