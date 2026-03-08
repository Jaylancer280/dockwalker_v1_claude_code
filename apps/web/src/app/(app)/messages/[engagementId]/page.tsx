'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Send,
  Loader2,
  MapPin,
  Calendar,
  XCircle,
  Briefcase,
  Anchor,
  Utensils,
  Banknote,
  CheckCircle,
  AlertTriangle,
  Star,
  ClipboardCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
}

interface RatingData {
  id: string;
  rater_role: string;
  pay_accuracy: string | null;
  meals_accuracy: string | null;
  role_accuracy: string | null;
  working_days_accuracy: string | null;
  vessel_condition: number | null;
  would_work_on_vessel_again: boolean | null;
  skills_as_advertised: string | null;
  certifications_verified: string | null;
  punctuality: string | null;
  would_rehire: boolean | null;
  communication_accuracy: boolean | null;
  overall_match: number | null;
}

interface EngagementContext {
  id: string;
  crew_person_id: string;
  employer_person_id: string;
  start_date: string;
  end_date: string;
  status: string;
  crew_completion_status: string | null;
  dayworks: {
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    yacht_roles: { name: string } | null;
    ports: { name: string; cities: { name: string } | null } | null;
    vessels: { name: string } | null;
  } | null;
  other_name: string;
  has_rated: boolean;
  my_rating: RatingData | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '\u20AC',
  USD: '$',
  GBP: '\u00A3',
  AED: '\u062F.\u0625',
};

const POLL_INTERVAL = 5000;

export default function ChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<EngagementContext | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages/${engagementId}`);
    const data = await res.json();
    if (data.messages) setMessages(data.messages);
    setLoading(false);
  }, [engagementId]);

  // Load engagement context, current user, messages, and start polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function init() {
      const [ctxRes, userRes] = await Promise.all([
        fetch(`/api/messages/${engagementId}/context`),
        fetch('/api/auth/me'),
        loadMessages(),
      ]);
      const ctxData = await ctxRes.json().catch(() => ({}));
      const userData = await userRes.json().catch(() => ({}));
      if (ctxData.engagement) setContext(ctxData.engagement);
      if (userData.userId) setUserId(userData.userId);

      // Start polling after initial load
      interval = setInterval(() => void loadMessages(), POLL_INTERVAL);
      pollRef.current = interval;
    }

    void init();
    return () => clearInterval(interval);
  }, [engagementId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const res = await fetch(`/api/messages/${engagementId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.trim() }),
    });

    if (res.ok) {
      setInput('');
      await loadMessages();
    }
    setSending(false);
  }

  async function handleCancelEngagement() {
    if (!context || !userId) return;
    const isCrew = context.crew_person_id === userId;
    const endpoint = isCrew ? 'cancel-crew' : 'cancel-employer';

    if (!confirm('Are you sure you want to cancel this engagement? This cannot be undone.')) {
      return;
    }

    setCancelling(true);
    const res = await fetch(`/api/engagements/${engagementId}/${endpoint}`, { method: 'POST' });
    if (res.ok) {
      router.push('/messages');
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to cancel');
    }
    setCancelling(false);
  }

  async function handleConfirmCompletion(confirmed: boolean) {
    if (!context) return;
    setConfirming(true);
    const res = await fetch(`/api/engagements/${engagementId}/confirm-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed }),
    });
    if (res.ok) {
      const data = await res.json();
      setContext((prev) => (prev ? { ...prev, crew_completion_status: data.status } : prev));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Failed to confirm');
    }
    setConfirming(false);
  }

  async function handleSubmitRating(ratingData: Record<string, unknown>) {
    setSubmittingRating(true);
    const res = await fetch(`/api/engagements/${engagementId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ratingData),
    });
    if (res.ok) {
      const responseData = await res.json().catch(() => ({}));
      setContext((prev) =>
        prev
          ? {
              ...prev,
              has_rated: true,
              my_rating: {
                id: responseData.id ?? 'local',
                rater_role: isCrew ? 'crew' : 'employer',
                pay_accuracy: (ratingData.pay_accuracy as string) ?? null,
                meals_accuracy: (ratingData.meals_accuracy as string) ?? null,
                role_accuracy: (ratingData.role_accuracy as string) ?? null,
                working_days_accuracy: (ratingData.working_days_accuracy as string) ?? null,
                vessel_condition: (ratingData.vessel_condition as number) ?? null,
                would_work_on_vessel_again:
                  (ratingData.would_work_on_vessel_again as boolean) ?? null,
                skills_as_advertised: (ratingData.skills_as_advertised as string) ?? null,
                certifications_verified: (ratingData.certifications_verified as string) ?? null,
                punctuality: (ratingData.punctuality as string) ?? null,
                would_rehire: (ratingData.would_rehire as boolean) ?? null,
                communication_accuracy: (ratingData.communication_accuracy as boolean) ?? null,
                overall_match: (ratingData.overall_match as number) ?? null,
              },
            }
          : prev,
      );
      setShowRating(false);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Failed to submit rating');
    }
    setSubmittingRating(false);
  }

  // Determine if rating should be shown
  const isCrew = context?.crew_person_id === userId;
  const isEmployer = context?.employer_person_id === userId;
  const canRate =
    context?.status === 'completed' &&
    context.has_rated === false &&
    ((isCrew && context.crew_completion_status !== null) || isEmployer === true);

  return (
    <main className="flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] flex-col bg-background">
      {/* Header with engagement context */}
      <header className="shrink-0 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{context?.other_name ?? 'Chat'}</h1>
            {context && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {context.dayworks?.yacht_roles?.name && (
                  <span>{context.dayworks.yacht_roles.name}</span>
                )}
                {context.dayworks?.ports?.name && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {context.dayworks.ports.name}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {context.start_date} — {context.end_date}
                </span>
              </div>
            )}
          </div>
          {context && context.status !== 'completed' && context.status !== 'cancelled' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEngagement}
              disabled={cancelling}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && context?.dayworks && <DayworkSummaryCard context={context} />}

          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
          )}

          {messages.map((msg) => {
            const isMine = msg.sender_person_id === userId;
            return (
              <div
                key={msg.id}
                className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-accent text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer: completion banners stacked above message input */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-safe">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {/* Completion banner — only shown when engagement is completed */}
          {context?.status === 'completed' && (
            <CompletionBanner
              context={context}
              userId={userId}
              isCrew={isCrew ?? false}
              isEmployer={isEmployer ?? false}
              canRate={canRate ?? false}
              confirming={confirming}
              onConfirm={handleConfirmCompletion}
              onOpenRating={() => setShowRating(true)}
            />
          )}

          {context?.status === 'cancelled' && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-accent/50 p-3 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span>This engagement was cancelled</span>
            </div>
          )}

          {/* Message input — always visible, disabled when completed or cancelled */}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                context?.status === 'completed' || context?.status === 'cancelled'
                  ? 'This engagement has ended'
                  : 'Type a message...'
              }
              className="flex-1 rounded-full border border-border bg-accent px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              disabled={
                sending || context?.status === 'completed' || context?.status === 'cancelled'
              }
            />
            <Button
              type="submit"
              size="icon"
              disabled={
                sending ||
                !input.trim() ||
                context?.status === 'completed' ||
                context?.status === 'cancelled'
              }
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Rating form overlay */}
      {showRating && context && userId && (
        <RatingFormOverlay
          isCrew={isCrew ?? false}
          submitting={submittingRating}
          onSubmit={handleSubmitRating}
          onCancel={() => setShowRating(false)}
        />
      )}
    </main>
  );
}

function CompletionBanner({
  context,
  userId,
  isCrew,
  isEmployer,
  canRate,
  confirming,
  onConfirm,
  onOpenRating,
}: {
  context: EngagementContext;
  userId: string | null;
  isCrew: boolean;
  isEmployer: boolean;
  canRate: boolean;
  confirming: boolean;
  onConfirm: (confirmed: boolean) => void;
  onOpenRating: () => void;
}) {
  // Crew needs to confirm/dispute
  if (isCrew && userId === context.crew_person_id && context.crew_completion_status === null) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-accent/50 p-3">
        <p className="text-center text-sm text-muted-foreground">
          The employer has marked this daywork as completed. Please confirm or dispute.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onConfirm(false)}
            disabled={confirming}
            size="sm"
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Dispute
          </Button>
          <Button
            className="flex-1"
            onClick={() => onConfirm(true)}
            disabled={confirming}
            size="sm"
          >
            {confirming ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-4 w-4" />
            )}
            Confirm completed
          </Button>
        </div>
      </div>
    );
  }

  // Can rate but hasn't yet
  if (canRate) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/50 p-3">
        <CompletionStatusLine context={context} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onOpenRating}>
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Rate
        </Button>
      </div>
    );
  }

  // Already rated — show expandable summary
  if (context.has_rated) {
    return <RatedBanner context={context} />;
  }

  // Employer waiting for crew to confirm
  if (isEmployer && !context.crew_completion_status) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-accent/50 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Waiting for crew to confirm completion</span>
      </div>
    );
  }

  // Fallback: just show completion status
  if (context.crew_completion_status) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-accent/50 p-3">
        <CompletionStatusLine context={context} />
      </div>
    );
  }

  return null;
}

function CompletionStatusLine({ context }: { context: EngagementContext }) {
  if (!context.crew_completion_status) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {context.crew_completion_status === 'confirmed' ? (
        <>
          <CheckCircle className="h-4 w-4 text-success" />
          <span>Completion confirmed by crew</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>Completion disputed by crew</span>
        </>
      )}
    </div>
  );
}

function RatedBanner({ context }: { context: EngagementContext }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-accent/50 p-3">
      <div className="flex items-center justify-between">
        <CompletionStatusLine context={context} />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Star className="h-4 w-4 text-primary" />
          <span>{expanded ? 'Hide rating' : 'View rating'}</span>
        </button>
      </div>
      {expanded && context.my_rating && <RatingSummary rating={context.my_rating} />}
    </div>
  );
}

function RatingSummary({ rating }: { rating: RatingData }) {
  const isCrew = rating.rater_role === 'crew';

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {isCrew ? (
        <>
          <SummaryRow label="Pay honoured" value={formatTriOption(rating.pay_accuracy)} />
          <SummaryRow label="Meals provided" value={formatTriOption(rating.meals_accuracy)} />
          <SummaryRow label="Role matched listing" value={formatTriOption(rating.role_accuracy)} />
          <SummaryRow label="Working days" value={formatDaysOption(rating.working_days_accuracy)} />
          <SummaryRow label="Vessel condition" value={formatStars(rating.vessel_condition)} />
          <SummaryRow
            label="Would work on vessel again"
            value={formatBoolean(rating.would_work_on_vessel_again)}
          />
        </>
      ) : (
        <>
          <SummaryRow
            label="Skills matched profile"
            value={formatTriOption(rating.skills_as_advertised)}
          />
          <SummaryRow
            label="Certifications verified"
            value={formatCertOption(rating.certifications_verified)}
          />
          <SummaryRow label="Punctuality" value={formatTriOption(rating.punctuality)} />
          <SummaryRow label="Would rehire" value={formatBoolean(rating.would_rehire)} />
        </>
      )}
      <SummaryRow
        label="Communication clear"
        value={formatBoolean(rating.communication_accuracy)}
      />
      <SummaryRow label="Overall match" value={formatStars(rating.overall_match)} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatTriOption(val: string | null): string {
  if (!val) return '—';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', partial: 'Partial' };
  return map[val] ?? val;
}

function formatDaysOption(val: string | null): string {
  if (!val) return '—';
  const map: Record<string, string> = { fewer: 'Fewer', as_listed: 'As listed', more: 'More' };
  return map[val] ?? val;
}

function formatCertOption(val: string | null): string {
  if (!val) return '—';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', not_checked: 'Not checked' };
  return map[val] ?? val;
}

function formatBoolean(val: boolean | null): string {
  if (val === null) return '—';
  return val ? 'Yes' : 'No';
}

function formatStars(val: number | null): string {
  if (!val) return '—';
  return '\u2605'.repeat(val) + '\u2606'.repeat(5 - val);
}

type TriOption = 'yes' | 'no' | 'partial';
type DaysOption = 'fewer' | 'as_listed' | 'more';
type CertOption = 'yes' | 'no' | 'not_checked';

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-accent hover:bg-accent/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
            <Star
              className={`h-6 w-6 ${
                n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <OptionGroup
      label={label}
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      value={value === null ? null : value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
    />
  );
}

const YES_NO_PARTIAL = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partial', label: 'Partial' },
];

function RatingFormOverlay({
  isCrew,
  submitting,
  onSubmit,
  onCancel,
}: {
  isCrew: boolean;
  submitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  // Crew fields
  const [payAccuracy, setPayAccuracy] = useState<TriOption | null>(null);
  const [mealsAccuracy, setMealsAccuracy] = useState<TriOption | null>(null);
  const [roleAccuracy, setRoleAccuracy] = useState<TriOption | null>(null);
  const [workingDaysAccuracy, setWorkingDaysAccuracy] = useState<DaysOption | null>(null);
  const [vesselCondition, setVesselCondition] = useState(0);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);

  // Employer fields
  const [skillsAsAdvertised, setSkillsAsAdvertised] = useState<TriOption | null>(null);
  const [certsVerified, setCertsVerified] = useState<CertOption | null>(null);
  const [punctuality, setPunctuality] = useState<TriOption | null>(null);
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(null);

  // Symmetric fields
  const [commAccuracy, setCommAccuracy] = useState<boolean | null>(null);
  const [overallMatch, setOverallMatch] = useState(0);

  const crewValid =
    payAccuracy !== null &&
    mealsAccuracy !== null &&
    roleAccuracy !== null &&
    workingDaysAccuracy !== null &&
    vesselCondition > 0 &&
    wouldWorkAgain !== null &&
    commAccuracy !== null &&
    overallMatch > 0;

  const employerValid =
    skillsAsAdvertised !== null &&
    certsVerified !== null &&
    punctuality !== null &&
    wouldRehire !== null &&
    commAccuracy !== null &&
    overallMatch > 0;

  const isValid = isCrew ? crewValid : employerValid;

  function handleSubmit() {
    if (!isValid) return;
    if (isCrew) {
      onSubmit({
        pay_accuracy: payAccuracy,
        meals_accuracy: mealsAccuracy,
        role_accuracy: roleAccuracy,
        working_days_accuracy: workingDaysAccuracy,
        vessel_condition: vesselCondition,
        would_work_on_vessel_again: wouldWorkAgain,
        communication_accuracy: commAccuracy,
        overall_match: overallMatch,
      });
    } else {
      onSubmit({
        skills_as_advertised: skillsAsAdvertised,
        certifications_verified: certsVerified,
        punctuality,
        would_rehire: wouldRehire,
        communication_accuracy: commAccuracy,
        overall_match: overallMatch,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-lg animate-in slide-in-from-bottom flex-col rounded-t-2xl bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold">Rate this engagement</h2>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {/* Scrollable form content */}
        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto px-4 pb-2">
          {isCrew ? (
            <>
              <OptionGroup
                label="Was the agreed day rate honoured?"
                options={YES_NO_PARTIAL}
                value={payAccuracy}
                onChange={(v) => setPayAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Were the listed meals provided?"
                options={YES_NO_PARTIAL}
                value={mealsAccuracy}
                onChange={(v) => setMealsAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Did the work match the advertised role?"
                options={YES_NO_PARTIAL}
                value={roleAccuracy}
                onChange={(v) => setRoleAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Did the actual days match the listing?"
                options={[
                  { value: 'fewer', label: 'Fewer' },
                  { value: 'as_listed', label: 'As listed' },
                  { value: 'more', label: 'More' },
                ]}
                value={workingDaysAccuracy}
                onChange={(v) => setWorkingDaysAccuracy(v as DaysOption)}
              />
              <StarRating
                label="Vessel condition"
                value={vesselCondition}
                onChange={setVesselCondition}
              />
              <BooleanToggle
                label="Would you work on this vessel again?"
                value={wouldWorkAgain}
                onChange={setWouldWorkAgain}
              />
            </>
          ) : (
            <>
              <OptionGroup
                label="Did the crew's abilities match their profile?"
                options={YES_NO_PARTIAL}
                value={skillsAsAdvertised}
                onChange={(v) => setSkillsAsAdvertised(v as TriOption)}
              />
              <OptionGroup
                label="Were claimed certifications valid?"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                  { value: 'not_checked', label: 'Not checked' },
                ]}
                value={certsVerified}
                onChange={(v) => setCertsVerified(v as CertOption)}
              />
              <OptionGroup
                label="Was the crew member punctual?"
                options={YES_NO_PARTIAL}
                value={punctuality}
                onChange={(v) => setPunctuality(v as TriOption)}
              />
              <BooleanToggle
                label="Would you rehire for a similar daywork?"
                value={wouldRehire}
                onChange={setWouldRehire}
              />
            </>
          )}

          <div className="border-t border-border pt-3">
            <BooleanToggle
              label="Was communication clear and honest?"
              value={commAccuracy}
              onChange={setCommAccuracy}
            />
          </div>
          <StarRating
            label="Overall, how well did reality match the listing?"
            value={overallMatch}
            onChange={setOverallMatch}
          />
        </div>

        {/* Fixed submit button at bottom */}
        <div className="border-t border-border px-4 py-3">
          <Button className="w-full" disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Star className="mr-1.5 h-4 w-4" />
            )}
            Submit rating
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayworkSummaryCard({ context }: { context: EngagementContext }) {
  const dw = context.dayworks;
  if (!dw) return null;

  const symbol = CURRENCY_SYMBOLS[dw.currency] ?? dw.currency;
  const location = [dw.ports?.name, dw.ports?.cities?.name].filter(Boolean).join(', ');

  return (
    <div className="mb-4 rounded-xl border border-border bg-accent/50 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Daywork details
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        {dw.yacht_roles?.name && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">{dw.yacht_roles.name}</span>
          </div>
        )}
        {dw.vessels?.name && (
          <div className="flex items-center gap-2">
            <Anchor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{dw.vessels.name}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            {context.start_date} — {context.end_date} ({dw.working_days} day
            {dw.working_days !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            {symbol}
            {dw.day_rate}/day
          </span>
        </div>
        {dw.meals && dw.meals.length > 0 && (
          <div className="flex items-center gap-2">
            <Utensils className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="capitalize">{dw.meals.join(', ')}</span>
          </div>
        )}
        {dw.notes && <p className="mt-1 text-xs text-muted-foreground">{dw.notes}</p>}
      </div>
    </div>
  );
}
