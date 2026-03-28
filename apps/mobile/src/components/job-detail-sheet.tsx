import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { currencySymbol, getDepartmentColor } from '@dockwalker/shared';
import type { HydratedDaywork } from '@/hooks/use-daywork-discover';

interface JobDetailSheetProps {
  job: HydratedDaywork | null;
  onApply: (dayworkId: string, message?: string) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${s.toLocaleDateString('en-GB', opts)} — ${e.toLocaleDateString('en-GB', opts)}`;
}

export function JobDetailSheet({ job, onApply, onDismiss, isApplying }: JobDetailSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [message, setMessage] = useState('');

  const handleClose = useCallback(() => {
    setMessage('');
    onDismiss();
  }, [onDismiss]);

  const handleApply = useCallback(() => {
    if (!job) return;
    onApply(job.id, message.trim() || undefined);
  }, [job, onApply, message]);

  if (!job) return null;

  const dept = job.yacht_roles?.department ?? 'deck';
  const deptColor = getDepartmentColor(dept);
  const barColor = deptColor === 'gold' ? '#B8860B' : '#708090';

  const vesselName = job.vessels
    ? job.vessels.nda_flag
      ? 'NDA Vessel'
      : `${job.vessels.vessel_type === 'motor' ? 'M/Y' : 'S/Y'} ${job.vessels.name}`
    : 'Vessel TBD';

  const location = job.ports
    ? `${job.ports.name}, ${job.ports.cities.name}, ${job.ports.cities.regions.name}`
    : 'Location TBD';

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Color bar */}
        <View style={{ height: 4, backgroundColor: barColor, borderRadius: 2, marginBottom: 16 }} />

        {/* Role + ref */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111', flex: 1 }}>
            {job.yacht_roles?.name ?? 'Role TBD'}
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
            DW-{String(job.job_number).padStart(5, '0')}
          </Text>
        </View>

        {/* Vessel */}
        <Text style={{ fontSize: 15, color: '#374151', marginBottom: 4 }}>{vesselName}</Text>
        {job.vessels?.vessel_size_bands?.label && (
          <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
            {job.vessels.vessel_size_bands.label}
            {job.vessels.loa_meters ? ` · ${job.vessels.loa_meters}m` : ''}
          </Text>
        )}

        {/* Location */}
        <Text style={{ fontSize: 15, color: '#4b5563', marginBottom: 8 }}>{location}</Text>

        {/* Dates */}
        <Text style={{ fontSize: 15, color: '#4b5563', marginBottom: 8 }}>
          {formatDateRange(job.start_date, job.end_date)} · {job.working_days} working days
        </Text>

        {/* Rate */}
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 16 }}>
          {currencySymbol(job.currency)}{job.day_rate}
          <Text style={{ fontSize: 14, fontWeight: 'normal', color: '#6b7280' }}>/day</Text>
        </Text>

        {/* Certs */}
        {job.cert_names.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Required certifications
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {job.cert_names.map((cert) => (
                <View key={cert} style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: '#4b5563' }}>{cert}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Languages */}
        {job.required_languages.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Required languages
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {job.required_languages.map((lang) => (
                <View key={lang} style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: '#2563eb' }}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Meals */}
        {job.meals.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Meals provided
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {job.meals.map((meal) => (
                <View key={meal} style={{ backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: '#15803d' }}>{meal}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experience + positions */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {job.experience_brackets?.label && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, color: '#4b5563' }}>{job.experience_brackets.label}</Text>
            </View>
          )}
          {job.positions_available > 1 && (
            <View style={{ backgroundColor: '#fff7ed', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, color: '#c2410c' }}>{job.positions_available} positions</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 14, color: '#374151' }}>{job.notes}</Text>
          </View>
        )}

        {/* Poster */}
        {job.poster_name && (
          <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            Posted by {job.poster_name}
          </Text>
        )}

        {/* Message input */}
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
      </BottomSheetScrollView>

      {/* Fixed apply button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Pressable
          onPress={handleApply}
          disabled={isApplying}
          style={{
            backgroundColor: isApplying ? '#93c5fd' : '#2563eb',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {isApplying ? 'Applying...' : 'Apply'}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
