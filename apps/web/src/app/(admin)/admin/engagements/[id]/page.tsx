'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/safe-fetch';
import { Badge } from '@/components/ui/badge';

interface EngagementDetail {
  id: string;
  status: string;
  type: string;
  crew_name: string;
  employer_name: string;
  crew_person_id: string;
  employer_person_id: string;
  daywork_id: string | null;
  permanent_posting_id: string | null;
  start_date: string;
  end_date: string;
  cancelled_by: string | null;
  cancellation_reason_category: string | null;
  cancellation_reason_text: string | null;
  created_at: string;
}

interface Message {
  id: string;
  sender_person_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

interface Rating {
  id: string;
  rater_role: string;
  overall_match: number;
  created_at: string;
}

export default function AdminEngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [engagement, setEngagement] = useState<EngagementDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safeFetch(`/api/admin/engagements/${id}`).then((res) => {
      if (res.ok) {
        const data = res.data as {
          engagement: EngagementDetail;
          messages: Message[];
          ratings: Rating[];
        };
        setEngagement(data.engagement);
        setMessages(data.messages);
        setRatings(data.ratings);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!engagement) return <p className="text-destructive">Not found</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">
        Engagement
        <Badge className="ml-2" variant={engagement.status === 'active' ? 'default' : 'secondary'}>
          {engagement.status}
        </Badge>
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {engagement.type} · Created {new Date(engagement.created_at).toLocaleDateString()}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Parties</h2>
        <div className="flex gap-8 text-sm">
          <div>
            <span className="text-muted-foreground">Crew:</span>{' '}
            <Link
              href={`/admin/users/${engagement.crew_person_id}`}
              className="text-primary underline"
            >
              {engagement.crew_name}
            </Link>
          </div>
          <div>
            <span className="text-muted-foreground">Employer:</span>{' '}
            <Link
              href={`/admin/users/${engagement.employer_person_id}`}
              className="text-primary underline"
            >
              {engagement.employer_name}
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm">
          {engagement.start_date} — {engagement.end_date}
        </p>
        {engagement.cancelled_by && (
          <p className="mt-1 text-sm text-destructive">
            Cancelled by {engagement.cancelled_by}
            {engagement.cancellation_reason_category
              ? ` (${engagement.cancellation_reason_category})`
              : ''}
            {engagement.cancellation_reason_text ? `: ${engagement.cancellation_reason_text}` : ''}
          </p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Messages ({messages.length})</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-auto rounded border p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm ${m.is_system ? 'italic text-muted-foreground' : ''}`}
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>{' '}
                <span className="font-medium">
                  {m.is_system
                    ? 'System'
                    : m.sender_person_id === engagement.crew_person_id
                      ? engagement.crew_name
                      : engagement.employer_name}
                  :
                </span>{' '}
                {m.content}
              </div>
            ))}
          </div>
        )}
      </section>

      {ratings.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Ratings</h2>
          {ratings.map((r) => (
            <div key={r.id} className="text-sm">
              {r.rater_role}: overall {r.overall_match}/5 —{' '}
              {new Date(r.created_at).toLocaleDateString()}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
