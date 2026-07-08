import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { ToolCard } from '@/components/ToolCard';
import { Feather } from '@expo/vector-icons';
import type { ToolInfo } from '@/components/ToolCard';

function SuiteHeader({
  icon, label, title, desc, color,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  title: string;
  desc: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.suiteWrap, { borderColor: color + '35', backgroundColor: color + '0a' }]}>
      <View style={[styles.suiteAccent, { backgroundColor: color }]} />
      <View style={styles.suiteContent}>
        <View style={[styles.suitePill, { backgroundColor: color + '22' }]}>
          <Feather name={icon} size={10} color={color} />
          <Text style={[styles.suitePillText, { color }]}>{label}</Text>
        </View>
        <Text style={[styles.suiteTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.suiteDesc, { color: colors.mutedForeground }]}>{desc}</Text>
      </View>
    </View>
  );
}

export default function ToolsScreen() {
  const colors = useColors();
  const bottomPadding = useSafeBottomPadding();
  const router = useRouter();

  const FLUENCY_TOOLS: ToolInfo[] = [
    { id: 'english-guru',       title: 'English Guru', subtitle: 'AI conversation & speaking practice',   icon: 'message-circle', color: colors.tools.english },
    { id: 'tools-pro',          title: 'Tools Pro',    subtitle: 'Grammar, writing, vocab & pronunciation',icon: 'tool',           color: colors.tools.english },
    { id: 'my-journey',         title: 'My Journey',   subtitle: 'CEFR roadmap, streaks & mastery badges', icon: 'compass',        color: colors.tools.english },
  ];

  const CAREER_TOOLS: ToolInfo[] = [
    { id: 'interview-ace',       title: 'Interview Ace',   subtitle: 'Mock interviews with AI feedback',    icon: 'users',     color: colors.tools.interview },
    { id: 'rozgar-samachar',     title: 'Rozgar Samachar', subtitle: 'Live job feed & salary insights',     icon: 'briefcase', color: colors.tools.rozgar    },
    { id: 'resume-intelligence', title: 'Resume',          subtitle: 'ATS score & keyword optimisation',    icon: 'file-text', color: colors.tools.resume    },
  ];

  function handlePress(id: string) {
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
      <Header title="Your suites" subtitle="Two paths — choose yours today" />

      {/* ── Fluency Suite ────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SuiteHeader
          icon="book-open"
          label="Fluency Suite"
          title="Speak with confidence"
          desc="Master English naturally — in Hindi, Tamil & 10+ Indian languages"
          color={colors.tools.english}
        />
        <View style={styles.grid}>
          {FLUENCY_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} large onPress={() => handlePress(tool.id)} />
          ))}
        </View>
      </View>

      {/* ── Career Suite ─────────────────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <SuiteHeader
          icon="trending-up"
          label="Career Suite"
          title="Get hired. Go further."
          desc="Interview prep, live jobs & resume — tailored to your profile"
          color={colors.tools.interview}
        />
        <View style={styles.grid}>
          {CAREER_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} large onPress={() => handlePress(tool.id)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24, gap: 12 },
  grid: { gap: 12 },

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
  suiteTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#1a1a2e',
  },
  suiteDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#6b7280',
  },
});
