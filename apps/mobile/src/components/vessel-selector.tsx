import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Switch } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useVessels, type Vessel } from '@/hooks/use-vessels';
import { apiPost } from '@/lib/api';

interface VesselSelectorProps {
  value: string | null;
  onChange: (vesselId: string) => void;
  onDismiss: () => void;
}

export function VesselSelector({ value, onChange, onDismiss }: VesselSelectorProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const { data: vessels, invalidate } = useVessels();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImo, setNewImo] = useState('');
  const [newType, setNewType] = useState<'motor' | 'sail'>('motor');
  const [newLoa, setNewLoa] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSelect = useCallback(
    (vessel: Vessel) => {
      onChange(vessel.id);
      onDismiss();
    },
    [onChange, onDismiss],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Vessel name required');
      return;
    }

    setCreating(true);
    const body: Record<string, unknown> = {
      name: newName.trim(),
      vesselType: newType,
    };
    if (newImo.trim()) body.imoNumber = newImo.trim();
    if (newLoa.trim()) body.loaMeters = parseFloat(newLoa);

    const result = await apiPost<{ vessel: { id: string } }>('/api/vessels', body);
    setCreating(false);

    if (result.ok) {
      invalidate();
      onChange(result.data.vessel.id);
      onDismiss();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [newName, newType, newImo, newLoa, onChange, onDismiss, invalidate]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>
          {showCreate ? 'Add vessel' : 'Select vessel'}
        </Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {showCreate ? (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Vessel name"
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>IMO number (optional)</Text>
            <TextInput
              value={newImo}
              onChangeText={setNewImo}
              placeholder="7 digits"
              keyboardType="number-pad"
              maxLength={7}
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['motor', 'sail'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setNewType(t)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: newType === t ? '#2563eb' : '#f3f4f6',
                  }}
                >
                  <Text style={{ color: newType === t ? '#fff' : '#4b5563', fontWeight: '600' }}>
                    {t === 'motor' ? 'M/Y' : 'S/Y'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>LOA (metres, optional)</Text>
            <TextInput
              value={newLoa}
              onChangeText={setNewLoa}
              placeholder="e.g. 45"
              keyboardType="decimal-pad"
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 16 }}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setShowCreate(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' }}
              >
                <Text style={{ color: '#4b5563', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={creating}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{creating ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            {(vessels ?? []).map((vessel) => {
              const prefix = vessel.vessel_type === 'motor' ? 'M/Y' : 'S/Y';
              const selected = vessel.id === value;
              return (
                <Pressable
                  key={vessel.id}
                  onPress={() => handleSelect(vessel)}
                  style={{
                    padding: 12, borderRadius: 10, borderWidth: 2, marginBottom: 8,
                    borderColor: selected ? '#2563eb' : '#e5e7eb',
                    backgroundColor: selected ? '#eff6ff' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
                    {prefix} {vessel.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {vessel.vessel_size_bands?.label ?? ''}
                    {vessel.loa_meters ? ` · ${vessel.loa_meters}m` : ''}
                    {vessel.nda_flag ? ' · NDA' : ''}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setShowCreate(true)}
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ Add vessel</Text>
            </Pressable>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
