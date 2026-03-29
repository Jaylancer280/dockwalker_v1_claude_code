import { View, Pressable, Text } from 'react-native';

interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2 }}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          style={{
            flex: 1,
            paddingVertical: 6,
            borderRadius: 6,
            alignItems: 'center',
            backgroundColor: activeTab === t.key ? '#fff' : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: tabs.length > 3 ? 11 : 13,
              fontWeight: activeTab === t.key ? '600' : '400',
              color: activeTab === t.key ? '#111' : '#6b7280',
            }}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
