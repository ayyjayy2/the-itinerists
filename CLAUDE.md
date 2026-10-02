# The Itinerists

A group trip planner: Angular 19 web app (also an installable PWA and a Capacitor 8 iPhone app) on Firebase.

**Read [docs/README.md](docs/README.md) first.** It maps the architecture, design system, user flow, PRD and launch plan, and the rules for working with the data.

## Rules that apply to every change

- **Never commit real people's names, usernames, emails or handles.** Refer to people by role or count. Keys, `.env` and `scripts/*.local.*` stay gitignored.
- **Work on a branch and open a pull request.** CI must pass (unit tests, Pulse tests, the production build, security-rules tests, Playwright end-to-end) before merging; master is protected.
- **Delivery:** merging to master deploys to staging (https://the-itinerists-staging.web.app) automatically; production (theitinerists.com) is deployed by hand; the iPhone app is rebuilt with `npm run ios:sync` and installed from Xcode until TestFlight.
- **Follow the design system** (`docs/design/design-system.md`, tokens in `src/styles.scss`): every time shows its zone code; form fields are at least 16px; the header and tab bar never move; hand-offs to other apps (calendar export) stay low-key.
- **Security rules first:** any new collection or field needs a rule and a rules test.
- **Test accounts and test trips are never counted** in analytics or reports.
