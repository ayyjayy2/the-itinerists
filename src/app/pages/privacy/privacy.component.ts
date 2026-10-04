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
          <p class="effective">Effective October 4, 2026</p>
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
          <li><strong>Error reports.</strong> If something breaks, the app records the error message, where in the app it happened, the time, and a random session id that is not linked to your account. No personal data is included. In the iOS app, crashes and those same errors also go to Firebase Crashlytics together with your device model, iOS version, app version and your account id, so we can tell how many people a bug affects. Never your name, email or trip content.</li>
          <li><strong>Usage analytics.</strong> To see how the app is used, we record which screens you open and when, a short "still open" signal every two minutes while the app is on screen, the app version, your device's time zone and whether you're on the web, the installed web app or the iOS app. We also note that you changed something on a trip (which kind of thing and when, never what you wrote). We keep this in our own database, tied to your account and trip. On the website and installed web app, screen views also go to Google Analytics with your account id and the open trip's id, plus a note when a trip is created, joined or shared; Google also estimates your country and device type from your connection. Analytics are used only to improve the app, never for advertising, and are not sold or shared beyond that.</li>
          <li><strong>App integrity checks.</strong> Firebase App Check confirms requests come from the genuine app. On the web this uses Google reCAPTCHA, which analyses browser signals; the iOS app uses a check built into the app. Neither tells us who you are.</li>
        </ul>
        <p>The app does <strong>not</strong> use your device's location, read your contacts, run advertising trackers, or sell any data.</p>

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
            <tr><td>Firebase Crashlytics (iOS app only)</td><td>Crash reports</td><td>The error, device model, iOS version, app version and your account id. Not your name, email or trip content</td></tr>
            <tr><td>Google Analytics (web only)</td><td>Usage statistics</td><td>Screens opened, app version, time zone, platform, your account id, the open trip's id, a random device id, and when a trip is created, joined or shared. Not your name, email or trip content</td></tr>
            <tr><td>Google reCAPTCHA (web only)</td><td>Integrity checks</td><td>Browser and interaction signals, under Google's own privacy policy</td></tr>
            <tr><td>Open-Meteo</td><td>Weather on the home screen</td><td>Your trip destination's coordinates. Never your own location</td></tr>
            <tr><td>OpenStreetMap Nominatim</td><td>Turns place names into map pins</td><td>The place name you typed. Results are kept in our database so each place is looked up once</td></tr>
            <tr><td>OpenStreetMap tiles</td><td>The map pictures on Map and day cards</td><td>A request from your device for the area of the map on screen</td></tr>
            <tr><td>Frankfurter</td><td>Currency conversion rates</td><td>Currency codes only</td></tr>
            <tr><td>Google Fonts</td><td>The app's typefaces</td><td>A font request from your device</td></tr>
          </tbody>
        </table>

        <h2>Cookies and storage on your device</h2>
        <p>The app keeps a copy of your trips on your device so it opens quickly and works offline, and remembers small settings such as your theme, the last currency you used and which reminders you've dismissed. Firebase keeps you signed in the same way. On the website, Google Analytics sets its own cookies to count visits. We use no advertising cookies. Signing out or clearing your browser's site data removes these copies; your trips stay safe on our servers.</p>

        <h2>Your choices</h2>
        <ul>
          <li><strong>Edit</strong> your name, avatar, username, email and password on the Profile page.</li>
          <li><strong>Leave a trip</strong> from Trip Settings. Your personal lists and photos for that trip go with you.</li>
          <li><strong>Delete your account</strong> from the Profile page. This removes your profile, email, personal lists and photos, takes you off every trip, and deletes your sign-in. A trip you owned passes to its longest-standing member; a trip you were the only member of is deleted. This cannot be undone.</li>
        </ul>

        <h2>Your rights</h2>
        <p>Wherever you live, you can see, correct and delete your information using the app, and you can email us to ask for a copy of everything we hold about you or for anything the app doesn't let you do yourself. We answer within 30 days.</p>
        <h3>In the European Economic Area and the United Kingdom</h3>
        <ul>
          <li>We use your account and trip content to provide the app you signed up for (performance of a contract). We use error reports, usage analytics and integrity checks because we have a legitimate interest in keeping the app secure, working and improving. You may object to that use by emailing us.</li>
          <li>You have the right to access, correct, delete, restrict and move your data, and to complain to your local data protection authority.</li>
          <li>Your data is stored by Google in the United States. Google transfers it under the EU-US Data Privacy Framework and the European Commission's Standard Contractual Clauses.</li>
        </ul>
        <h3>In the United States</h3>
        <p>We don't sell your personal information or share it for targeted advertising, and we don't collect sensitive personal information. If your state gives you privacy rights (such as California, Colorado, Virginia or Illinois), you can use them by emailing us, and we won't treat you differently for doing so.</p>

        <h2>How long we keep data</h2>
        <p>Until you delete it. Trip content stays as long as the trip has members. Error reports are kept for troubleshooting and contain no personal data.</p>

        <h2>Security</h2>
        <p>All traffic is encrypted in transit. Database access is restricted by security rules that are tested with every change. Only the developer can administer the project.</p>

        <h2>Children</h2>
        <p>The Itinerists is not directed at children under 13, and we do not knowingly collect information from them.</p>

        <h2>Changes to this policy</h2>
        <p>If what the app collects or shares changes, this page and the effective date change with it. If a change is significant, we'll tell you in the app.</p>

        <h2>Contact</h2>
        <p>Questions or requests about your data: <a href="mailto:hello&#64;theitinerists.com">hello&#64;theitinerists.com</a>.</p>

        <footer class="policy-foot">
          <a routerLink="/terms">Terms of service</a>
          <a routerLink="/login">Back to sign in</a>
        </footer>
      </article>
    </div>
  `,
  styleUrl: '../../shared/legal-page.scss',
})
export class PrivacyComponent {}
