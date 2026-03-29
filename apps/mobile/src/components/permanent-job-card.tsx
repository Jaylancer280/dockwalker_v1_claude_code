import { View, Text, Pressable } from 'react-native';
import { currencySymbol, getDepartmentColor } from '@dockwalker/shared';
import type { HydratedPermanent } from '@/hooks/use-permanent-discover';
import { colors } from '@/components/ui';

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

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return 'Posted today';
  if (diff === 1) return 'Posted yesterday';
  return `Posted ${diff}d ago`;
}

interface PermanentJobCardProps {
  posting: HydratedPermanent;
  onPress: (posting: HydratedPermanent) => void;
}

export function PermanentJobCard({ posting, onPress }: PermanentJobCardProps) {
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
    <Pressable
      onPress={() => onPress(posting)}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 12,
        overflow: 'hidden',
        opacity: pressed ? 0.95 : 1,
      })}
    >
      {/* Department color bar */}
      <View style={{ height: 3, backgroundColor: barColor }} />

      <View style={{ padding: 14 }}>
        {/* Role + ref */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111', flex: 1 }} numberOfLines={1}>
            {posting.role_name ?? 'Role TBD'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            PM-{String(posting.job_number).padStart(5, '0')}
          </Text>
        </View>

        {/* Vessel */}
        <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 2 }} numberOfLines={1}>
          {vesselName}
          {posting.vessel_size_label ? ` · ${posting.vessel_size_label}` : ''}
          {posting.vessel_loa ? ` · ${posting.vessel_loa}m` : ''}
        </Text>

        {/* Location */}
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{location || 'Location TBD'}</Text>

        {/* Salary */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6 }}>
          {formatSalary(posting)}
        </Text>

        {/* Pills row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: '#4b5563' }}>{formatStartDate(posting.start_date)}</Text>
          </View>
          {posting.live_aboard && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: colors.primary }}>Live aboard</Text>
            </View>
          )}
          {posting.contract_type && posting.contract_type !== 'permanent' && (
            <View style={{ backgroundColor: '#faf5ff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#7c3aed' }}>{posting.contract_type}</Text>
            </View>
          )}
          {posting.shortlist_cap > 0 && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>Shortlist: up to {posting.shortlist_cap}</Text>
            </View>
          )}
        </View>

        {/* Certs */}
        {posting.cert_names.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {posting.cert_names.map((cert) => (
              <View key={cert} style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>{cert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {daysAgo(posting.created_at)}
          {posting.poster_name ? ` · ${posting.poster_name}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}
