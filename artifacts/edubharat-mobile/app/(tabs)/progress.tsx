import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { getProgress, type Progress } from '@/lib/storage';

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();
  const [progress, setProgress] = useState<Progress | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getProgress().then((p) => { if (mounted) setProgress(p); });
      return () => { mounted = false; };
    }, []),
  );

  if (!progress) return <LoadingPlaceholder />;

  const total = progress.englishMinutes + progress.interviewCount * 10 + progress.resumeAnalyses * 10 + progress.jobsSaved * 5;
  const overall = Math.min(100, Math.round(total / 5));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Your progress" subtitle="Track your learning journey" />

      <View style={[styles.rings, { paddingTop: 8 }]}>
        <ProgressRing value={Math.min(100, progress.englishMinutes * 5)} label="English" />
        <ProgressRing value={Math.min(100, progress.interviewCount * 20)} label="Interviews" />
        <ProgressRing value={Math.min(100, progress.resumeAnalyses * 25)} label="Resume" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity</Text>
        <View style={styles.row}>
          <StatCard icon="message-circle" value={progress.englishMinutes} label="English min" color={colors.tools.english} />
          <StatCard icon="users" value={progress.interviewCount} label="Interviews" color={colors.tools.interview} />
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <StatCard icon="file-text" value={progress.resumeAnalyses} label="Resumes" color={colors.tools.resume} />
          <StatCard icon="briefcase" value={progress.jobsSaved} label="Jobs saved" color={colors.tools.rozgar} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Streak</Text>
        <View
          style={[
            styles.streakCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: colors.radius },
          ]}
        >
          <Text style={[styles.streakValue, { color: colors.foreground }]}>{progress.streakDays} days</Text>
          <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>Keep practicing daily to maintain your streak</Text>
        </View>
      </View>

      {overall === 0 && (
        <EmptyState icon="activity" title="No activity yet" subtitle="Start using any tool to see your progress grow." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCard: {
    padding: 20,
    gap: 6,
  },
  streakValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
  },
  streakLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});
