'use client';

import { Separator } from '@/components/ui/separator';

export interface NotificationPrefs {
  email_enabled: boolean;
  push_jobs: boolean;
  push_applications: boolean;
  push_messages: boolean;
  push_reminders: boolean;
}

export interface NotificationsSectionProps {
  notifPrefs: NotificationPrefs;
  notifLoaded: boolean;
  onToggle: (field: keyof NotificationPrefs) => void;
}

export function NotificationsSection({
  notifPrefs,
  notifLoaded,
  onToggle,
}: NotificationsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Notifications
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        DockWalker keeps you updated through the app. Push notifications let you know instantly when
        something needs your attention. We&apos;ll only send an email if push isn&apos;t available —
        and even then, only for the important stuff.
      </p>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card">
        <h3 className="px-4 pt-3 text-xs font-semibold text-muted-foreground">
          Push notifications
        </h3>
        {[
          {
            field: 'push_jobs' as const,
            label: 'New jobs nearby',
            subtitle: 'When daywork is posted in your area',
          },
          {
            field: 'push_applications' as const,
            label: 'Applications',
            subtitle: "When crew apply to your postings or you're shortlisted",
          },
          {
            field: 'push_messages' as const,
            label: 'Messages',
            subtitle: 'When you receive a new message',
          },
          {
            field: 'push_reminders' as const,
            label: 'Reminders',
            subtitle: 'Engagement start dates and availability expiry',
          },
        ].map(({ field, label, subtitle }) => (
          <div key={field}>
            <Separator />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[field]}
                disabled={!notifLoaded}
                onClick={() => onToggle(field)}
                className={`relative h-6 w-11 rounded-full transition-colors ${notifPrefs[field] ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${notifPrefs[field] ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
        ))}

        <Separator />

        <h3 className="px-4 pt-3 text-xs font-semibold text-muted-foreground">
          Email notifications
        </h3>
        <Separator />
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">Email backup</p>
            <p className="text-xs text-muted-foreground">
              Receive emails for critical updates when push isn&apos;t active
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifPrefs.email_enabled}
            disabled={!notifLoaded}
            onClick={() => onToggle('email_enabled')}
            className={`relative h-6 w-11 rounded-full transition-colors ${notifPrefs.email_enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${notifPrefs.email_enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground">
            We only email when you&apos;re accepted for a job, selected for a permanent role, or
            have an engagement starting tomorrow. If push is enabled, we won&apos;t email at all.
          </p>
        </div>
      </div>
    </section>
  );
}
