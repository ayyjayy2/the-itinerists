import { TestBed } from '@angular/core/testing';
import { InvitePanelComponent } from './invite-panel.component';

describe('InvitePanelComponent', () => {
  let writeText: jasmine.Spy;

  beforeEach(() => {
    writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    TestBed.configureTestingModule({ imports: [InvitePanelComponent] });
  });

  function create(code: string) {
    const fixture = TestBed.createComponent(InvitePanelComponent);
    fixture.componentRef.setInput('code', code);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the code and the link that carries it', () => {
    const el: HTMLElement = create('7GH2KQ4M').nativeElement;
    expect(el.querySelector('.invite-code')!.textContent!.trim()).toBe('7GH2KQ4M');
    expect(el.querySelector('.invite-url')!.textContent!.trim()).toBe(`${window.location.origin}/join?code=7GH2KQ4M`);
  });

  it('copies the code and the link separately', async () => {
    const fixture = create('7GH2KQ4M');
    await fixture.componentInstance.copy('code');
    expect(writeText).toHaveBeenCalledWith('7GH2KQ4M');
    expect(fixture.componentInstance.copied()).toBe('code');
    await fixture.componentInstance.copy('link');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join?code=7GH2KQ4M`);
    expect(fixture.componentInstance.copied()).toBe('link');
  });
});
