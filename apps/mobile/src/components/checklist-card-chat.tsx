import { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { apiPost } from '@/lib/api';
import { colors } from '@/components/ui';

interface ChecklistItem {
  id: string;
  label: string;
}

interface Props {
  engagementId: string;
  items: ChecklistItem[];
  acknowledgedIds: string[];
  isCrew: boolean;
  onUpdate: () => void;
}

export function ChecklistCardChat({ engagementId, items, acknowledgedIds, isCrew, onUpdate }: Props) {
  const [toggling, setToggling] = useState<string | null>(null);
  const acked = new Set(acknowledgedIds);

  const handleToggle = useCallback(
    async (itemId: string) => {
      setToggling(itemId);
      const checked = !acked.has(itemId);
      const result = await apiPost(`/api/engagements/${engagementId}/checklist/toggle`, {
        item_id: itemId, checked,
      });
      setToggling(null);
      if (result.ok) onUpdate();
      else Alert.alert('Error', result.error);
    },
    [engagementId, acked, onUpdate],
  );

  if (items.length === 0) return null;

  const completed = items.filter((i) => acked.has(i.id)).length;

  return (
    <View style={{ margin: 16, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
        Pre-arrival checklist ({completed}/{items.length})
      </Text>
      {items.map((item) => {
        const checked = acked.has(item.id);
        const isToggling = toggling === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={isCrew ? () => handleToggle(item.id) : undefined}
            disabled={!isCrew || isToggling}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 4, borderWidth: 2, marginRight: 10,
              borderColor: checked ? colors.primary : '#d1d5db',
              backgroundColor: checked ? colors.primary : '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {checked && <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 14, color: checked ? '#6b7280' : '#111', textDecorationLine: checked ? 'line-through' : 'none', flex: 1, opacity: isToggling ? 0.5 : 1 }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
