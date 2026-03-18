import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Search, Handshake } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/images/brand/dw_app_icon_cropped.png"
          alt="DockWalker"
          width={80}
          height={80}
          className="mb-6 rounded-2xl"
          priority
        />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Superyacht daywork, simplified
        </h1>
        <p className="mt-3 max-w-sm text-base text-muted-foreground">
          The fast-dispatch hiring layer for short-term superyacht crew — find work or fill roles in
          seconds.
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sea/10 text-sea">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Find daywork fast</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse live postings and apply in seconds — no CV uploads, no agency calls.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Anchor className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Fill roles today</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Post a job, review applicants, and confirm crew — all from your phone.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Structured, fair, transparent
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No hidden algorithms, no pay-to-rank. Every crew member gets the same visibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-6 text-center text-lg font-semibold text-foreground">How it works</h2>
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
                Browse or post daywork in your port
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
          DockWalker — Superyacht daywork hiring: find crew or find work
        </p>
        <Link href="/auth/login" className="mt-2 inline-block text-xs text-sea hover:underline">
          Already have an account? Log in
        </Link>
      </footer>
    </main>
  );
}
