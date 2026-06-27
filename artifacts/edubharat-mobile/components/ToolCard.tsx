import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

export type ToolInfo = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
};

type ToolCardProps = {
  tool: ToolInfo;
  onPress: () => void;
  large?: boolean;
};

export function ToolCard({ tool, onPress, large }: ToolCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: colors.radius,
          padding: large ? 20 : 16,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: tool.color + '15', borderRadius: colors.radius },
        ]}
      >
        <Feather name={tool.icon} size={large ? 26 : 22} color={tool.color} />
      </View>
      <Text style={[styles.title, { color: colors.cardForeground, fontSize: large ? 18 : 15 }]}>
        {tool.title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{tool.subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    gap: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
});
