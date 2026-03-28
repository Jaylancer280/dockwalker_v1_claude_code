import { View, Text } from 'react-native';
import { currencySymbol, getDepartmentColor } from '@dockwalker/shared';

export interface DayworkCardData {
  id: string;
  job_number: number;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  created_at: string;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  vessels: {
    name: string;
    nda_flag: boolean;
    vessel_type: string;
    loa_meters: number | null;
    vessel_size_bands: { label: string } | null;
  } | null;
  experience_brackets: { label: string } | null;
  cert_names: string[];
  required_languages: string[];
  positions_available: number;
  permanent_opportunity: boolean;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('en-GB', opts)} — ${e.toLocaleDateString('en-GB', opts)}`;
}

function daysAgo(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'Posted today';
  if (diff === 1) return 'Posted yesterday';
  return `Posted ${diff}d ago`;
}

function vesselDisplay(v: DayworkCardData['vessels']): string {
  if (!v) return 'Vessel TBD';
  if (v.nda_flag) return 'NDA Vessel';
  const prefix = v.vessel_type === 'motor' ? 'M/Y' : 'S/Y';
  return `${prefix} ${v.name}`;
}

function vesselMeta(v: DayworkCardData['vessels']): string {
  if (!v) return '';
  const parts: string[] = [];
  if (v.vessel_size_bands?.label) parts.push(v.vessel_size_bands.label);
  if (v.loa_meters) parts.push(`${v.loa_meters}m`);
  return parts.join(' · ');
}

interface DayworkJobCardProps {
  card: DayworkCardData;
}

export function DayworkJobCard({ card }: DayworkJobCardProps) {
  const dept = card.yacht_roles?.department ?? 'deck';
  const deptColor = getDepartmentColor(dept);
  const barColor = deptColor === 'gold' ? '#B8860B' : '#708090';
  const location = card.ports
    ? `${card.ports.name}, ${card.ports.cities.name}`
    : 'Location TBD';
  const region = card.ports?.cities.regions.name ?? '';

  return (
    <View className="flex-1 rounded-2xl bg-white border border-gray-200 overflow-hidden">
      {/* Department color bar */}
      <View style={{ height: 4, backgroundColor: barColor }} />

      <View className="p-4 flex-1">
        {/* Role + Job ref */}
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={1}>
            {card.yacht_roles?.name ?? 'Role TBD'}
          </Text>
          <Text className="text-xs text-gray-400 ml-2">
            DW-{String(card.job_number).padStart(5, '0')}
          </Text>
        </View>

        {/* Vessel */}
        <Text className="text-sm text-gray-700 mb-1" numberOfLines={1}>
          {vesselDisplay(card.vessels)}
        </Text>
        {vesselMeta(card.vessels) ? (
          <Text className="text-xs text-gray-400 mb-2">{vesselMeta(card.vessels)}</Text>
        ) : null}

        {/* Location */}
        <View className="flex-row items-center mb-2">
          <Text className="text-sm text-gray-600">
            {location}
            {region ? ` · ${region}` : ''}
          </Text>
        </View>

        {/* Dates + working days */}
        <View className="flex-row items-center mb-2">
          <Text className="text-sm text-gray-600">
            {formatDateRange(card.start_date, card.end_date)} · {card.working_days}d
          </Text>
        </View>

        {/* Rate */}
        <Text className="text-xl font-bold text-gray-900 mb-3">
          {currencySymbol(card.currency)}{card.day_rate}
          <Text className="text-sm font-normal text-gray-500">/day</Text>
        </Text>

        {/* Certs */}
        {card.cert_names.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-2">
            {card.cert_names.map((cert) => (
              <View key={cert} className="bg-gray-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-gray-600">{cert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {card.required_languages.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-2">
            {card.required_languages.map((lang) => (
              <View key={lang} className="bg-blue-50 rounded-full px-2 py-0.5">
                <Text className="text-xs text-blue-600">{lang}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Meals */}
        {card.meals.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-2">
            {card.meals.map((meal) => (
              <View key={meal} className="bg-green-50 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-700">{meal}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Badges row */}
        <View className="flex-row items-center gap-2 mb-2">
          {card.experience_brackets?.label && (
            <View className="bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-xs text-gray-600">{card.experience_brackets.label}</Text>
            </View>
          )}
          {card.permanent_opportunity && (
            <View className="bg-purple-50 rounded-full px-2 py-0.5">
              <Text className="text-xs text-purple-700">Perm opportunity</Text>
            </View>
          )}
          {card.positions_available > 1 && (
            <View className="bg-orange-50 rounded-full px-2 py-0.5">
              <Text className="text-xs text-orange-700">{card.positions_available} positions</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="mt-auto">
          <Text className="text-xs text-gray-400">{daysAgo(card.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Skeleton placeholder while loading */
export function DayworkJobCardSkeleton() {
  return (
    <View className="flex-1 rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <View style={{ height: 4 }} className="bg-gray-200" />
      <View className="p-4 flex-1">
        <View className="h-5 w-3/4 bg-gray-200 rounded mb-3" />
        <View className="h-4 w-1/2 bg-gray-100 rounded mb-2" />
        <View className="h-4 w-2/3 bg-gray-100 rounded mb-2" />
        <View className="h-4 w-1/2 bg-gray-100 rounded mb-3" />
        <View className="h-7 w-1/3 bg-gray-200 rounded mb-3" />
        <View className="flex-row gap-1 mb-2">
          <View className="h-5 w-16 bg-gray-100 rounded-full" />
          <View className="h-5 w-20 bg-gray-100 rounded-full" />
        </View>
      </View>
    </View>
  );
}
