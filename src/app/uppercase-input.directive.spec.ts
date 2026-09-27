import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { UppercaseInputDirective } from './uppercase-input.directive';

@Component({
  imports: [FormsModule, UppercaseInputDirective],
  template: '<input appUppercaseInput name="description" [(ngModel)]="description" />',
})
class TestHost {
  description = '';
}

describe('UppercaseInputDirective', () => {
  it('uppercases letters while preserving spaces, accents and punctuation', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'ação livre - 42!';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(input.value).toBe('AÇÃO LIVRE - 42!');
    expect(fixture.componentInstance.description).toBe('AÇÃO LIVRE - 42!');
  });
});
