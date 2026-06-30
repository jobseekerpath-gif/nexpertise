import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { getProfile, getSavedJobs, toggleSavedJob, type SavedJob } from '@/lib/storage';

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

function JobCard({
  job,
  colors,
  isSaved,
  onToggleSave,
}: {
  job: JobItem;
  colors: ReturnType<typeof useColors>;
  isSaved: boolean;
  onToggleSave: (job: JobItem) => void;
}) {
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
      {/* Title row + bookmark */}
      <View style={styles.titleRow}>
        <Text style={[styles.jobTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>
          {job.title}
        </Text>
        <TouchableOpacity
          onPress={() => onToggleSave(job)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.bookmarkBtn}
          activeOpacity={0.7}
        >
          <Feather
            name={isSaved ? 'bookmark' : 'bookmark'}
            size={18}
            color={isSaved ? colors.tools.rozgar : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

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

// ─── Trending Searches ────────────────────────────────────────────────────────

const TRENDING_SEARCHES: { label: string; icon: string }[] = [
  { label: 'Software Developer', icon: '💻' },
  { label: 'Data Entry', icon: '📋' },
  { label: 'Bank PO', icon: '🏦' },
  { label: 'Government Jobs', icon: '🏛️' },
  { label: 'Data Analyst', icon: '📊' },
  { label: 'Customer Support', icon: '🎧' },
  { label: 'Digital Marketing', icon: '📱' },
  { label: 'Content Writer', icon: '✍️' },
  { label: 'Accountant', icon: '🧾' },
  { label: 'HR Executive', icon: '🤝' },
  { label: 'Sales Executive', icon: '📈' },
  { label: 'Graphic Designer', icon: '🎨' },
];

function TrendingSearches({
  colors,
  onSelect,
}: {
  colors: ReturnType<typeof useColors>;
  onSelect: (label: string) => void;
}) {
  return (
    <View style={trendingStyles.container}>
      <View style={trendingStyles.header}>
        <Feather name="trending-up" size={14} color={colors.tools.rozgar} />
        <Text style={[trendingStyles.heading, { color: colors.foreground }]}>
          Popular searches
        </Text>
      </View>
      <Text style={[trendingStyles.sub, { color: colors.mutedForeground }]}>
        Tap a category to search instantly
      </Text>
      <View style={trendingStyles.grid}>
        {TRENDING_SEARCHES.map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => onSelect(item.label)}
            activeOpacity={0.75}
            style={[
              trendingStyles.chip,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text style={trendingStyles.chipEmoji}>{item.icon}</Text>
            <Text style={[trendingStyles.chipLabel, { color: colors.foreground }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const trendingStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
});

// ─── Experience Filter ────────────────────────────────────────────────────────

const EXP_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fresher', label: 'Fresher' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
];

type Tab = 'search' | 'saved';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();

  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const searchQueryRef = useRef('');

  // Saved jobs state
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const savedLinksSet = new Set(savedJobs.map((j) => j.link));

  // Load saved jobs on focus
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getSavedJobs().then((jobs) => {
        if (mounted) setSavedJobs(jobs);
      });
      getProfile().then((profile) => {
        if (!mounted) return;
        if (!city && profile.location) setCity(profile.location);
        if (!query && profile.careerGoal) setQuery(profile.careerGoal);
      });
      return () => { mounted = false; };
    }, []),
  );

  const handleToggleSave = useCallback(async (job: JobItem) => {
    const { saved } = await toggleSavedJob(job);
    setSavedJobs(await getSavedJobs());
  }, []);

  const handleTrendingSelect = useCallback((label: string) => {
    setQuery(label);
    setSearched(true);
    setLoading(true);
    setError(null);
    searchQueryRef.current = label;
    getProfile().then((profile) => {
      searchJobs({
        q: label,
        city: city.trim(),
        skills: profile.skills || '',
        experience,
      })
        .then((results) => {
          if (searchQueryRef.current === label) setJobs(results);
        })
        .catch(() => {
          setError('Could not load jobs. Please check your connection and try again.');
          setJobs([]);
        })
        .finally(() => setLoading(false));
    });
  }, [city, experience]);

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

      {/* Tab toggle */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('search')}
          style={[
            styles.tab,
            activeTab === 'search' && { borderBottomColor: colors.tools.rozgar, borderBottomWidth: 2 },
          ]}
          activeOpacity={0.8}
        >
          <Feather
            name="search"
            size={14}
            color={activeTab === 'search' ? colors.tools.rozgar : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'search' ? colors.tools.rozgar : colors.mutedForeground },
            ]}
          >
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('saved')}
          style={[
            styles.tab,
            activeTab === 'saved' && { borderBottomColor: colors.tools.rozgar, borderBottomWidth: 2 },
          ]}
          activeOpacity={0.8}
        >
          <Feather
            name="bookmark"
            size={14}
            color={activeTab === 'saved' ? colors.tools.rozgar : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'saved' ? colors.tools.rozgar : colors.mutedForeground },
            ]}
          >
            Saved{savedJobs.length > 0 ? ` (${savedJobs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH TAB ── */}
      {activeTab === 'search' && (
        <>
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
            <TrendingSearches colors={colors} onSelect={handleTrendingSelect} />
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
                <JobCard
                  key={`${job.link}-${idx}`}
                  job={job}
                  colors={colors}
                  isSaved={savedLinksSet.has(job.link)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* ── SAVED TAB ── */}
      {activeTab === 'saved' && (
        <>
          {savedJobs.length === 0 ? (
            <EmptyState
              icon="bookmark"
              title="No saved jobs yet"
              subtitle="Tap the bookmark icon on any job card to save it here for later."
            />
          ) : (
            <View style={styles.results}>
              <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
                {savedJobs.length} saved job{savedJobs.length !== 1 ? 's' : ''}
              </Text>
              {savedJobs.map((job, idx) => (
                <JobCard
                  key={`saved-${job.link}-${idx}`}
                  job={job}
                  colors={colors}
                  isSaved
                  onToggleSave={handleToggleSave}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  jobTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  bookmarkBtn: {
    paddingTop: 1,
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
