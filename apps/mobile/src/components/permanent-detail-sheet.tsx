import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { currencySymbol, getDepartmentColor } from '@dockwalker/shared';
import type { HydratedPermanent } from '@/hooks/use-permanent-discover';
import { useCertifications } from '@/hooks/use-canonical';
import { colors, Button } from '@/components/ui';

function formatSalary(p: HydratedPermanent): string {
  const sym = currencySymbol(p.salary_currency);
  const period = p.salary_period === 'annual' ? '/yr' : '/mo';
  if (p.salary_min && p.salary_max && p.salary_min !== p.salary_max) {
    return `${sym}${p.salary_min.toLocaleString()} - ${sym}${p.salary_max.toLocaleString()}${period}`;
  }
  const val = p.salary_max ?? p.salary_min;
  return val ? `${sym}${val.toLocaleString()}${period}` : 'Salary TBD';
}

function formatStartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PermanentDetailSheetProps {
  posting: HydratedPermanent | null;
  crewCertIds: string[];
  onApply: (postingId: string, message?: string) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

export function PermanentDetailSheet({
  posting,
  crewCertIds,
  onApply,
  onDismiss,
  isApplying,
}: PermanentDetailSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [message, setMessage] = useState('');
  const { data: allCerts } = useCertifications();

  const handleClose = useCallback(() => {
    setMessage('');
    onDismiss();
  }, [onDismiss]);

  const handleApply = useCallback(() => {
    if (!posting) return;
    onApply(posting.id, message.trim() || undefined);
  }, [posting, onApply, message]);

  if (!posting) return null;

  // Cert hard-gate
  const requiredIds = posting.required_certification_ids ?? [];
  const crewSet = new Set(crewCertIds);
  const missingCertIds = requiredIds.filter((id) => !crewSet.has(id));
  const certNameMap = new Map((allCerts ?? []).map((c) => [c.id, c.name]));
  const missingCertNames = missingCertIds.map((id) => certNameMap.get(id) ?? id);
  const canApply = missingCertIds.length === 0;

  const dept = posting.role_department ?? 'deck';
  const deptColor = getDepartmentColor(dept);
  const barColor = deptColor === 'gold' ? '#B8860B' : '#708090';

  const vesselName = posting.vessel_name
    ? posting.vessel_nda
      ? 'NDA Vessel'
      : `${posting.vessel_type === 'motor' ? 'M/Y' : 'S/Y'} ${posting.vessel_name}`
    : 'Vessel TBD';

  const location = [posting.port_name, posting.city_name, posting.region_name]
    .filter(Boolean)
    .join(', ');

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ height: 4, backgroundColor: barColor, borderRadius: 2, marginBottom: 16 }} />

        {/* Role + ref */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111', flex: 1 }}>
            {posting.role_name ?? 'Role TBD'}
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
            PM-{String(posting.job_number).padStart(5, '0')}
          </Text>
        </View>

        {/* Vessel */}
        <Text style={{ fontSize: 15, color: '#374151', marginBottom: 4 }}>{vesselName}</Text>
        {posting.vessel_size_label && (
          <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
            {posting.vessel_size_label}
            {posting.vessel_loa ? ` · ${posting.vessel_loa}m` : ''}
          </Text>
        )}

        {/* Location */}
        <Text style={{ fontSize: 15, color: '#4b5563', marginBottom: 8 }}>{location || 'Location TBD'}</Text>

        {/* Salary */}
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
          {formatSalary(posting)}
        </Text>

        {/* Start date + live aboard */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 12, color: '#4b5563' }}>Start: {formatStartDate(posting.start_date)}</Text>
          </View>
          {posting.live_aboard && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, color: colors.primary }}>Live aboard</Text>
            </View>
          )}
          {posting.contract_type && posting.contract_type !== 'permanent' && (
            <View style={{ backgroundColor: '#faf5ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, color: '#7c3aed' }}>{posting.contract_type}</Text>
            </View>
          )}
        </View>

        {/* Shortlist cap */}
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Shortlist: up to {posting.shortlist_cap} candidates
        </Text>

        {/* Required certs — with gate */}
        {requiredIds.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Required certifications
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {requiredIds.map((certId) => {
                const missing = missingCertIds.includes(certId);
                return (
                  <View
                    key={certId}
                    style={{
                      backgroundColor: missing ? '#fef2f2' : '#f0fdf4',
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: missing ? '#dc2626' : '#15803d' }}>
                      {missing ? '✗ ' : '✓ '}{certNameMap.get(certId) ?? certId}
                    </Text>
                  </View>
                );
              })}
            </View>
            {!canApply && (
              <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>
                You are missing {missingCertNames.length} required cert{missingCertNames.length > 1 ? 's' : ''}. Update your profile to apply.
              </Text>
            )}
          </View>
        )}

        {/* Languages */}
        {posting.required_languages.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Required languages
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {posting.required_languages.map((lang) => (
                <View key={lang} style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: colors.primary }}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Meals */}
        {posting.meals.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Meals provided
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {posting.meals.map((meal) => (
                <View key={meal} style={{ backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: '#15803d' }}>{meal}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {posting.description && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Description
            </Text>
            <Text style={{ fontSize: 14, color: '#374151' }}>{posting.description}</Text>
          </View>
        )}

        {/* Notes */}
        {posting.notes && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 14, color: '#374151' }}>{posting.notes}</Text>
          </View>
        )}

        {/* Poster */}
        {posting.poster_name && (
          <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            Posted by {posting.poster_name}
          </Text>
        )}

        {/* Message input — only if can apply */}
        {canApply && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Message (optional)
            </Text>
            <TextInput
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, 250))}
              placeholder="Add a message with your application..."
              multiline
              maxLength={250}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                padding: 12,
                minHeight: 80,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 2 }}>
              {message.length}/250
            </Text>
          </View>
        )}
      </BottomSheetScrollView>

      {/* Fixed apply button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Button
          onPress={handleApply}
          disabled={!canApply || isApplying}
          loading={isApplying}
          label={
            !canApply
              ? 'Missing required certifications'
              : isApplying
                ? 'Applying...'
                : 'Apply'
          }
        />
      </View>
    </BottomSheet>
  );
}
