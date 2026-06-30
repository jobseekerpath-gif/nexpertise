import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { getProfile } from '@/lib/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  company?: string;
  location?: string;
  jobType?: string;
  remote?: boolean;
  salary?: string;
  kind?: string;
};

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE = process.env['EXPO_PUBLIC_DOMAIN']
  ? `https://${process.env['EXPO_PUBLIC_DOMAIN']}/api`
  : '';

async function searchJobs(params: {
  q: string;
  city: string;
  skills: string;
  experience: string;
}): Promise<JobItem[]> {
  if (!API_BASE) return [];
  const query = new URLSearchParams({
    q: params.q,
    city: params.city,
    skills: params.skills,
    experience: params.experience || 'all',
  });
  const res = await fetch(`${API_BASE}/jobs/search?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { items: JobItem[] };
  return data.items ?? [];
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, colors }: { job: JobItem; colors: ReturnType<typeof useColors> }) {
  const handleApply = () => {
    if (job.link) Linking.openURL(job.link);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      {/* Title + company */}
      <Text style={[styles.jobTitle, { color: colors.foreground }]} numberOfLines={2}>
        {job.title}
      </Text>
      {job.company ? (
        <Text style={[styles.company, { color: colors.info }]} numberOfLines={1}>
          {job.company}
        </Text>
      ) : null}

      {/* Meta row: location, salary, type */}
      <View style={styles.metaRow}>
        {job.location ? (
          <View style={styles.metaChip}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
        ) : null}
        {job.salary ? (
          <View style={styles.metaChip}>
            <Feather name="dollar-sign" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.salary}</Text>
          </View>
        ) : null}
        {job.remote ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.muted, borderRadius: 6 },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.info }]}>Remote</Text>
          </View>
        ) : null}
        {job.jobType ? (
          <View style={[styles.badge, { backgroundColor: colors.muted, borderRadius: 6 }]}>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{job.jobType}</Text>
          </View>
        ) : null}
      </View>

      {/* Summary */}
      {job.summary ? (
        <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={3}>
          {job.summary}
        </Text>
      ) : null}

      {/* Footer: source + apply */}
      <View style={styles.cardFooter}>
        <Text style={[styles.source, { color: colors.mutedForeground }]}>via {job.source}</Text>
        <TouchableOpacity
          onPress={handleApply}
          style={[
            styles.applyBtn,
            { backgroundColor: colors.tools.rozgar, borderRadius: colors.radius - 4 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.applyText}>Apply</Text>
          <Feather name="external-link" size={12} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Experience Filter ────────────────────────────────────────────────────────

const EXP_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fresher', label: 'Fresher' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();

  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const searchQueryRef = useRef('');

  // Pre-fill city + skills from profile on first focus
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getProfile().then((profile) => {
        if (!mounted) return;
        if (!city && profile.location) setCity(profile.location);
        if (!query && profile.careerGoal) setQuery(profile.careerGoal);
      });
      return () => { mounted = false; };
    }, []),
  );

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    const currentQuery = query.trim();
    searchQueryRef.current = currentQuery;
    try {
      const profile = await getProfile();
      const results = await searchJobs({
        q: currentQuery,
        city: city.trim(),
        skills: profile.skills || '',
        experience,
      });
      if (searchQueryRef.current === currentQuery) {
        setJobs(results);
      }
    } catch (e) {
      setError('Could not load jobs. Please check your connection and try again.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [query, city, experience]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Rozgar Samachar" subtitle="Find your next opportunity" />

      {/* Search box */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Role or keyword (e.g. Data Analyst)"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              marginTop: 8,
            },
          ]}
        >
          <Feather name="map-pin" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City (e.g. Bangalore)"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        {/* Experience filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {EXP_OPTIONS.map((opt) => {
            const active = experience === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setExperience(opt.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.tools.rozgar : colors.muted,
                    borderRadius: 20,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSearch}
          style={[
            styles.searchBtn,
            { backgroundColor: colors.tools.rozgar, borderRadius: colors.radius },
          ]}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="search" size={16} color="#fff" />
              <Text style={styles.searchBtnText}>Search jobs</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {error ? (
        <EmptyState icon="wifi-off" title="Search failed" subtitle={error} />
      ) : loading ? null : !searched ? (
        <EmptyState
          icon="briefcase"
          title="Search for jobs"
          subtitle="Enter a role or keyword above and tap Search to find live opportunities across India."
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="search"
          title="No jobs found"
          subtitle="Try a different keyword or city. Fresher jobs in major cities work well."
        />
      ) : (
        <View style={styles.results}>
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} found
          </Text>
          {jobs.map((job, idx) => (
            <JobCard key={`${job.link}-${idx}`} job={job} colors={colors} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  chipsScroll: {
    marginTop: 10,
    marginBottom: 2,
  },
  chips: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
  },
  searchBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  results: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
    paddingBottom: 8,
  },
  resultCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  jobTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  company: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  summary: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  source: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  applyText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#fff',
  },
});
