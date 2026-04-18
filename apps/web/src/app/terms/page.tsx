import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '@/lib/legal-placeholders';

export const metadata = {
  title: 'Terms of Service — DockWalker',
  description: 'The rules of the road for using DockWalker.',
};

export default function TermsPage() {
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
        <h1 className="text-[32px] font-bold tracking-[-0.5px]">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: {LEGAL.lastUpdated}</p>

        <nav
          aria-label="Contents"
          className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm"
        >
          <p className="mb-2 font-medium">Contents</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              <a href="#what" className="hover:underline">
                What DockWalker is
              </a>
            </li>
            <li>
              <a href="#eligibility" className="hover:underline">
                Eligibility
              </a>
            </li>
            <li>
              <a href="#accounts" className="hover:underline">
                Accounts and hats
              </a>
            </li>
            <li>
              <a href="#certs" className="hover:underline">
                Certification declarations
              </a>
            </li>
            <li>
              <a href="#nda" className="hover:underline">
                NDA vessels
              </a>
            </li>
            <li>
              <a href="#messaging" className="hover:underline">
                Messaging and documents
              </a>
            </li>
            <li>
              <a href="#payments" className="hover:underline">
                Payments and subscriptions
              </a>
            </li>
            <li>
              <a href="#conduct" className="hover:underline">
                Content and conduct
              </a>
            </li>
            <li>
              <a href="#deactivation" className="hover:underline">
                Deactivation and data
              </a>
            </li>
            <li>
              <a href="#privacy" className="hover:underline">
                Privacy
              </a>
            </li>
            <li>
              <a href="#liability" className="hover:underline">
                Limitation of liability
              </a>
            </li>
            <li>
              <a href="#changes" className="hover:underline">
                Changes to these terms
              </a>
            </li>
            <li>
              <a href="#governing-law" className="hover:underline">
                Governing law
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:underline">
                Contact
              </a>
            </li>
          </ol>
        </nav>

        <section id="what" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">1. What DockWalker is</h2>
          <p className="mt-2 text-muted-foreground">
            DockWalker is a hiring platform for the superyacht industry. It connects crew seeking
            daywork and permanent positions with employers and agencies posting those roles.
            DockWalker is not an employment agency and does not employ crew or guarantee placements.
          </p>
        </section>

        <section id="eligibility" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">2. Eligibility</h2>
          <p className="mt-2 text-muted-foreground">
            You must be at least 18 years old to use DockWalker. By creating an account, you confirm
            you are legally permitted to work in the maritime industry in the jurisdictions where
            you seek employment.
          </p>
        </section>

        <section id="accounts" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">3. Accounts and hats</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>One account per person. Duplicate accounts may be deactivated.</li>
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>
              You may switch between crew and employer roles using the hat switcher. Agency agents
              cannot switch roles.
            </li>
            <li>
              Providing false information — including certifications you do not hold — is grounds
              for immediate deactivation.
            </li>
          </ul>
        </section>

        <section id="certs" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">4. Certification declarations</h2>
          <p className="mt-2 text-muted-foreground">
            DockWalker does not verify certifications. Crew self-declare what they hold.
            Misrepresentation of certifications is a serious breach of these terms and may result in
            permanent deactivation. Employers must independently verify certifications before
            engagement.
          </p>
        </section>

        <section id="nda" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">5. NDA vessels</h2>
          <p className="mt-2 text-muted-foreground">
            Employers may mark vessels as NDA. Vessel identity — including IMO number and name — is
            hidden from crew until the crew member accepts a daywork engagement or is selected for a
            permanent role. Once revealed, crew must treat vessel identity as confidential.
          </p>
        </section>

        <section id="messaging" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">6. Messaging and documents</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Messages sent through DockWalker are retained on our servers and cannot be deleted by
              users.
            </li>
            <li>
              Do not share sensitive personal information — bank details, passport numbers, and
              similar — through in-app messaging.
            </li>
            <li>
              Shared documents expire after 48 hours and are only accessible to the two parties in
              the engagement.
            </li>
            <li>
              Voice calls are peer-to-peer and are not recorded by DockWalker. Only the duration is
              stored as a system message.
            </li>
          </ul>
        </section>

        <section id="payments" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">7. Payments and subscriptions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              DockWalker may offer paid subscription tiers for crew and employers. Subscriptions are
              processed through Stripe.
            </li>
            <li>
              Recurring charges continue until cancelled. You may cancel at any time; access
              continues until the end of the current billing period.
            </li>
            <li>Refunds are handled on a case-by-case basis.</li>
            <li>
              DockWalker does not process payments between crew and employers. Day rates and
              salaries shown on postings are informational only. Payment for work performed is a
              matter between the crew member and the employer.
            </li>
          </ul>
        </section>

        <section id="conduct" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">8. Content and conduct</h2>
          <p className="mt-2 text-muted-foreground">You must not:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Post fraudulent job listings.</li>
            <li>Harass, threaten, or abuse other users.</li>
            <li>Use the platform for any purpose other than legitimate superyacht hiring.</li>
            <li>
              Attempt to circumvent platform mechanics, including automated applications or
              scraping.
            </li>
            <li>Extract or crawl data from DockWalker beyond normal user interaction.</li>
          </ul>
        </section>

        <section id="deactivation" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">9. Deactivation and data</h2>
          <p className="mt-2 text-muted-foreground">
            You may deactivate your account at any time from the Settings page. After deactivation:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your profile is hidden from other users immediately.</li>
            <li>Your data is retained for 30 days for fraud prevention and dispute resolution.</li>
            <li>
              After 30 days, personal data is scrubbed via an append-only{' '}
              <span className="font-mono">PERSON.DATA_SCRUBBED</span> event.
            </li>
            <li>
              Event structure is retained for audit integrity. All personally identifying
              information is removed.
            </li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            You may request a full export of your data at any time from Settings (GDPR portability).
          </p>
        </section>

        <section id="privacy" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">10. Privacy</h2>
          <p className="mt-2 text-muted-foreground">
            See our{' '}
            <Link href="/privacy" className="text-[var(--accent)] hover:underline">
              Privacy Policy
            </Link>{' '}
            for details on data collection, storage, and your rights.
          </p>
        </section>

        <section id="liability" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">11. Limitation of liability</h2>
          <p className="mt-2 text-muted-foreground">
            DockWalker is provided on an &ldquo;as is&rdquo; basis. We do not guarantee:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>That any posting will receive applications.</li>
            <li>That any application will result in employment.</li>
            <li>The accuracy of information provided by other users.</li>
            <li>Continuous, uninterrupted access to the platform.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            To the maximum extent permitted by law, DockWalker&apos;s liability is limited to the
            amount you paid for your subscription in the 12 months preceding the claim.
          </p>
        </section>

        <section id="changes" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">12. Changes to these terms</h2>
          <p className="mt-2 text-muted-foreground">
            We may update these terms. Material changes will be communicated by email or in-app
            notification. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section id="governing-law" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">13. Governing law</h2>
          <p className="mt-2 text-muted-foreground">
            These terms are governed by the laws of {LEGAL.jurisdiction}. Disputes will be resolved
            in the courts of {LEGAL.jurisdiction}.
          </p>
        </section>

        <section id="contact" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">14. Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Questions about these terms:{' '}
            <a className="underline" href={`mailto:${LEGAL.supportEmail}`}>
              {LEGAL.supportEmail}
            </a>
          </p>
        </section>

        <footer className="mt-16 border-t border-[var(--border)] pt-6 text-sm text-muted-foreground">
          See also our{' '}
          <Link href="/privacy" className="text-[var(--accent)] hover:underline">
            Privacy Policy
          </Link>
          .
        </footer>
      </article>
    </main>
  );
}
