import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '@/lib/legal-placeholders';

export const metadata = {
  title: 'Privacy Policy — DockWalker',
  description: 'How DockWalker collects, stores, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="page-width-wide flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      <article className="page-width-wide px-6 py-10 leading-relaxed">
        <h1 className="text-[32px] font-bold tracking-[-0.5px]">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: {LEGAL.lastUpdated}</p>

        <nav
          aria-label="Contents"
          className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm"
        >
          <p className="mb-2 font-medium">Contents</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              <a href="#who" className="hover:underline">
                Who we are
              </a>
            </li>
            <li>
              <a href="#collect" className="hover:underline">
                Data we collect
              </a>
            </li>
            <li>
              <a href="#not-collect" className="hover:underline">
                Data we do not collect
              </a>
            </li>
            <li>
              <a href="#visibility" className="hover:underline">
                Who can see your data
              </a>
            </li>
            <li>
              <a href="#third-parties" className="hover:underline">
                Third-party services
              </a>
            </li>
            <li>
              <a href="#ai" className="hover:underline">
                AI advisor (Docky)
              </a>
            </li>
            <li>
              <a href="#voice" className="hover:underline">
                Voice calls
              </a>
            </li>
            <li>
              <a href="#documents" className="hover:underline">
                Document sharing
              </a>
            </li>
            <li>
              <a href="#rights" className="hover:underline">
                Your rights (GDPR)
              </a>
            </li>
            <li>
              <a href="#retention" className="hover:underline">
                Data retention
              </a>
            </li>
            <li>
              <a href="#cookies" className="hover:underline">
                Cookies and local storage
              </a>
            </li>
            <li>
              <a href="#security" className="hover:underline">
                Security
              </a>
            </li>
            <li>
              <a href="#transfers" className="hover:underline">
                International transfers
              </a>
            </li>
            <li>
              <a href="#age" className="hover:underline">
                Age restriction
              </a>
            </li>
            <li>
              <a href="#changes" className="hover:underline">
                Changes to this policy
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:underline">
                Contact
              </a>
            </li>
          </ol>
        </nav>

        <section id="who" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">1. Who we are</h2>
          <p className="mt-2">
            DockWalker is operated by {LEGAL.companyName}, {LEGAL.registeredAddress}. We are the
            data controller for personal data collected through the DockWalker application at{' '}
            <span className="font-mono">{LEGAL.appDomain}</span> and our iOS and Android apps.
          </p>
        </section>

        <section id="collect" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">2. Data we collect</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Legal basis</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <Row data="Email, password" purpose="Authentication" basis="Contract" />
                <Row
                  data="Display name, deck name, nationality, visa status"
                  purpose="Identity in app; employer review"
                  basis="Contract / Consent"
                />
                <Row data="Profile photo (avatar)" purpose="Identity" basis="Consent" />
                <Row
                  data="Certifications declared"
                  purpose="Job matching; cert-gating permanent applications"
                  basis="Consent"
                />
                <Row
                  data="Role, department specialisations"
                  purpose="Job matching"
                  basis="Consent"
                />
                <Row
                  data="Vessel experience history (including IMO)"
                  purpose="Employer review"
                  basis="Consent"
                />
                <Row
                  data="Sea time (days at sea, nautical miles)"
                  purpose="Experience display"
                  basis="Consent"
                />
                <Row
                  data="Shore-based experience"
                  purpose="Alternative background for employer review"
                  basis="Consent"
                />
                <Row
                  data="Location preference (region, city, port)"
                  purpose="Job matching"
                  basis="Consent"
                />
                <Row
                  data="Availability dates and career status"
                  purpose="Daywork and permanent matching"
                  basis="Consent"
                />
                <Row
                  data="Application and engagement history"
                  purpose="Service operation and dispute resolution"
                  basis="Contract"
                />
                <Row
                  data="Chat messages"
                  purpose="Communication between parties"
                  basis="Contract"
                />
                <Row
                  data="Shared documents"
                  purpose="Document exchange (48-hour expiry)"
                  basis="Contract"
                />
                <Row
                  data="Voice call metadata (duration only)"
                  purpose="Call record"
                  basis="Contract"
                />
                <Row
                  data="Engagement ratings"
                  purpose="Internal quality signal — never shown to other users"
                  basis="Legitimate interest"
                />
                <Row
                  data="Device token (push notifications)"
                  purpose="Push delivery"
                  basis="Consent"
                />
                <Row
                  data="Device fingerprint (one-way hash)"
                  purpose="Abuse detection after deletion"
                  basis="Legitimate interest"
                />
                <Row data="Notification preferences" purpose="Channel control" basis="Consent" />
                <Row
                  data="WhatsApp number (optional)"
                  purpose="WhatsApp notification opt-in"
                  basis="Consent"
                />
                <Row data="Subscription data" purpose="Billing via Stripe" basis="Contract" />
                <Row
                  data="Docky AI conversations and usage count"
                  purpose="AI career guidance; free tier enforcement"
                  basis="Consent / Contract"
                />
              </tbody>
            </table>
          </div>
        </section>

        <section id="not-collect" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">3. Data we do not collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Precise GPS location (we use port/marina selection only)</li>
            <li>Browsing activity outside DockWalker</li>
            <li>Voice call audio — calls are peer-to-peer WebRTC, never recorded or transcribed</li>
            <li>Payment details between crew and employers</li>
            <li>Social media accounts or contacts</li>
            <li>Biometric data</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            We do not sell personal data to third parties. We do not use personal data for
            advertising.
          </p>
        </section>

        <section id="visibility" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">4. Who can see your data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Your profile</strong> (name, role, certifications,
              experience): visible to other authenticated users
            </li>
            <li>
              <strong className="text-foreground">Your applications</strong>: only you and the
              posting employer
            </li>
            <li>
              <strong className="text-foreground">Your chat messages</strong>: only the two parties
              in the engagement
            </li>
            <li>
              <strong className="text-foreground">Shared documents</strong>: only the two parties,
              and expire after 48 hours
            </li>
            <li>
              <strong className="text-foreground">NDA vessel identity</strong> (including IMO):
              hidden from crew until daywork acceptance or permanent selection
            </li>
            <li>
              <strong className="text-foreground">Engagement ratings</strong>: DockWalker internal
              only — never shown to other users
            </li>
            <li>
              <strong className="text-foreground">Availability and salary information</strong>:
              visible to authenticated users so matching can work
            </li>
          </ul>
        </section>

        <section id="third-parties" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">5. Third-party services</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="py-2 pr-4 font-medium">Service</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Data shared</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <Row
                  data="Supabase"
                  purpose="Database, auth, file storage, Realtime"
                  basis="All application data"
                />
                <Row
                  data="Google (OAuth)"
                  purpose="Sign in with Google (optional)"
                  basis="Email, display name, profile picture URL (only if you choose to sign in with Google)"
                />
                <Row
                  data="Vercel"
                  purpose="Web hosting, serverless functions"
                  basis="HTTP request logs"
                />
                <Row
                  data="Stripe"
                  purpose="Subscription billing"
                  basis="Email, plan, payment method (Stripe-side)"
                />
                <Row
                  data="Resend"
                  purpose="Transactional email"
                  basis="Email address, notification content"
                />
                <Row
                  data="Anthropic (Claude)"
                  purpose="AI advisor (Docky)"
                  basis="Messages and crew context — not retained by Anthropic beyond processing"
                />
                <Row
                  data="OpenAI"
                  purpose="Document embeddings for MCA corpus only"
                  basis="Public regulatory text — no personal data"
                />
                <Row
                  data="Expo Push / Apple APNs / Google FCM"
                  purpose="Push notification delivery"
                  basis="Device token, notification payload"
                />
                <Row
                  data="Twilio"
                  purpose="WhatsApp notifications (opt-in)"
                  basis="Phone number, notification content"
                />
                <Row
                  data="Upstash Redis"
                  purpose="Rate limiting"
                  basis="Request metadata (IP, user ID)"
                />
                <Row
                  data="Sentry"
                  purpose="Error tracking (conditional)"
                  basis="Error context, user ID, stack traces"
                />
                <Row
                  data="Vercel Analytics and Speed Insights"
                  purpose="Anonymous usage and performance metrics"
                  basis="Page view data, Web Vitals"
                />
              </tbody>
            </table>
          </div>
        </section>

        <section id="ai" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">6. AI advisor (Docky)</h2>
          <p className="mt-2 text-muted-foreground">
            Docky is powered by Anthropic&apos;s Claude API. When you use Docky:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your messages are sent to Anthropic for processing.</li>
            <li>
              Crew context (role, certifications, experience bracket, vessel size exposure) is
              included to personalise responses.
            </li>
            <li>
              Your salary, contact details, and private engagement content are{' '}
              <strong className="text-foreground">not</strong> sent to the AI.
            </li>
            <li>
              Anthropic does not retain API inputs or outputs beyond processing, per their API
              terms.
            </li>
            <li>
              Docky responses are informational. We do not guarantee the accuracy of AI-generated
              career advice.
            </li>
            <li>
              Free tier allows a limited number of questions per calendar month. Pro tier raises
              that limit.
            </li>
          </ul>
        </section>

        <section id="voice" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">7. Voice calls</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Available for permanent position engagements only.</li>
            <li>
              Peer-to-peer WebRTC. Audio travels directly between browsers, not through DockWalker
              servers.
            </li>
            <li>
              TURN relay credentials are issued for NAT traversal; signalling uses Supabase
              Realtime.
            </li>
            <li>
              No audio is recorded, stored, or transcribed. Only a system chat message noting the
              call duration is kept.
            </li>
          </ul>
        </section>

        <section id="documents" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">8. Document sharing</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Users can share documents (PDF or image) within an engagement chat.</li>
            <li>
              Documents are stored in a private Supabase storage bucket, accessible only to the two
              parties.
            </li>
            <li>
              Documents expire after 48 hours. The storage object is removed and the database record
              is soft-deleted.
            </li>
            <li>
              File size and type are validated server-side. DockWalker does not read or process the
              document contents.
            </li>
          </ul>
        </section>

        <section id="rights" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">9. Your rights (GDPR)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Access</strong> — use &ldquo;Export my data&rdquo;
              in Settings for a JSON export of your personal data.
            </li>
            <li>
              <strong className="text-foreground">Rectification</strong> — edit your profile at any
              time.
            </li>
            <li>
              <strong className="text-foreground">Erasure</strong> — use &ldquo;Delete
              account&rdquo; in Settings. Data is retained for 30 days, then scrubbed.
            </li>
            <li>
              <strong className="text-foreground">Portability</strong> — the export feature is a
              standard JSON file.
            </li>
            <li>
              <strong className="text-foreground">Object / Restrict processing</strong> — contact{' '}
              <a className="underline" href={`mailto:${LEGAL.dpoEmail}`}>
                {LEGAL.dpoEmail}
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">Withdraw consent</strong> — deactivate the account
              or change notification preferences.
            </li>
          </ul>
        </section>

        <section id="retention" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">10. Data retention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Active account data is kept for the life of the account.</li>
            <li>
              Deactivated account personal data is scrubbed after 30 days via an append-only{' '}
              <span className="font-mono">PERSON.DATA_SCRUBBED</span> event.
            </li>
            <li>Event structure is retained indefinitely (anonymised) for audit integrity.</li>
            <li>
              Device fingerprint hashes are kept for 12 months after deletion to support abuse
              detection.
            </li>
            <li>
              Chat messages are retained indefinitely (append-only) and are anonymised on data
              scrub.
            </li>
            <li>Shared documents expire after 48 hours.</li>
          </ul>
        </section>

        <section id="cookies" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">11. Cookies and local storage</h2>
          <p className="mt-2 text-muted-foreground">
            DockWalker uses only functional cookies and browser storage. We do not use tracking
            cookies or third-party advertising cookies.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Supabase authentication cookies — session management and JWT refresh.</li>
            <li>
              Theme preference (<span className="font-mono">dw-theme</span>) — your chosen light or
              dark mode.
            </li>
            <li>
              Lookups cache (<span className="font-mono">dw-lookups</span>) — 24-hour cache of
              canonical reference data for performance.
            </li>
            <li>
              UI state (<span className="font-mono">dockwalker:*</span>) — session-scoped
              preferences, form drafts.
            </li>
          </ul>
        </section>

        <section id="security" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">12. Security</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Row Level Security is enforced on every database table.</li>
            <li>JWT authentication with automatic token refresh.</li>
            <li>Rate limiting on API routes. Body size limits on writes.</li>
            <li>Avatar and document uploads validate file type and size server-side.</li>
            <li>HTTPS enforced end-to-end. Standard security headers are set on the origin.</li>
          </ul>
        </section>

        <section id="transfers" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">13. International transfers</h2>
          <p className="mt-2 text-muted-foreground">
            Data may be processed in {LEGAL.supabaseRegion} (primary database) and in the United
            States (for hosting, billing, email, AI, and push providers). Standard Contractual
            Clauses or equivalent safeguards apply where required by GDPR for transfers outside the
            EEA.
          </p>
        </section>

        <section id="age" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">14. Age restriction</h2>
          <p className="mt-2 text-muted-foreground">
            DockWalker is intended for users aged 18 and over. Maritime employment requires adult
            status in virtually all jurisdictions. We do not knowingly collect data from minors.
          </p>
        </section>

        <section id="changes" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">15. Changes to this policy</h2>
          <p className="mt-2 text-muted-foreground">
            We will notify you of material changes by email or in-app notification. Continued use
            after notification constitutes acceptance.
          </p>
        </section>

        <section id="contact" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">16. Contact</h2>
          <ul className="mt-2 list-none space-y-1 text-muted-foreground">
            <li>
              Data Protection Officer:{' '}
              <a className="underline" href={`mailto:${LEGAL.dpoEmail}`}>
                {LEGAL.dpoEmail}
              </a>
            </li>
            <li>
              General support:{' '}
              <a className="underline" href={`mailto:${LEGAL.supportEmail}`}>
                {LEGAL.supportEmail}
              </a>
            </li>
            <li>Postal: {LEGAL.registeredAddress}</li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-[var(--border)] pt-6 text-sm text-muted-foreground">
          See also our{' '}
          <Link href="/terms" className="text-[var(--accent)] hover:underline">
            Terms of Service
          </Link>
          .
        </footer>
      </article>
    </main>
  );
}

function Row({ data, purpose, basis }: { data: string; purpose: string; basis: string }) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-2 pr-4 align-top text-foreground">{data}</td>
      <td className="py-2 pr-4 align-top">{purpose}</td>
      <td className="py-2 align-top">{basis}</td>
    </tr>
  );
}
