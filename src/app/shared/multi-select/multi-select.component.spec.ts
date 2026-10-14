import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiSelectComponent } from './multi-select.component';

@Component({
  imports: [MultiSelectComponent],
  template: `<app-multi-select label="Categories" [options]="options()" [(selected)]="selected" /><button class="elsewhere">x</button>`,
})
class HostComponent {
  options = signal(['Food', 'Drink', 'Tips']);
  selected = signal<string[]>([]);
}

describe('MultiSelectComponent (#482)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });
  afterEach(() => el.remove());

  const trigger = () => el.querySelector<HTMLButtonElement>('.ms-trigger')!;
  const panel = () => el.querySelector('.ms-panel');
  const box = (name: string) =>
    [...el.querySelectorAll<HTMLLabelElement>('.ms-option')].find(l => l.textContent!.trim() === name)!.querySelector('input')!;
  const open = () => { trigger().click(); fixture.detectChanges(); };

  it('reads its label and "All" when nothing is ticked, closed', () => {
    expect(trigger().textContent!.replace(/\s+/g, ' ').trim()).toBe('Categories: All');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('opens a checklist of the options', () => {
    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect([...el.querySelectorAll('.ms-option')].map(o => o.textContent!.trim())).toEqual(['Food', 'Drink', 'Tips']);
  });

  it('ticks several, kept in the options\' order, and the button names them', () => {
    open();
    box('Tips').click(); box('Food').click(); fixture.detectChanges();
    expect(host.selected()).toEqual(['Food', 'Tips']);
    expect(trigger().textContent).toContain('Food, Tips');
    box('Tips').click(); fixture.detectChanges();
    expect(host.selected()).toEqual(['Food']);
  });

  it('"Show all" clears the choice', () => {
    host.selected.set(['Food', 'Drink']); fixture.detectChanges();
    open();
    el.querySelector<HTMLButtonElement>('.ms-all')!.click(); fixture.detectChanges();
    expect(host.selected()).toEqual([]);
    expect(trigger().textContent).toContain('All');
  });

  it('ignores a choice that is no longer an option', () => {
    host.selected.set(['Food', 'Gone']); fixture.detectChanges();
    expect(trigger().textContent).toContain('Categories: Food');
    expect(trigger().textContent).not.toContain('Gone');
  });

  it('closes on a tap elsewhere and on Escape, keeping the choice', () => {
    open();
    box('Drink').click(); fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.elsewhere')!.click(); fixture.detectChanges();
    expect(panel()).toBeNull();
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(host.selected()).toEqual(['Drink']);
  });
});
