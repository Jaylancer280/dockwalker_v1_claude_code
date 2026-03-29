import { View, Text } from 'react-native';
import { currencySymbol } from '@dockwalker/shared';

interface DayworkData {
  job_number: number;
  day_rate: number;
  currency: string;
  working_days: number;
  meals: string[];
  notes: string | null;
  yacht_roles: { name: string; department: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string; nda_flag: boolean; vessel_type: string; loa_meters: number | null } | null;
}

export function DayworkSummaryCardChat({ daywork }: { daywork: DayworkData }) {
  const vesselName = daywork.vessels
    ? daywork.vessels.nda_flag ? 'NDA Vessel'
      : `${daywork.vessels.vessel_type === 'motor' ? 'M/Y' : 'S/Y'} ${daywork.vessels.name}`
    : 'Vessel TBD';
  const location = daywork.ports
    ? `${daywork.ports.name}, ${daywork.ports.cities.name}`
    : '';

  return (
    <View style={{ margin: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
        {daywork.yacht_roles?.name ?? 'Role'} · DW-{String(daywork.job_number).padStart(5, '0')}
      </Text>
      <Text style={{ fontSize: 12, color: '#4b5563' }}>{vesselName}</Text>
      {location ? <Text style={{ fontSize: 12, color: '#6b7280' }}>{location}</Text> : null}
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginTop: 4 }}>
        {currencySymbol(daywork.currency)}{daywork.day_rate}/day · {daywork.working_days}d
      </Text>
      {daywork.meals.length > 0 && (
        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          Meals: {daywork.meals.join(', ')}
        </Text>
      )}
    </View>
  );
}
