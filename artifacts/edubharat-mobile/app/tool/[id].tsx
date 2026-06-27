import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
  'english-guru': 'Type a sentence in English and your AI tutor will correct and guide you...',
  'interview-ace': 'Enter the job role you are preparing for...',
  'resume-intelligence': 'Paste a short summary of your experience or a resume paragraph...',
  'rozgar-samachar': 'Type a city or job keyword to search...',
};

const RESPONSES: Record<string, string> = {
  'english-guru': 'Great effort! Your sentence structure is clear. Try adding more descriptive adjectives and practice speaking it aloud.',
  'interview-ace': 'Here is a likely question: "Tell me about a time you solved a difficult problem." Start with the STAR method and keep it under 2 minutes.',
  'resume-intelligence': 'Your summary highlights solid experience. Add measurable outcomes (e.g., "increased sales by 20%") and keep it to 3-4 lines.',
  'rozgar-samachar': 'Found 3 matching opportunities nearby. Save the ones you like and track applications in your progress tab.',
};

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tools = useTools();
  const tool = tools.find((t) => t.id === id);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    if (!tool) return;
    incrementProgress(mapToolToProgressKey(tool.id)).catch(() => { /* ignore */ });
  }, [tool]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* ignore */ });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setResult(RESPONSES[tool.id] ?? 'Keep practicing!');
    setLoading(false);
  };

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
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: tool.color + '15', borderRadius: colors.radius * 1.5 },
            ]}
          >
            <Feather name={tool.icon} size={36} color={tool.color} />
          </View>
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
          <ActionButton title={tool.id === 'rozgar-samachar' ? 'Search' : 'Get AI guidance'} onPress={handleAction} loading={loading} />
        </View>

        {result ? (
          <View
            style={[
              styles.result,
              { backgroundColor: colors.accent, borderRadius: colors.radius, marginHorizontal: 20 },
            ]}
          >
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>AI feedback</Text>
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
  container: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
  },
  resultText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
