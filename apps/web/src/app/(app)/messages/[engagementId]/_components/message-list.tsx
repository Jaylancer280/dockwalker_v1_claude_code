'use client';

import { type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type { Message, EngagementContext } from './types';
import { DayworkSummaryCard } from './daywork-summary-card';
import { PermanentSummaryCard } from './permanent-summary-card';
import { ChecklistCard } from './checklist-card';

interface MessageListProps {
  messages: Message[];
  context: EngagementContext | null;
  userId: string | null;
  loading: boolean;
  isCrew: boolean;
  isEmployer: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onChecklistToggle: (itemId: string, checked: boolean) => void;
  onEditChecklist: () => void;
}

export function MessageList({
  messages,
  context,
  userId,
  loading,
  isCrew,
  isEmployer,
  scrollContainerRef,
  messagesEndRef,
  onChecklistToggle,
  onEditChecklist,
}: MessageListProps) {
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="page-width-wide flex  flex-col gap-2">
        {loading && (
          <div className="flex items-center justify-center pt-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading &&
          context &&
          (context.type === 'permanent' ? (
            <PermanentSummaryCard context={context} />
          ) : context.dayworks ? (
            <DayworkSummaryCard context={context} />
          ) : (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-sm font-medium">Job details unavailable</p>
              <p className="text-xs text-muted-foreground">
                {context.start_date && context.end_date
                  ? `${context.start_date} — ${context.end_date}`
                  : 'Engagement dates not available'}
                {context.status && ` · ${context.status}`}
              </p>
            </div>
          ))}

        {!loading && context?.checklist && (
          <ChecklistCard
            items={context.checklist.items}
            acknowledgedItemIds={context.checklist.acknowledged_item_ids}
            isCrew={isCrew}
            isEmployer={isEmployer}
            onToggle={onChecklistToggle}
            onEdit={onEditChecklist}
          />
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        )}

        {messages.map((msg) => {
          if (msg.is_system) {
            return (
              <div key={msg.id} className="flex justify-center py-1">
                <div className="rounded-lg bg-[var(--surface)] px-3 py-1.5 text-center text-xs text-[var(--tertiary)]">
                  {msg.content}
                </div>
              </div>
            );
          }

          const isMine = msg.sender_person_id === userId;
          return (
            <div key={msg.id} className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="relative max-w-[80%] md:max-w-md">
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    isMine
                      ? 'bg-[var(--accent)] text-white rounded-br-md'
                      : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                <div className="mt-0.5">
                  <span className="font-mono text-[10px] text-[var(--tertiary)]">
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
  );
}
