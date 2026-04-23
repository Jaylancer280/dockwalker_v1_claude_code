import Image from 'next/image';

/**
 * Desktop-only ambient photo behind the auth card on /auth/login,
 * /auth/signup, /auth/forgot-password, /auth/reset-password. Fixed
 * full-viewport background with a dark scrim so form contrast is
 * preserved. Hidden on mobile — phones keep the solid/radial treatment
 * of the parent <main> to avoid a heavy hero on small screens.
 *
 * Place as the first child of the page's <main> element and rely on the
 * `-z-10` to sit behind the existing card and radial gradient.
 */
export function AuthAmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden md:block">
      <Image
        src="/images/onboarding/hero-bow.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
    </div>
  );
}
