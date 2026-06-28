import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTools } from '@/hooks/useTools';
import { Header } from '@/components/Header';
import { ActionButton } from '@/components/ActionButton';
import { EmptyState } from '@/components/EmptyState';
import { incrementProgress } from '@/lib/storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const PROMPTS: Record<string, string> = {
  'english-guru': 'Type a sentence or question in English. Your AI tutor will correct, explain, and help you improve...',
  'interview-ace': 'Enter the job role you are preparing for (e.g. "Software Engineer at TCS")...',
  'resume-intelligence': 'Paste a summary of your experience or a resume paragraph for AI analysis...',
  'rozgar-samachar': 'Type a city, skill, or job keyword to find opportunities (e.g. "Data analyst jobs in Pune")...',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  'english-guru': 'You are Priya Ma\'am, a warm and encouraging English tutor for Indian learners. When the user writes something, correct any grammar or vocabulary mistakes, explain the correction clearly with examples from Indian daily life, and give a better version of their sentence. Keep responses under 150 words. Be encouraging and practical.',
  'interview-ace': 'You are Raj Sir, an experienced Indian HR interview coach. When given a job role, provide 3 likely interview questions with ideal concise answers using the STAR method. Focus on Indian corporate context. Keep each answer under 80 words.',
  'resume-intelligence': 'You are an expert Indian resume reviewer with 15 years of experience in Indian hiring. Analyse the given resume text or experience summary. Give: (1) ATS score out of 100, (2) top 3 missing keywords for Indian job market, (3) 3 specific actionable improvements. Keep the total response under 200 words.',
  'rozgar-samachar': 'You are a career advisor specialising in the Indian job market. Given a job search query, provide: (1) 3 specific job titles matching the query with likely salary ranges in LPA, (2) top 2 skills to add, (3) the best Indian job portal to use for this search. Keep response under 150 words.',
};

const API_BASE = process.env['EXPO_PUBLIC_DOMAIN']
  ? `https://${process.env['EXPO_PUBLIC_DOMAIN']}/api`
  : '';

async function callGemini(toolId: string, userInput: string): Promise<string> {
  if (!API_BASE) return 'API not configured. Please check your environment setup.';

  const system = SYSTEM_PROMPTS[toolId] ?? SYSTEM_PROMPTS['english-guru'];

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userInput }],
      system,
      maxTokens: 400,
    }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }

  const data = await res.json() as { content?: string; text?: string };
  return data.content ?? data.text ?? 'No response received.';
}

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tools = useTools();
  const tool = tools.find((t) => t.id === id);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!tool) return;
    incrementProgress(mapToolToProgressKey(tool.id)).catch(() => {});
  }, [tool]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [loading, pulseAnim]);

  if (!tool) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Tool not found" subtitle="This tool does not exist yet." />
      </View>
    );
  }

  const handleAction = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const response = await callGemini(tool.id, input.trim());
      setResult(response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const actionLabel =
    tool.id === 'rozgar-samachar' ? 'Search Jobs' :
    tool.id === 'resume-intelligence' ? 'Analyse Resume' :
    tool.id === 'interview-ace' ? 'Get Interview Questions' :
    'Get AI Guidance';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Header title={tool.title} subtitle={tool.subtitle} showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                backgroundColor: tool.color + '18',
                borderRadius: colors.radius * 1.5,
                opacity: loading ? pulseAnim : 1,
              },
            ]}
          >
            <Feather name={tool.icon} size={36} color={tool.color} />
          </Animated.View>
          {loading && (
            <Text style={[styles.loadingText, { color: tool.color }]}>
              AI is thinking...
            </Text>
          )}
        </View>

        <View style={styles.inputSection}>
          <TextInput
            multiline
            value={input}
            onChangeText={setInput}
            placeholder={PROMPTS[tool.id]}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: colors.radius,
              },
            ]}
          />
          <ActionButton
            title={actionLabel}
            onPress={handleAction}
            loading={loading}
          />
        </View>

        {error ? (
          <View
            style={[
              styles.result,
              { backgroundColor: '#FEF2F2', borderRadius: colors.radius, marginHorizontal: 20, borderWidth: 1, borderColor: '#FECACA' },
            ]}
          >
            <Text style={styles.errorTitle}>⚠️ Could not get response</Text>
            <Text style={[styles.resultText, { color: '#DC2626' }]}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View
            style={[
              styles.result,
              { backgroundColor: colors.accent, borderRadius: colors.radius, marginHorizontal: 20 },
            ]}
          >
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              {tool.id === 'english-guru' ? '📝 Tutor Feedback' :
               tool.id === 'interview-ace' ? '🎯 Interview Prep' :
               tool.id === 'resume-intelligence' ? '📊 Resume Analysis' :
               '💼 Job Opportunities'}
            </Text>
            <Text style={[styles.resultText, { color: colors.accentForeground }]}>{result}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mapToolToProgressKey(id: string): 'englishMinutes' | 'interviewCount' | 'resumeAnalyses' | 'jobsSaved' {
  switch (id) {
    case 'english-guru': return 'englishMinutes';
    case 'interview-ace': return 'interviewCount';
    case 'resume-intelligence': return 'resumeAnalyses';
    case 'rozgar-samachar': return 'jobsSaved';
    default: return 'englishMinutes';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  iconContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  inputSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 8,
  },
  input: {
    minHeight: 120,
    padding: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  result: {
    padding: 16,
    gap: 8,
    marginTop: 20,
  },
  resultTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    marginBottom: 4,
  },
  resultText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  errorTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 4,
  },
});
