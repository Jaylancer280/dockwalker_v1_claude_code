import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabDef {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
  hats: ('crew' | 'employer' | 'agent')[];
}

const TAB_CONFIG: TabDef[] = [
  { name: 'discover', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass', hats: ['crew'] },
  { name: 'my-jobs', title: 'My Jobs', icon: 'briefcase-outline', iconFocused: 'briefcase', hats: ['employer', 'agent'] },
  { name: 'messages', title: 'Messages', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles', hats: ['crew', 'employer', 'agent'] },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person', hats: ['crew', 'employer', 'agent'] },
  { name: 'notifications', title: 'Alerts', icon: 'notifications-outline', iconFocused: 'notifications', hats: ['crew', 'employer', 'agent'] },
  { name: 'more', title: 'More', icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', hats: ['crew', 'employer', 'agent'] },
];

export default function TabLayout() {
  const { person } = useAuth();
  const hat = person?.current_hat ?? 'crew';
  const isEmployer = hat === 'employer' || hat === 'agent';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0066CC',
      }}
      initialRouteName={isEmployer ? 'my-jobs' : 'discover'}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.hats.includes(hat) ? undefined : null,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
