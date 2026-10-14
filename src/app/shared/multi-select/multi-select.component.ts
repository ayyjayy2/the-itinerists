import { Component, ElementRef, HostListener, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { filterSummary } from '../../utils/filter-summary';

let nextId = 0;

/**
 * A compact filter button that opens a checklist (#482). Nothing ticked means
 * "All"; ticked values come back in the options' order. Closes on a tap
 * elsewhere or Escape.
 */
@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
})
export class MultiSelectComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly label    = input.required<string>();
  readonly options  = input.required<readonly string[]>();
  readonly selected = model<string[]>([]);

  readonly open    = signal(false);
  readonly panelId = `ms-panel-${nextId++}`;

  /** The choice, minus anything that is no longer an option, in the options' order. */
  readonly ticked  = computed(() => this.options().filter(o => this.selected().includes(o)));
  readonly summary = computed(() => filterSummary(this.ticked()));

  toggleOpen(): void { this.open.update(o => !o); }

  isTicked(option: string): boolean { return this.ticked().includes(option); }

  toggle(option: string): void {
    const on = new Set(this.ticked());
    if (on.has(option)) on.delete(option); else on.add(option);
    this.selected.set(this.options().filter(o => on.has(o)));
  }

  showAll(): void { this.selected.set([]); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }
}
