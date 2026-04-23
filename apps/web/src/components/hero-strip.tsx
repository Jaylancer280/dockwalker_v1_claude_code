import Image from 'next/image';

/**
 * Decorative hero strip — thin maritime photo band above page headers or
 * tab content. Hidden on mobile (<md) to keep the viewport dense; appears
 * on tablet/desktop where there's horizontal whitespace to fill.
 *
 * 60px tall, full width, covers the area. Image is decorative — callers
 * should not pass meaningful alt text; screen readers skip it by default.
 */
export function HeroStrip({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <div className="relative hidden h-[60px] w-full overflow-hidden md:block">
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
    </div>
  );
}
