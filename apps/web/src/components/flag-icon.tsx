/**
 * FlagIcon — renders a country flag from an ISO 3166-1 alpha-2 code via the
 * `flag-icons` CSS library. Replaces the previous `<span>{flag_emoji}</span>`
 * pattern which broke on Windows (regional-indicator emojis fall back to
 * the underlying letters — "🇿🇦" → "ZA", "🇬🇧" → "GB").
 *
 * Falls back to the legacy emoji string when no `code` is provided, so
 * surfaces that haven't yet been migrated to plumb country_code through
 * the API still render *something* (just with the same OS rendering
 * caveat). Once every consumer is on country_code the fallback can be
 * removed.
 *
 * Usage:
 *   <FlagIcon code="ZA" name="South African" />            // renders 🇿🇦 SVG
 *   <FlagIcon code={null} name="South African" emoji="🇿🇦" /> // emoji fallback
 */

interface FlagIconProps {
  /** ISO 3166-1 alpha-2 country code, e.g. "ZA". Case-insensitive. */
  code: string | null | undefined;
  /** Country / nationality display name — used as aria-label for a11y. */
  name?: string | null;
  /** Optional emoji fallback when `code` is unknown. */
  emoji?: string | null;
  /** Tailwind sizing/spacing classes. Default `text-base` (1em). */
  className?: string;
}

export function FlagIcon({ code, name, emoji, className = '' }: FlagIconProps) {
  if (code) {
    const cc = code.toLowerCase();
    return (
      <span
        role="img"
        aria-label={name ? `${name} flag` : `${code} flag`}
        className={`fi fi-${cc} rounded-[2px] ${className}`}
      />
    );
  }
  if (emoji) {
    return (
      <span role="img" aria-label={name ? `${name} flag` : 'flag'} className={className}>
        {emoji}
      </span>
    );
  }
  return null;
}
