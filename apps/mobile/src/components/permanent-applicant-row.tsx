import { View, Text, Pressable } from 'react-native';
import type { PermanentApplicant } from '@/hooks/use-permanent-applicants';
import { getDepartmentColor } from '@dockwalker/shared';
import { Button } from '@/components/ui';

interface PermanentApplicantRowProps {
  applicant: PermanentApplicant;
  onShortlist?: (a: PermanentApplicant) => void;
  onReject: (a: PermanentApplicant) => void;
  onSelect?: (a: PermanentApplicant) => void;
  canSelect?: boolean;
}

export function PermanentApplicantRow({
  applicant,
  onShortlist,
  onReject,
  onSelect,
  canSelect,
}: PermanentApplicantRowProps) {
  const dept = applicant.role_department ?? 'deck';
  const barColor = getDepartmentColor(dept) === 'gold' ? '#B8860B' : '#708090';

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 10 }}>
      <View style={{ height: 3, backgroundColor: barColor }} />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>{(applicant.display_name ?? '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
              {applicant.display_name}{applicant.nationality_flag ? ` ${applicant.nationality_flag}` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{applicant.role_name ?? ''}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {applicant.permanent_availability && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>
                {applicant.permanent_availability === 'immediate' ? 'Available now' :
                 applicant.permanent_availability === 'after_notice' ? `${applicant.notice_period_days}d notice` :
                 'Not looking'}
              </Text>
            </View>
          )}
          {applicant.experience_label && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>{applicant.experience_label}</Text>
            </View>
          )}
        </View>

        {applicant.message && (
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic' }} numberOfLines={2}>
              &quot;{applicant.message}&quot;
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onShortlist && (
            <Button
              variant="primary"
              size="sm"
              label="Shortlist"
              onPress={() => onShortlist(applicant)}
              style={{ flex: 1 }}
            />
          )}
          {onSelect && (
            <Button
              variant="primary"
              size="sm"
              label="Select"
              disabled={!canSelect}
              onPress={() => canSelect && onSelect(applicant)}
              style={{ flex: 1 }}
            />
          )}
          <Pressable
            onPress={() => onReject(applicant)}
            style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Reject</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
