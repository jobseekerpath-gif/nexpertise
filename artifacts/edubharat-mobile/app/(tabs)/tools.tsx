import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTools } from '@/hooks/useTools';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { ToolCard } from '@/components/ToolCard';

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();
  const router = useRouter();
  const tools = useTools();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Header title="All tools" subtitle="Pick a skill to level up today" />
      <View style={[styles.grid, { paddingTop: 12 }]}>
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} large onPress={() => router.push(`/tool/${tool.id}`)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: 20,
    gap: 12,
  },
});
