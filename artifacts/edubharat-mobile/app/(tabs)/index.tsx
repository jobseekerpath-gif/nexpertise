import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { ToolCard } from '@/components/ToolCard';
import { StatCard } from '@/components/StatCard';
import { ProgressRing } from '@/components/ProgressRing';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { Feather } from '@expo/vector-icons';
import { getProgress, getProfile, type Progress, type Profile } from '@/lib/storage';
import type { ToolInfo } from '@/components/ToolCard';

export default function HomeScreen() {
  const colors = useColors();
  const bottomPadding = useSafeBottomPadding();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([getProgress(), getProfile()]).then(([p, pr]) => {
        if (mounted) { setProgress(p); setProfile(pr); }
      });
      return () => { mounted = false; };
    }, []),
  );

  if (!progress || !profile) return <LoadingPlaceholder />;

  const overall = Math.min(
    100,
    Math.round((progress.englishMinutes + progress.interviewCount * 10 + progress.resumeAnalyses * 10 + progress.jobsSaved * 5) / 5),
  );

  const FLUENCY_TOOLS: ToolInfo[] = [
    { id: 'english-guru',      title: 'English Guru', subtitle: 'AI conversation & speaking',     icon: 'message-circle', color: colors.tools.english },
    { id: 'tools-pro',         title: 'Tools Pro',    subtitle: 'Grammar, writing & vocabulary',  icon: 'tool',           color: colors.tools.english },
    { id: 'my-journey',        title: 'My Journey',   subtitle: 'CEFR roadmap & streak tracking', icon: 'compass',        color: colors.tools.english },
  ];

  const CAREER_TOOLS: ToolInfo[] = [
    { id: 'interview-ace',      title: 'Interview Ace',   subtitle: 'Mock interviews & AI feedback', icon: 'users',     color: colors.tools.interview },
    { id: 'rozgar-samachar',    title: 'Rozgar Samachar', subtitle: 'Live jobs & salary insights',   icon: 'briefcase', color: colors.tools.rozgar    },
    { id: 'resume-intelligence',title: 'Resume',          subtitle: 'ATS score & keyword analysis',  icon: 'file-text', color: colors.tools.resume    },
  ];

  function handleToolPress(id: string) {
    if (id === 'my-journey') {
      router.push('/(tabs)/progress');
    } else {
      router.push(`/tool/${id}`);
    }
  }

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

      {/* ── Weekly goal card ─────────────────────────────────────────────────── */}
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

      {/* ── Quick stats ──────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick actions</Text>
        <View style={styles.row}>
          <StatCard icon="message-circle" value={progress.englishMinutes} label="English min"  color={colors.tools.english} />
          <StatCard icon="briefcase"      value={progress.jobsSaved}      label="Jobs saved"   color={colors.tools.rozgar}  />
        </View>
      </View>

      {/* ── Fluency Suite ────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={[styles.suiteWrap, { borderColor: colors.tools.english + '35', backgroundColor: colors.tools.english + '0a' }]}>
          <View style={[styles.suiteAccent, { backgroundColor: colors.tools.english }]} />
          <View style={styles.suiteContent}>
            <View style={[styles.suitePill, { backgroundColor: colors.tools.english + '22' }]}>
              <Feather name="book-open" size={10} color={colors.tools.english} />
              <Text style={[styles.suitePillText, { color: colors.tools.english }]}>Fluency Suite</Text>
            </View>
            <Text style={[styles.suiteTitle, { color: colors.foreground }]}>Speak with confidence.</Text>
            <Text style={[styles.suiteDesc, { color: colors.mutedForeground }]}>
              Learn naturally — in Hindi, Tamil & 10+ Indian languages
            </Text>
          </View>
        </View>
        <View style={styles.toolGrid}>
          {FLUENCY_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} onPress={() => handleToolPress(tool.id)} />
          ))}
        </View>
      </View>

      {/* ── Career Suite ─────────────────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={[styles.suiteWrap, { borderColor: colors.tools.interview + '35', backgroundColor: colors.tools.interview + '0a' }]}>
          <View style={[styles.suiteAccent, { backgroundColor: colors.tools.interview }]} />
          <View style={styles.suiteContent}>
            <View style={[styles.suitePill, { backgroundColor: colors.tools.interview + '22' }]}>
              <Feather name="trending-up" size={10} color={colors.tools.interview} />
              <Text style={[styles.suitePillText, { color: colors.tools.interview }]}>Career Suite</Text>
            </View>
            <Text style={[styles.suiteTitle, { color: colors.foreground }]}>Get hired. Go further.</Text>
            <Text style={[styles.suiteDesc, { color: colors.mutedForeground }]}>
              Tailored to your experience, location & career goal
            </Text>
          </View>
        </View>
        <View style={styles.toolGrid}>
          {CAREER_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} onPress={() => handleToolPress(tool.id)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: { paddingHorizontal: 20, marginTop: 8 },
  heroCard: { padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1, gap: 6 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  heroSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14 },

  section: { paddingHorizontal: 20, marginTop: 24, gap: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },

  row: { flexDirection: 'row', gap: 12 },

  /* Suite header card */
  suiteWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suiteAccent: { width: 4 },
  suiteContent: { flex: 1, padding: 14, gap: 4 },
  suitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 2,
  },
  suitePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  suiteTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  suiteDesc:  { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },

  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
