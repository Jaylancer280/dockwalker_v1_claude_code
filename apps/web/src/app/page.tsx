import Image from 'next/image';
import Link from 'next/link';
import { Search, Briefcase, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src="/images/onboarding/hero-aerial.jpg"
            alt=""
            fill
            className="object-cover object-center dark:saturate-[0.85] dark:brightness-[0.7]"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent 30%, var(--background) 100%)',
            }}
          />
        </div>
        <Image
          src="/images/brand/dw_app_icon_cropped.png"
          alt="DockWalker"
          width={80}
          height={80}
          className="mb-6 rounded-2xl"
          priority
        />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Superyacht hiring, simplified
        </h1>
        <p className="mt-3 max-w-sm text-base text-muted-foreground">
          Daywork cover and permanent placements for the superyacht industry — find work or fill
          roles, all in one place.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Sign up
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-border bg-muted/30 px-6 py-12">
        <div className="mx-auto flex max-w-lg flex-col gap-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-lo)] text-[var(--accent)]">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Short-term daywork cover</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Swipe through live postings and lock in 1-14 day engagements in seconds — no CV
                uploads, no agency calls.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--success-lo)] text-[var(--success)]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Permanent positions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Post a role, shortlist candidates, and place the right crew through a structured
                hiring pipeline.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-lo)] text-[var(--accent)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Smart features, fair visibility
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                AI career advisor, crew invitations, and pre-arrival checklists — with no hidden
                algorithms or pay-to-rank.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-6 text-center text-lg font-semibold text-foreground">How it works</h2>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)]">
              <Image
                src="/images/onboarding/crew-deckside.jpg"
                alt="Crew on deck"
                width={400}
                height={224}
                className="h-[120px] w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
              />
              <p className="px-2.5 py-2 text-center text-xs text-[var(--muted-foreground)]">
                For crew
              </p>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)]">
              <Image
                src="/images/onboarding/vessel-helm.jpg"
                alt="Vessel bridge"
                width={400}
                height={224}
                className="h-[120px] w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
              />
              <p className="px-2.5 py-2 text-center text-xs text-[var(--muted-foreground)]">
                For employers
              </p>
            </div>
          </div>
          <ol className="flex flex-col gap-4">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <p className="pt-0.5 text-sm text-muted-foreground">
                Create your profile — crew or employer
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <p className="pt-0.5 text-sm text-muted-foreground">
                Browse or post daywork and permanent roles in your port
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <p className="pt-0.5 text-sm text-muted-foreground">
                Connect, confirm, and get to work
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          DockWalker — Superyacht daywork and permanent hiring, all in one place
        </p>
        <Link
          href="/auth/login"
          className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
        >
          Already have an account? Log in
        </Link>
      </footer>
    </main>
  );
}
