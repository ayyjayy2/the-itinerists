import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../shared/brand/brand.component';

/**
 * Privacy policy — public, no sign-in needed. Linked from Profile (next to
 * the version line) and from the sign-up form, and it is the policy URL for
 * the App Store listing: https://the-itinerists.web.app/privacy
 *
 * Every statement here describes what the code actually does. When a feature
 * changes what is collected or which service it talks to, change this page in
 * the same PR and bump the effective date.
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink, BrandComponent],
  template: `
    <div class="policy-screen">
      <article class="policy">
        <header class="policy-head">
          <app-brand [mark]="40" [showWordmark]="false" />
          <h1>Privacy Policy</h1>
          <p class="effective">Effective September 29, 2026</p>
          <p class="lede">The Itinerists is a group trip planner. This page says exactly what the app stores, who can see it, and which outside services it talks to. Short version: your trip data is shared only with the people on your trip, your email is private, we don't sell or advertise with anything, and you can delete your account yourself at any time.</p>
        </header>

        <h2>What the app stores</h2>
        <h3>Your account</h3>
        <ul>
          <li><strong>Display name, username, and avatar</strong> (an emoji or letter and a color). Members of your trips can see these.</li>
          <li><strong>Email address.</strong> Used to sign in, to reset a forgotten password, and to verify a recovery email. It is never shown to other members.</li>
          <li><strong>Password.</strong> Stored by Firebase Authentication in hashed form. We never see it.</li>
          <li><strong>Preferences</strong> such as your home layout and pinned shortcuts.</li>
        </ul>
        <h3>Trip content you add</h3>
        <ul>
          <li>Trip names, destinations and dates, itinerary events, flights, stays, transportation, shared expenses and who paid, recommendations, map pins, and an activity log of changes. Everyone on that trip can see and edit this.</li>
          <li><strong>Personal lists</strong> — your packing list and your "My Expenses" log — are visible only to you.</li>
          <li><strong>Outfit photos</strong> you choose to add are visible only to you. The app never opens your camera or photo library on its own; you pick each photo.</li>
        </ul>
        <h3>Technical information</h3>
        <ul>
          <li><strong>Error reports.</strong> If something breaks, the app records the error message, where in the app it happened, the time, and a random session id that is not linked to your account. No personal data is included.</li>
          <li><strong>App integrity checks.</strong> Firebase App Check confirms requests come from the genuine app. On the web this uses Google reCAPTCHA, which analyses browser signals; on iOS it uses Apple's device attestation. Neither tells us who you are.</li>
        </ul>
        <p>The app does <strong>not</strong> use your device's location, read your contacts, run analytics or advertising trackers, or sell any data.</p>

        <h2>Who can see what</h2>
        <ul>
          <li><strong>People on your trip</strong> see your name and avatar, and everything added to that trip.</li>
          <li><strong>Only you</strong> see your email, personal lists, outfit photos, and account settings.</li>
          <li><strong>Nobody</strong> can list the app's users. Access is enforced by database security rules, not just by the app's screens.</li>
          <li><strong>The app's administrator</strong> (the developer) can read account records to support you and to remove accounts that break the rules.</li>
        </ul>

        <h2>Services we rely on</h2>
        <p>Each one receives only what it needs to do its job.</p>
        <table>
          <thead><tr><th>Service</th><th>What it does</th><th>What it receives</th></tr></thead>
          <tbody>
            <tr><td>Google Firebase</td><td>Sign-in, database, hosting, integrity checks</td><td>Everything listed above; stored in Google's data centers in the United States</td></tr>
            <tr><td>Open-Meteo</td><td>Weather on the home screen</td><td>Your trip destination's coordinates. Never your own location</td></tr>
            <tr><td>OpenStreetMap Nominatim</td><td>Turns place names into map pins</td><td>The place name you typed</td></tr>
            <tr><td>Frankfurter</td><td>Currency conversion rates</td><td>Currency codes only</td></tr>
            <tr><td>Google Fonts</td><td>The app's typefaces</td><td>A font request from your device</td></tr>
          </tbody>
        </table>

        <h2>Your choices</h2>
        <ul>
          <li><strong>Edit</strong> your name, avatar, username, email and password on the Profile page.</li>
          <li><strong>Leave a trip</strong> from Trip Settings. Your personal lists and photos for that trip go with you.</li>
          <li><strong>Delete your account</strong> from the Profile page. This removes your profile, email, personal lists and photos, takes you off every trip, and deletes your sign-in. A trip you owned passes to its longest-standing member; a trip you were the only member of is deleted. This cannot be undone.</li>
        </ul>

        <h2>How long we keep data</h2>
        <p>Until you delete it. Trip content stays as long as the trip has members. Error reports are kept for troubleshooting and contain no personal data.</p>

        <h2>Security</h2>
        <p>All traffic is encrypted in transit. Database access is restricted by security rules that are tested with every change. Only the developer can administer the project.</p>

        <h2>Children</h2>
        <p>The Itinerists is not directed at children under 13, and we do not knowingly collect information from them.</p>

        <h2>Changes to this policy</h2>
        <p>If what the app collects or shares changes, this page and the effective date change with it.</p>

        <h2>Contact</h2>
        <p>Questions or requests about your data: <a href="mailto:hello&#64;theitinerists.com">hello&#64;theitinerists.com</a>.</p>

        <footer class="policy-foot">
          <a routerLink="/login">Back to sign in</a>
        </footer>
      </article>
    </div>
  `,
  styles: `
    .policy-screen {
      height: 100dvh; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      background: var(--bg); padding: 1.5rem 1.25rem calc(2rem + env(safe-area-inset-bottom, 0px));
      padding-top: calc(1.5rem + env(safe-area-inset-top, 0px));
    }
    .policy { max-width: 42rem; margin: 0 auto; line-height: 1.55; color: var(--text); }
    .policy-head { text-align: center; margin-bottom: 1.5rem; }
    h1 { margin: 0.6rem 0 0.2rem; font-size: 1.6rem; }
    .effective { margin: 0 0 0.8rem; font-size: 0.85rem; color: var(--text-muted); }
    .lede { margin: 0 auto; max-width: 36rem; text-align: left; }
    h2 { font-size: 1.15rem; margin: 1.6rem 0 0.4rem; color: var(--primary-dark); }
    h3 { font-size: 0.95rem; margin: 0.9rem 0 0.25rem; }
    ul { margin: 0.2rem 0 0.4rem; padding-left: 1.2rem; }
    li { margin: 0.25rem 0; }
    p { margin: 0.3rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.6rem 0; font-size: 0.9rem; }
    th, td { text-align: left; vertical-align: top; padding: 0.45rem 0.5rem; border-top: 1px solid var(--border); }
    thead th { border-top: 0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
    a { color: var(--primary-dark); font-weight: 700; }
    .policy-foot { margin-top: 2rem; text-align: center; }
    @media (max-width: 480px) { table { display: block; overflow-x: auto; } }
  `,
})
export class PrivacyComponent {}
