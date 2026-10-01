import { Directive, ElementRef, effect, inject, input, AfterViewInit } from '@angular/core';
import { FocusService } from '../services/focus.service';

/**
 * Marks an element as the landing spot for a `?focus=<id>` deep link. When the
 * current focus id matches (one id, or any of several for a card that holds
 * many docs), the element scrolls into view and flashes for two seconds.
 */
@Directive({ selector: '[appFocusTarget]' })
export class FocusTargetDirective implements AfterViewInit {
  readonly appFocusTarget = input.required<string | string[] | undefined>();

  private el    = inject(ElementRef<HTMLElement>);
  private focus = inject(FocusService);

  constructor() {
    effect(() => { if (this.matches(this.focus.id())) this.flash(); });
  }

  ngAfterViewInit(): void {
    if (this.matches(this.focus.id())) this.flash();
  }

  private matches(id: string | null): boolean {
    if (!id) return false;
    const mine = this.appFocusTarget();
    return Array.isArray(mine) ? mine.includes(id) : mine === id;
  }

  private flash(): void {
    const e = this.el.nativeElement;
    // Next frame, so a page that just switched day/tab has rendered the item.
    requestAnimationFrame(() => {
      e.scrollIntoView({ block: 'center', behavior: 'smooth' });
      e.classList.add('focus-flash');
      setTimeout(() => e.classList.remove('focus-flash'), 2000);
    });
    this.focus.clear();
  }
}
