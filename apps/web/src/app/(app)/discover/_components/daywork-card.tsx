'use client';

import { forwardRef, useImperativeHandle } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { MapPin, Calendar, DollarSign, Award, MessageSquare, User } from 'lucide-react';
import Image from 'next/image';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { Badge } from '@/components/ui/badge';
import { getDepartmentImageSrc } from '@/lib/department-image';
import { currencySymbol, convertSizeBandLabel } from '@dockwalker/shared';
import { languageLabel } from '@dockwalker/shared';

export interface DayworkCard {
  id: string;
  job_number: number;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  status: string;
  created_at: string;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  vessels: {
    name: string;
    nda_flag: boolean;
    vessel_type: string;
    loa_meters: number | null;
    vessel_size_bands: { label: string } | null;
  } | null;
  experience_brackets: { label: string } | null;
  required_certification_ids: string[] | null;
  required_languages: string[];
  cert_names: string[];
  poster_person_id: string;
  poster_name: string | null;
  positions_available: number;
  positions_filled: number;
  positions_remaining: number;
  permanent_opportunity: boolean;
}

const SWIPE_THRESHOLD = 100;

export interface SwipeableCardHandle {
  triggerApplySwipe: () => void;
}

interface JobCardProps {
  card: DayworkCard;
  isPreview?: boolean;
  onComposeMessage?: () => void;
  onViewProfile?: (personId: string) => void;
  lengthUnit?: 'm' | 'ft';
  crewCertIds?: string[] | null;
  crewLangs?: string[] | null;
}

export function JobCard({
  card,
  isPreview,
  onComposeMessage,
  onViewProfile,
  lengthUnit = 'm',
  crewCertIds,
  crewLangs,
}: JobCardProps) {
  const bgSrc = getDepartmentImageSrc(card.yacht_roles?.department, card.id);

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[14px] border border-[var(--border)] ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      {/* Full-bleed department background */}
      <Image
        src={bgSrc}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        priority
      />
      {/* White wash overlay — image visible as faded watermark */}
      <div className="absolute inset-0 bg-white/90 dark:bg-black/85" />

      {/* Card content */}
      <div className="relative flex h-full flex-col p-5">
        {/* Role + vessel */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-[15px] font-semibold tracking-[-0.3px] flex items-center gap-1.5">
              {card.yacht_roles?.name ?? 'Unknown role'}
              {card.yacht_roles?.name && (
                <EpauletteBadge roleName={card.yacht_roles.name} size="sm" />
              )}
            </h3>
            {!isPreview && (
              <button
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile?.(card.poster_person_id);
                }}
              >
                <User className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">
            {card.vessels?.nda_flag
              ? 'NDA Vessel'
              : `${card.vessels?.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} ${card.vessels?.name ?? 'Unknown vessel'}`}
            {card.vessels?.loa_meters
              ? ` · ${card.vessels.loa_meters}m`
              : card.vessels?.vessel_size_bands?.label
                ? ` · ${convertSizeBandLabel(card.vessels.vessel_size_bands.label, lengthUnit)}`
                : ''}
          </p>
        </div>

        {/* Poster name + positions */}
        <div className="mb-2 flex items-center gap-2">
          {card.poster_name && (
            <p className="text-xs text-muted-foreground">Posted by {card.poster_name}</p>
          )}
          {card.positions_available > 1 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                card.positions_remaining === 1
                  ? 'bg-[var(--warning-lo)] text-[var(--warning)]'
                  : 'bg-[var(--accent-lo)] text-[var(--accent)]'
              }`}
            >
              {card.positions_remaining === 1
                ? 'Last position!'
                : `${card.positions_remaining}/${card.positions_available} open`}
            </span>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[13px]">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.ports?.name ?? 'Unknown'}
              {card.ports?.cities?.name && `, ${card.ports.cities.name}`}
              {card.ports?.cities?.regions?.name && ` · ${card.ports.cities.regions.name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.start_date} — {card.end_date} ({card.working_days} working day
              {card.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-mono text-[17px] font-bold tracking-[-0.5px]">
                {currencySymbol(card.currency)}
                {card.day_rate}
              </span>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)] opacity-60">
                /day
              </span>
            </span>
          </div>

          {card.experience_brackets?.label && (
            <div className="flex items-center gap-2 text-[13px]">
              <Award className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{card.experience_brackets.label}</span>
            </div>
          )}

          {/* Cert pills */}
          {card.cert_names && card.cert_names.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {card.cert_names.map((certName, idx) => {
                const certId = card.required_certification_ids?.[idx];
                const held = crewCertIds != null && certId != null && crewCertIds.includes(certId);
                const missing =
                  crewCertIds != null && certId != null && !crewCertIds.includes(certId);
                return (
                  <span
                    key={certId ?? certName}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      held
                        ? 'bg-[var(--success-lo)] text-[var(--success)]'
                        : missing
                          ? 'bg-[var(--warning-lo)] text-[var(--warning)]'
                          : 'border border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    {certName}
                  </span>
                );
              })}
            </div>
          )}
          {card.required_languages && card.required_languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {card.required_languages.map((code) => {
                const held = crewLangs != null && crewLangs.includes(code);
                const missing = crewLangs != null && !crewLangs.includes(code);
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      held
                        ? 'bg-[var(--success-lo)] text-[var(--success)]'
                        : missing
                          ? 'bg-[var(--warning-lo)] text-[var(--warning)]'
                          : 'border border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    {languageLabel(code)}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Meals + badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.meals &&
            card.meals.length > 0 &&
            card.meals.map((meal) => (
              <Badge key={meal} variant="secondary" className="text-xs capitalize">
                {meal}
              </Badge>
            ))}
          {card.permanent_opportunity && (
            <Badge variant="outline" className="text-xs">
              Could go permanent
            </Badge>
          )}
        </div>

        {/* Notes */}
        {card.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{card.notes}</p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer with divider */}
        <div className="mt-2 border-t border-[var(--border)] pt-2 flex items-center justify-between">
          {onComposeMessage ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComposeMessage();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Apply with a message
            </button>
          ) : (
            <span className="font-mono text-[11px] text-[var(--tertiary)]">
              DW-{String(card.job_number).padStart(5, '0')}
            </span>
          )}
          <span className="font-mono text-[11px] text-[var(--tertiary)]">
            {onComposeMessage
              ? `DW-${String(card.job_number).padStart(5, '0')}`
              : `Posted ${new Date(card.created_at).toLocaleDateString()}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export const SwipeableCard = forwardRef<
  SwipeableCardHandle,
  {
    card: DayworkCard;
    onApply: () => void;
    onPass: () => void;
    onComposeMessage: () => void;
    canApply: boolean;
    onAvailabilityGate: () => void;
    composing: boolean;
    disabled: boolean;
    lengthUnit?: 'm' | 'ft';
    onViewProfile?: (personId: string) => void;
    crewCertIds: string[] | null;
    crewLangs: string[] | null;
  }
>(function SwipeableCard(
  {
    card,
    onApply,
    onPass,
    onComposeMessage,
    canApply,
    onAvailabilityGate,
    composing,
    disabled,
    lengthUnit = 'm',
    onViewProfile,
    crewCertIds,
    crewLangs,
  },
  ref,
) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const applyOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  useImperativeHandle(ref, () => ({
    triggerApplySwipe() {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
    },
  }));

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled || composing) return;

    if (info.offset.x > SWIPE_THRESHOLD) {
      // Right swipe = apply — check availability first
      if (!canApply) {
        // Snap back and show availability gate
        animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        onAvailabilityGate();
        return;
      }
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onApply, 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      hapticLight();
      animate(x, -400, { duration: 0.3 });
      setTimeout(onPass, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag={composing ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
    >
      {/* Swipe indicators */}
      <motion.div
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-success bg-success/10 px-3 py-1 text-sm font-bold text-success"
        style={{ opacity: applyOpacity }}
      >
        APPLY
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <JobCard
        card={card}
        onComposeMessage={composing ? undefined : onComposeMessage}
        onViewProfile={onViewProfile}
        lengthUnit={lengthUnit}
        crewCertIds={crewCertIds}
        crewLangs={crewLangs}
      />
    </motion.div>
  );
});
