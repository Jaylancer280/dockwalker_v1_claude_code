import { View, Text } from 'react-native';
import { currencySymbol } from '@dockwalker/shared';

interface PermanentData {
  job_number: number;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  contract_type: string | null;
  yacht_roles: { name: string; department: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string; nda_flag: boolean; vessel_type: string; loa_meters: number | null } | null;
}

export function PermanentSummaryCardChat({ posting }: { posting: PermanentData }) {
  const vesselName = posting.vessels
    ? posting.vessels.nda_flag ? 'NDA Vessel'
      : `${posting.vessels.vessel_type === 'motor' ? 'M/Y' : 'S/Y'} ${posting.vessels.name}`
    : 'Vessel TBD';
  const location = posting.ports
    ? `${posting.ports.name}, ${posting.ports.cities.name}`
    : '';
  const sym = currencySymbol(posting.salary_currency);
  const period = posting.salary_period === 'annual' ? '/yr' : '/mo';
  const salary = posting.salary_max
    ? `${sym}${posting.salary_max.toLocaleString()}${period}`
    : 'Salary TBD';

  return (
    <View style={{ margin: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
        {posting.yacht_roles?.name ?? 'Role'} · PM-{String(posting.job_number).padStart(5, '0')}
      </Text>
      <Text style={{ fontSize: 12, color: '#4b5563' }}>{vesselName}</Text>
      {location ? <Text style={{ fontSize: 12, color: '#6b7280' }}>{location}</Text> : null}
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginTop: 4 }}>{salary}</Text>
      {posting.contract_type && posting.contract_type !== 'permanent' && (
        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Contract: {posting.contract_type}</Text>
      )}
    </View>
  );
}
