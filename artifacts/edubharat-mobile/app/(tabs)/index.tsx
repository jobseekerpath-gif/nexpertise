import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTools } from '@/hooks/useTools';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { ToolCard } from '@/components/ToolCard';
import { StatCard } from '@/components/StatCard';
import { ActionButton } from '@/components/ActionButton';
import { ProgressRing } from '@/components/ProgressRing';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { getProgress, getProfile, type Progress, type Profile } from '@/lib/storage';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();
  const router = useRouter();
  const tools = useTools();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([getProgress(), getProfile()]).then(([p, pr]) => {
        if (mounted) {
          setProgress(p);
          setProfile(pr);
        }
      });
      return () => { mounted = false; };
    }, []),
  );

  if (!progress || !profile) {
    return <LoadingPlaceholder />;
  }

  const overall = Math.min(
    100,
    Math.round((progress.englishMinutes + progress.interviewCount * 10 + progress.resumeAnalyses * 10 + progress.jobsSaved * 5) / 5),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Header
        title={profile.name ? `Namaste, ${profile.name}` : 'Namaste, Learner'}
        subtitle="Your AI career companion for India"
      />

      <View style={styles.hero}>
        <View style={[styles.heroCard, { backgroundColor: colors.secondary, borderRadius: colors.radius * 1.5 }]}>
          <View style={styles.heroRow}>
            <ProgressRing value={overall} label="Weekly goal" />
            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { color: colors.secondaryForeground }]}>
                Keep the momentum going
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.secondaryForeground + 'cc' }]}>
                {progress.streakDays} day streak · {progress.englishMinutes} min practice
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick actions</Text>
        <View style={styles.row}>
          <StatCard icon="message-circle" value={progress.englishMinutes} label="English min" color={colors.tools.english} />
          <StatCard icon="briefcase" value={progress.jobsSaved} label="Jobs saved" color={colors.tools.rozgar} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your tools</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]} onPress={() => router.push('/tools')}>See all</Text>
        </View>
        <View style={styles.toolGrid}>
          {tools.slice(0, 4).map((tool) => (
            <ToolCard key={tool.id} tool={tool} onPress={() => router.push(`/tool/${tool.id}`)} />
          ))}
        </View>
      </View>

      <View style={[styles.cta, { paddingHorizontal: 20, paddingBottom: 8 }]}>
        <ActionButton title="Start a daily practice" onPress={() => router.push('/tool/english-guru')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  heroCard: {
    padding: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  heroSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  seeAll: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cta: {
    marginTop: 24,
  },
});
