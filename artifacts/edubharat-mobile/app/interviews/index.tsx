import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InterviewSession = {
  id: string;
  role: string;
  experienceLevel: string;
  interviewType: string | null;
  overallScore: number | null;
  communicationScore: number | null;
  grammarScore: number | null;
  confidenceScore: number | null;
  technicalScore: number | null;
  durationSeconds: number | null;
  feedbackJson: string | null;
  questionsData: string | null;
  createdAt: string;
};

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE = process.env['EXPO_PUBLIC_DOMAIN']
  ? `https://${process.env['EXPO_PUBLIC_DOMAIN']}/api`
  : '';

async function fetchInterviews(): Promise<InterviewSession[]> {
  if (!API_BASE) return [];
  const res = await fetch(`${API_BASE}/sessions/interview?limit=50`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.sessions as InterviewSession[];
}

// ─── Score Trend Mini-Chart ────────────────────────────────────────────────────

function ScoreTrend({ sessions }: { sessions: InterviewSession[] }) {
  const colors = useColors();
  const scored = [...sessions]
    .filter((s) => s.overallScore != null)
    .reverse() // oldest first for left→right trend
    .slice(-10);

  if (scored.length < 2) return null;

  const W = 120;
  const H = 36;
  const PAD = 4;
  const scores = scored.map((s) => s.overallScore as number);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const pts = scores.map((v, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = PAD + ((1 - (v - min) / range) * (H - PAD * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lastScore = scores[scores.length - 1];
  const firstScore = scores[0];
  const trending = lastScore >= firstScore;
  const trendColor = trending ? '#22c55e' : '#ef4444';

  const [lastX, lastY] = pts[pts.length - 1].split(',').map(Number);

  return (
    <View style={styles.trendRow}>
      <Svg width={W} height={H}>
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={trendColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={lastX} cy={lastY} r={3} fill={trendColor} />
      </Svg>
      <Text style={[styles.trendLabel, { color: trending ? '#22c55e' : '#ef4444' }]}>
        {trending ? '▲' : '▼'} {lastScore}/10
      </Text>
    </View>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onPress,
}: {
  session: InterviewSession;
  onPress: () => void;
}) {
  const colors = useColors();
  const score = session.overallScore;
  const scoreColor =
    score == null ? colors.mutedForeground : score >= 7 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';

  const date = new Date(session.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Interview for ${session.role}, score ${score ?? 'pending'}`}
    >
      <View style={[styles.scoreBox, { backgroundColor: scoreColor + '18', borderRadius: colors.radius - 2 }]}>
        <Text style={[styles.scoreNum, { color: scoreColor }]}>
          {score != null ? score : '—'}
        </Text>
        <Text style={[styles.scoreDen, { color: scoreColor }]}>/10</Text>
      </View>

      <View style={styles.rowMeta}>
        <Text style={[styles.rowRole, { color: colors.foreground }]} numberOfLines={1}>
          {session.role}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {session.experienceLevel}
          {session.interviewType ? ` · ${session.interviewType}` : ''} · {date}
        </Text>
      </View>

      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InterviewsScreen() {
  const colors = useColors();
  const bottomPadding = useSafeBottomPadding();
  const router = useRouter();

  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setError(null);
      fetchInterviews()
        .then((data) => { if (mounted) setSessions(data); })
        .catch((err) => { if (mounted) setError(err.message); });
      return () => { mounted = false; };
    }, []),
  );

  const avg =
    sessions && sessions.length > 0
      ? (
          sessions.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
          sessions.filter((s) => s.overallScore != null).length
        ).toFixed(1)
      : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Interview History" subtitle="Your past mock interview sessions" showBack />

      {/* Loading */}
      {sessions === null && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="wifi-off"
          title="Couldn't load sessions"
          subtitle="Please check your connection and try again."
        />
      )}

      {/* Empty */}
      {sessions !== null && sessions.length === 0 && (
        <EmptyState
          icon="mic"
          title="No interviews yet"
          subtitle="Complete a mock interview in Interview Ace to see your scores here."
        />
      )}

      {/* Summary + trend */}
      {sessions && sessions.length > 0 && (
        <>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <View style={styles.summaryLeft}>
              <Text style={[styles.summaryCount, { color: colors.foreground }]}>{sessions.length}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                {sessions.length === 1 ? 'Interview' : 'Interviews'}
              </Text>
            </View>
            {avg && (
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            )}
            {avg && (
              <View style={styles.summaryLeft}>
                <Text style={[styles.summaryCount, { color: colors.foreground }]}>{avg}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Avg score</Text>
              </View>
            )}
            {sessions.filter((s) => s.overallScore != null).length >= 2 && (
              <>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <ScoreTrend sessions={sessions} />
              </>
            )}
          </View>

          <View style={styles.list}>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onPress={() => router.push({ pathname: '/interviews/[id]', params: { id: session.id } })}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { paddingTop: 60, alignItems: 'center' },

  summaryCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: { alignItems: 'center', minWidth: 48 },
  summaryCount: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36 },

  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },

  list: { paddingHorizontal: 20, gap: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scoreBox: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
  },
  scoreNum: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  scoreDen: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  rowMeta: { flex: 1 },
  rowRole: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
});
