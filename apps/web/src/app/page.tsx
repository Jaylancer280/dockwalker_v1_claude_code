import Image from 'next/image';
import Link from 'next/link';
import { Search, Briefcase, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      {/* Hero — logo-led, above the fold */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center md:py-24 md:text-left">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block md:bg-[radial-gradient(ellipse_at_top,var(--accent-lo)_0%,transparent_60%)]"
        />
        <div className="relative md:flex md:max-w-4xl md:flex-row-reverse md:items-center md:gap-14">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={208}
            height={208}
            sizes="(min-width: 768px) 208px, 144px"
            className="mx-auto mb-6 h-[144px] w-[144px] rounded-[28px] shadow-xl ring-1 ring-black/5 md:mx-0 md:mb-0 md:h-[208px] md:w-[208px]"
            priority
          />
          <div>
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-[-1px] text-foreground md:text-[52px]">
              DockWalker
            </h1>
            <p className="mt-2 text-[20px] font-medium text-foreground md:text-[24px]">
              Superyacht hiring, simplified.
            </p>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[var(--muted-foreground)] md:max-w-md md:text-[16px]">
              Swipe through live daywork postings. Apply for permanent roles. Connect directly with
              vessels — no hidden ranking, no pay-to-rank.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/auth/signup">Get started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                <Link href="/auth/login">Log in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-12">
        <div className="page-width-wide flex flex-col gap-8 md:flex-row md:gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-lo)] text-[var(--accent)]">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                Short-term daywork cover
              </h2>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                Swipe through live postings and lock in 1-14 day engagements in seconds — no CV
                uploads, no agency calls.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--success-lo)] text-[var(--success)]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Permanent positions</h2>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                Post a role, shortlist candidates, and place the right crew through a structured
                hiring pipeline.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-lo)] text-[var(--accent)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                Smart features, fair visibility
              </h2>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                AI career advisor, crew invitations, and pre-arrival checklists — with no hidden
                algorithms or pay-to-rank.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--border)] px-6 py-12">
        <div className="page-width-wide">
          <h2 className="mb-6 text-center text-lg font-semibold text-foreground">How it works</h2>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)]">
              <Image
                src="/images/onboarding/crew-deckside.jpg"
                alt="Crew on deck"
                width={400}
                height={224}
                sizes="(min-width: 768px) 384px, 100vw"
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
                sizes="(min-width: 768px) 384px, 100vw"
                className="h-[120px] w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
              />
              <p className="px-2.5 py-2 text-center text-xs text-[var(--muted-foreground)]">
                For employers
              </p>
            </div>
          </div>
          <ol className="flex flex-col gap-4">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                1
              </span>
              <p className="pt-0.5 text-sm text-[var(--muted-foreground)]">
                Create your profile — crew or employer
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                2
              </span>
              <p className="pt-0.5 text-sm text-[var(--muted-foreground)]">
                Browse or post daywork and permanent roles in your port
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                3
              </span>
              <p className="pt-0.5 text-sm text-[var(--muted-foreground)]">
                Connect, confirm, and get to work
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-6 text-center">
        <div className="page-width-wide">
          <p className="text-xs text-[var(--tertiary)]">
            DockWalker — Superyacht daywork and permanent hiring, all in one place
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-[var(--tertiary)]">
            <Link href="/auth/login" className="text-[var(--accent)] hover:underline">
              Log in
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
