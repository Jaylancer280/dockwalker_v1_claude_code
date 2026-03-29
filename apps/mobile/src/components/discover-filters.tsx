import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRoles, useCertifications, usePorts, useExperienceBrackets, useSizeBands } from '@/hooks/use-canonical';
import type { DiscoverFilters } from '@/hooks/use-daywork-discover';
import { Pill, SectionHeader, Button, colors } from '@/components/ui';

interface FilterPanelProps {
  filters: DiscoverFilters;
  onApply: (filters: DiscoverFilters) => void;
  onDismiss: () => void;
  mode: 'daywork' | 'permanent';
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SectionHeader title={label} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label="All" selected={!value} onPress={() => onChange(undefined)} />
          {options.map((opt) => (
            <Pill
              key={opt.id}
              label={opt.name}
              selected={opt.id === value}
              onPress={() => onChange(opt.id === value ? undefined : opt.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function DiscoverFilterPanel({ filters, onApply, onDismiss, mode }: FilterPanelProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);

  const [draft, setDraft] = useState<DiscoverFilters>({ ...filters });

  const { data: roles } = useRoles();
  const { data: certs } = useCertifications();
  const { data: portsData } = usePorts();
  const { data: brackets } = useExperienceBrackets();
  const { data: sizeBands } = useSizeBands();

  const roleOptions = useMemo(
    () => (roles ?? []).map((r) => ({ id: r.id, name: r.name })),
    [roles],
  );

  const certOptions = useMemo(
    () => [
      { id: 'none', name: 'No certs required' },
      ...(certs ?? []).map((c) => ({ id: c.id, name: c.name })),
    ],
    [certs],
  );

  const portOptions = useMemo(
    () => (portsData?.ports ?? []).map((p) => ({
      id: p.id,
      name: `${p.name}, ${p.cities.name}`,
    })),
    [portsData],
  );

  const bracketOptions = useMemo(
    () => (brackets ?? []).map((b) => ({ id: b.id, name: b.label })),
    [brackets],
  );

  const sizeBandOptions = useMemo(
    () => (sizeBands ?? []).map((s) => ({ id: s.id, name: s.label })),
    [sizeBands],
  );

  const handleApply = useCallback(() => {
    onApply(draft);
  }, [draft, onApply]);

  const handleReset = useCallback(() => {
    const empty: DiscoverFilters = {};
    setDraft(empty);
    onApply(empty);
  }, [onApply]);

  const activeCount = Object.values(draft).filter(Boolean).length;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Filters</Text>
        {activeCount > 0 && (
          <Pressable onPress={handleReset}>
            <Text style={{ fontSize: 13, color: colors.primary }}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <FilterSelect
          label="Role"
          options={roleOptions}
          value={draft.roleId}
          onChange={(v) => setDraft((d) => ({ ...d, roleId: v }))}
        />

        <FilterSelect
          label="Certification"
          options={certOptions}
          value={draft.certificationId}
          onChange={(v) => setDraft((d) => ({ ...d, certificationId: v }))}
        />

        <FilterSelect
          label="Location"
          options={portOptions}
          value={draft.portId}
          onChange={(v) => setDraft((d) => ({ ...d, portId: v }))}
        />

        <FilterSelect
          label="Experience"
          options={bracketOptions}
          value={draft.experienceBracketId}
          onChange={(v) => setDraft((d) => ({ ...d, experienceBracketId: v }))}
        />

        <FilterSelect
          label="Vessel size"
          options={sizeBandOptions}
          value={draft.sizeBandId}
          onChange={(v) => setDraft((d) => ({ ...d, sizeBandId: v }))}
        />
      </BottomSheetScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Button variant="primary" label={`Apply filters${activeCount > 0 ? ` (${activeCount})` : ''}`} onPress={handleApply} />
      </View>
    </BottomSheet>
  );
}

/** Active filter pills displayed above the feed */
export function ActiveFilterPills({
  filters,
  onClear,
}: {
  filters: DiscoverFilters;
  onClear: (key: keyof DiscoverFilters) => void;
}) {
  const { data: roles } = useRoles();
  const { data: certs } = useCertifications();
  const { data: portsData } = usePorts();
  const { data: brackets } = useExperienceBrackets();
  const { data: sizeBands } = useSizeBands();

  const pills: { key: keyof DiscoverFilters; label: string }[] = [];

  if (filters.roleId) {
    const role = roles?.find((r) => r.id === filters.roleId);
    pills.push({ key: 'roleId', label: role?.name ?? 'Role' });
  }
  if (filters.certificationId) {
    if (filters.certificationId === 'none') {
      pills.push({ key: 'certificationId', label: 'No certs' });
    } else {
      const cert = certs?.find((c) => c.id === filters.certificationId);
      pills.push({ key: 'certificationId', label: cert?.name ?? 'Cert' });
    }
  }
  if (filters.portId) {
    const port = portsData?.ports.find((p) => p.id === filters.portId);
    pills.push({ key: 'portId', label: port?.name ?? 'Port' });
  }
  if (filters.experienceBracketId) {
    const bracket = brackets?.find((b) => b.id === filters.experienceBracketId);
    pills.push({ key: 'experienceBracketId', label: bracket?.label ?? 'Experience' });
  }
  if (filters.sizeBandId) {
    const band = sizeBands?.find((s) => s.id === filters.sizeBandId);
    pills.push({ key: 'sizeBandId', label: band?.label ?? 'Size' });
  }

  if (pills.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16 }}>
        {pills.map((pill) => (
          <Pressable
            key={pill.key}
            onPress={() => onClear(pill.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#eff6ff',
              borderRadius: 16,
              paddingHorizontal: 10,
              paddingVertical: 4,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.primary }}>{pill.label}</Text>
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: 'bold' }}>×</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
