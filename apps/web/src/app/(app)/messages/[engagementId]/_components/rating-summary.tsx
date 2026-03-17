import type { RatingData } from './types';

export function RatingSummary({ rating }: { rating: RatingData }) {
  const isCrew = rating.rater_role === 'crew';
  const isCancelled = rating.rating_context === 'cancelled';

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {isCancelled ? (
        <>
          {isCrew && (
            <SummaryRow
              label="Reasonable notice given"
              value={formatTriOption(rating.notice_given)}
            />
          )}
        </>
      ) : isCrew ? (
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
          {rating.permanent_opportunity_accuracy && (
            <SummaryRow
              label="Led to permanent opportunity"
              value={formatPermOpAccuracy(rating.permanent_opportunity_accuracy)}
            />
          )}
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
  if (!val) return '\u2014';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', partial: 'Partial' };
  return map[val] ?? val;
}

function formatDaysOption(val: string | null): string {
  if (!val) return '\u2014';
  const map: Record<string, string> = { fewer: 'Fewer', as_listed: 'As listed', more: 'More' };
  return map[val] ?? val;
}

function formatCertOption(val: string | null): string {
  if (!val) return '\u2014';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', not_checked: 'Not checked' };
  return map[val] ?? val;
}

function formatPermOpAccuracy(val: string | null): string {
  if (!val) return '\u2014';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', not_applicable: 'N/A' };
  return map[val] ?? val;
}

function formatBoolean(val: boolean | null): string {
  if (val === null) return '\u2014';
  return val ? 'Yes' : 'No';
}

function formatStars(val: number | null): string {
  if (!val) return '\u2014';
  return '\u2605'.repeat(val) + '\u2606'.repeat(5 - val);
}
