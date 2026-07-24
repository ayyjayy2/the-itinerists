import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CURRENCIES } from '../../data/currencies';

/**
 * Reusable searchable currency combobox. Two-way bindable via `[(value)]`,
 * so multiple instances (e.g. one per trip destination) each keep their own
 * open/search state. Extracted from create-trip so it can be reused per leg.
 */
@Component({
  selector: 'app-currency-select',
  imports: [CommonModule],
  template: `
    <div class="currency-combo">
      <input
        type="text"
        class="currency-input"
        [value]="open() ? query() : label()"
        (focus)="openList()"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKeydown($event)"
        (blur)="close()"
        placeholder="Type to search currencies…"
        autocomplete="off"
        role="combobox"
        [attr.aria-expanded]="open()"
      />
      @if (open()) {
        <ul class="currency-list" role="listbox">
          @for (c of filtered(); track c.code; let i = $index) {
            <li
              class="currency-option"
              role="option"
              [class.active]="i === activeIndex()"
              [class.selected]="c.code === value"
              [attr.aria-selected]="c.code === value"
              (mousedown)="$event.preventDefault(); select(c.code)"
            >
              <span class="currency-code">{{ c.code }}</span>
              <span class="currency-name">{{ c.name }}</span>
            </li>
          } @empty {
            <li class="currency-empty">No currencies match “{{ query() }}”.</li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './currency-select.component.scss',
})
export class CurrencySelectComponent {
  @Input() value = 'USD';
  @Output() valueChange = new EventEmitter<string>();

  readonly currencies = CURRENCIES;
  open        = signal(false);
  query       = signal('');
  activeIndex = signal(0);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.currencies;
    return this.currencies.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  });

  /** Label shown when a currency is selected and the field isn't being edited. */
  label(): string {
    const c = this.currencies.find(x => x.code === this.value);
    return c ? `${c.code} — ${c.name}` : this.value;
  }

  openList(): void { this.query.set(''); this.activeIndex.set(0); this.open.set(true); }
  onInput(v: string): void { this.query.set(v); this.activeIndex.set(0); this.open.set(true); }
  close(): void { this.open.set(false); }

  select(code: string): void {
    this.value = code;
    this.valueChange.emit(code);
    this.query.set('');
    this.open.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.open() && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      this.openList();
      return;
    }
    const list = this.filtered();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(this.activeIndex() + 1, list.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const choice = list[this.activeIndex()];
        if (choice) this.select(choice.code);
        break;
      }
      case 'Escape':
        this.close();
        break;
    }
  }
}
