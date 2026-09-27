import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export function uppercaseDescription(value: string): string {
  return value.toLocaleUpperCase('pt-BR');
}

@Directive({
  selector: 'input[appUppercaseInput]',
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UppercaseInputDirective),
    multi: true,
  }],
})
export class UppercaseInputDirective implements ControlValueAccessor {
  private readonly input = inject(ElementRef<HTMLInputElement>).nativeElement;
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.input.value = uppercaseDescription(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected onInput(): void {
    const caret = this.input.selectionStart ?? this.input.value.length;
    const uppercaseCaret = uppercaseDescription(this.input.value.slice(0, caret)).length;
    const uppercase = uppercaseDescription(this.input.value);
    this.input.value = uppercase;
    this.input.setSelectionRange(uppercaseCaret, uppercaseCaret);
    this.onChange(uppercase);
  }
}
