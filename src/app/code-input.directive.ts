import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

@Directive({
  selector: 'input[appCodeInput]',
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CodeInputDirective),
    multi: true,
  }],
})
export class CodeInputDirective implements ControlValueAccessor {
  private readonly input = inject(ElementRef<HTMLInputElement>).nativeElement;
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.input.value = normalizeCode(value ?? '');
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
    const normalizedCaret = normalizeCode(this.input.value.slice(0, caret)).length;
    const normalized = normalizeCode(this.input.value);
    this.input.value = normalized;
    this.input.setSelectionRange(normalizedCaret, normalizedCaret);
    this.onChange(normalized);
  }
}
