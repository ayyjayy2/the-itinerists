import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { InvitePanelComponent } from './invite-panel.component';

/** #658: the invite link shown (and copied) in the iPhone app is one other people can open. */
describe('InvitePanelComponent link in the iPhone app', () => {
  it('points at the public site', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    TestBed.configureTestingModule({ imports: [InvitePanelComponent] });
    const fixture = TestBed.createComponent(InvitePanelComponent);
    fixture.componentRef.setInput('code', 'ABC12345');
    expect(fixture.componentInstance.link()).toMatch(/^https:\/\/[^/]+\/join\?code=ABC12345$/);
    expect(fixture.componentInstance.link()).not.toContain('capacitor:');
  });
});
