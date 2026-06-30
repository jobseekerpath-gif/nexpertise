import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import type { InterviewSession } from './index';

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const colors = useColors();
  const pct = value != null ? Math.max(0, Math.min(10, value)) / 10 : 0;

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color: colors.foreground }]}>
        {value != null ? `${value}/10` : '—'}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InterviewDetailScreen() {
  const colors = useColors();
  const bottomPadding = useSafeBottomPadding();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [session, setSession] = useState<InterviewSession | null | 'not-found'>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setError(null);
      fetchInterviews()
        .then((all) => {
          if (!mounted) return;
          const found = all.find((s) => s.id === id);
          setSession(found ?? 'not-found');
        })
        .catch((err) => { if (mounted) setError(err.message); });
      return () => { mounted = false; };
    }, [id]),
  );

  if (session === null && !error) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || session === 'not-found') {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Interview Detail" showBack />
        <EmptyState
          icon="alert-circle"
          title={error ? 'Failed to load' : 'Session not found'}
          subtitle={error ?? 'This session may have been deleted.'}
        />
      </ScrollView>
    );
  }

  // Parse feedback JSON for summary text
  let feedbackSummary: string | null = null;
  if (session.feedbackJson) {
    try {
      const parsed = JSON.parse(session.feedbackJson);
      feedbackSummary =
        parsed.summary ??
        parsed.overallFeedback ??
        parsed.feedback ??
        (typeof parsed === 'string' ? parsed : null);
    } catch {
      feedbackSummary = session.feedbackJson;
    }
  }

  const date = new Date(session.createdAt).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const durationMin =
    session.durationSeconds != null ? Math.round(session.durationSeconds / 60) : null;

  const score = session.overallScore;
  const scoreColor =
    score == null
      ? colors.mutedForeground
      : score >= 7
      ? '#22c55e'
      : score >= 5
      ? '#f59e0b'
      : '#ef4444';

  // Parse Q&A transcript
  type QA = { question: string; answer?: string; feedback?: string };
  let questions: QA[] = [];
  if (session.questionsData) {
    try {
      const parsed = JSON.parse(session.questionsData);
      if (Array.isArray(parsed)) questions = parsed;
    } catch {
      // ignore
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Header title={session.role} subtitle={date} showBack />

      {/* Overall score hero */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: scoreColor + '12', borderColor: scoreColor + '40', borderRadius: colors.radius },
        ]}
      >
        <Text style={[styles.heroScore, { color: scoreColor }]}>
          {score != null ? score : '—'}
          <Text style={[styles.heroScoreDen, { color: scoreColor }]}>/10</Text>
        </Text>
        <Text style={[styles.heroLabel, { color: scoreColor }]}>Overall Score</Text>
        <View style={styles.heroMeta}>
          <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
            {session.experienceLevel}
          </Text>
          {session.interviewType && (
            <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
              · {session.interviewType}
            </Text>
          )}
          {durationMin != null && (
            <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
              · {durationMin} min
            </Text>
          )}
        </View>
      </View>

      {/* Score breakdown */}
      {(session.communicationScore != null ||
        session.grammarScore != null ||
        session.confidenceScore != null ||
        session.technicalScore != null) && (
        <Section title="Score Breakdown">
          <View
            style={[
              styles.breakdownCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <ScoreBar label="Communication" value={session.communicationScore} color="#3b82f6" />
            <ScoreBar label="Grammar" value={session.grammarScore} color="#8b5cf6" />
            <ScoreBar label="Confidence" value={session.confidenceScore} color="#f59e0b" />
            <ScoreBar label="Technical" value={session.technicalScore} color="#22c55e" />
          </View>
        </Section>
      )}

      {/* Feedback summary */}
      {feedbackSummary && (
        <Section title="Feedback Summary">
          <View
            style={[
              styles.feedbackCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Text style={[styles.feedbackText, { color: colors.foreground }]}>{feedbackSummary}</Text>
          </View>
        </Section>
      )}

      {/* Q&A transcript */}
      {questions.length > 0 && (
        <Section title={`Questions & Answers (${questions.length})`}>
          {questions.map((qa, i) => (
            <View
              key={i}
              style={[
                styles.qaCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <Text style={[styles.qaIndex, { color: colors.mutedForeground }]}>Q{i + 1}</Text>
              <Text style={[styles.qaQuestion, { color: colors.foreground }]}>{qa.question}</Text>
              {qa.answer && (
                <Text style={[styles.qaAnswer, { color: colors.mutedForeground }]}>{qa.answer}</Text>
              )}
              {qa.feedback && (
                <View style={[styles.qaFeedbackBox, { backgroundColor: colors.primary + '10', borderRadius: colors.radius - 2 }]}>
                  <Text style={[styles.qaFeedbackText, { color: colors.primary }]}>{qa.feedback}</Text>
                </View>
              )}
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  heroScore: { fontFamily: 'Inter_700Bold', fontSize: 56 },
  heroScoreDen: { fontFamily: 'Inter_400Regular', fontSize: 24 },
  heroLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 4 },
  heroMeta: { flexDirection: 'row', gap: 4, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  heroMetaText: { fontFamily: 'Inter_400Regular', fontSize: 13 },

  section: { paddingHorizontal: 20, marginTop: 24, gap: 10 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },

  breakdownCard: {
    padding: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, width: 110 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 36, textAlign: 'right' },

  feedbackCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedbackText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },

  qaCard: {
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  qaIndex: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  qaQuestion: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  qaAnswer: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  qaFeedbackBox: { padding: 10, marginTop: 4 },
  qaFeedbackText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
});
