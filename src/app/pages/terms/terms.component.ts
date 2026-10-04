import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../shared/brand/brand.component';

/**
 * Terms of service — public, no sign-in needed. Linked from the sign-up form,
 * from Profile (next to the privacy policy), and from the privacy policy.
 *
 * Written for the app as it is: free, group trips, shared content. When paid
 * features ship, add their terms here (price, renewal, refunds through Apple)
 * in the same PR and bump the effective date.
 */
@Component({
  selector: 'app-terms',
  imports: [RouterLink, BrandComponent],
  template: `
    <div class="policy-screen">
      <article class="policy">
        <header class="policy-head">
          <app-brand [mark]="40" [showWordmark]="false" />
          <h1>Terms of Service</h1>
          <p class="effective">Effective October 4, 2026</p>
          <p class="lede">These terms are the agreement between you and The Itinerists ("we", "us") for using the website, the installable web app and the iOS app. By creating an account or using the app, you agree to them. Short version: plan trips with people you trust, keep it legal and kind, your content stays yours, and the app is a planning tool, so double-check bookings with whoever you booked with.</p>
        </header>

        <h2>Who can use it</h2>
        <ul>
          <li>You must be at least 13. If you're under the age of majority where you live, use the app with a parent or guardian's permission.</li>
          <li>Give a real email address and keep your password to yourself. You're responsible for what happens under your account.</li>
          <li>One person per account.</li>
        </ul>

        <h2>Trips and the people on them</h2>
        <ul>
          <li>Anyone you give a trip's invite to can join that trip, and everyone on a trip can see and edit what's on it. Share invites only with people you'd plan with.</li>
          <li>A trip's owner can remove members and delete the trip.</li>
          <li>Shared expenses and balances are a record to help your group settle up. We don't move money, hold funds or process payments between members, and currency conversions use published rates that may differ from what your bank charges.</li>
        </ul>

        <h2>Your content</h2>
        <p>What you add (plans, notes, expenses, photos) stays yours. You give us permission to store it, back it up and show it to the people you've shared it with, only so the app can work. We don't sell it or use it for advertising. Please add only content you have the right to share, including other people's details.</p>

        <h2>Keep it fair</h2>
        <p>Don't use the app to:</p>
        <ul>
          <li>break the law, or harass, threaten or impersonate anyone;</li>
          <li>share content that isn't yours to share, or other people's private information without their permission;</li>
          <li>get around its security, reach data that isn't yours, or interfere with how it runs (including scraping, automated sign-ups, or overloading it);</li>
          <li>upload malware or anything meant to cause harm.</li>
        </ul>
        <p>We may remove content or suspend or close an account that breaks these terms. Where we can, we'll tell you why.</p>

        <h2>Travel information</h2>
        <p>The Itinerists is a planning tool, not a travel agent. We don't sell or book travel. Times, time zones, weather, maps, exchange rates and place details come from what you and your group enter and from outside services, and they can be wrong or out of date. Always confirm flights, reservations and entry requirements with the airline, host or provider. Links to other websites are theirs, not ours.</p>

        <h2>Price</h2>
        <p>The app is free today. If we add paid features, we'll show the price and what you get before you pay, and these terms will be updated to cover them. Purchases in the iOS app go through Apple and follow Apple's payment and refund rules.</p>

        <h2>Ending your use</h2>
        <ul>
          <li>You can delete your account at any time from the Profile page. The <a routerLink="/privacy">privacy policy</a> explains what that removes.</li>
          <li>We may change, pause or stop parts of the app. If we ever shut it down, we'll give notice in the app first wherever we can, so you can save what you need.</li>
        </ul>

        <h2>No guarantees</h2>
        <p>We work hard to keep the app running and your data safe, but it's provided "as is" and "as available", without warranties of any kind, to the extent the law allows. We can't promise it will always be available, error-free, or right for your trip.</p>

        <h2>Limits on liability</h2>
        <p>To the extent the law allows, we aren't liable for indirect, incidental or consequential losses (such as a missed flight, a lost booking or lost data), and our total liability to you for any claim is limited to the greater of what you paid us in the 12 months before the claim or US $50. Nothing in these terms limits rights you have under consumer law that can't be limited by agreement.</p>

        <h2>The iOS app and Apple</h2>
        <p>These terms are between you and us, not Apple. Apple isn't responsible for the app, its content, maintenance, support or any claim about it. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you as they relate to the iOS app.</p>

        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the State of Illinois, USA, without regard to its conflict-of-law rules. Disputes go to the state or federal courts located in Illinois, unless the consumer law where you live gives you the right to bring a claim in your local courts.</p>

        <h2>Changes to these terms</h2>
        <p>If we change these terms, this page and the effective date change with them. If a change is significant, we'll tell you in the app before it takes effect. Using the app after that means you accept the new terms.</p>

        <h2>Contact</h2>
        <p>Questions about these terms: <a href="mailto:hello&#64;theitinerists.com">hello&#64;theitinerists.com</a>.</p>

        <footer class="policy-foot">
          <a routerLink="/privacy">Privacy policy</a>
          <a routerLink="/login">Back to sign in</a>
        </footer>
      </article>
    </div>
  `,
  styleUrl: '../../shared/legal-page.scss',
})
export class TermsComponent {}
