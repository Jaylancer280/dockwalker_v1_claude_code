import { redirect } from 'next/navigation';

/**
 * Standalone availability page — deprecated in favour of the AvailabilityOverlay
 * accessible from the profile page and discover page. Redirects to profile so
 * bookmarks and browser history still land somewhere functional.
 */
export default function AvailabilityPage() {
  redirect('/profile');
}
