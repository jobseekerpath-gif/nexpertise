import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { Header } from '@/components/Header';
import { ActionButton } from '@/components/ActionButton';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { getProfile, saveProfile, type Profile } from '@/lib/storage';

const FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Full name', placeholder: 'Your name' },
  { key: 'age', label: 'Age', placeholder: 'e.g. 24' },
  { key: 'education', label: 'Education', placeholder: 'Graduate, Diploma, etc.' },
  { key: 'careerGoal', label: 'Career goal', placeholder: 'IT / Tech, Government Job, etc.' },
  { key: 'skills', label: 'Skills', placeholder: 'Excel, Java, communication...' },
  { key: 'language', label: 'Preferred language', placeholder: 'English, Hindi, etc.' },
  { key: 'location', label: 'Location', placeholder: 'City or state' },
  { key: 'salaryExpectation', label: 'Salary expectation', placeholder: '₹3-5 LPA' },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = useSafeBottomPadding();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getProfile().then((p) => { if (mounted) setProfile(p); });
      return () => { mounted = false; };
    }, []),
  );

  const update = (key: keyof Profile, value: string) => {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    await saveProfile(profile);
    setSaved(true);
  };

  if (!profile) return <LoadingPlaceholder />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Profile" subtitle="Tell us about your career goals" />

      <View style={styles.form}>
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{field.label}</Text>
            <TextInput
              value={profile[field.key]}
              onChangeText={(text) => update(field.key, text)}
              placeholder={field.placeholder}
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
          </View>
        ))}

        <View style={styles.saveRow}>
          {saved && <Text style={[styles.saved, { color: colors.primary }]}>Saved</Text>}
          <ActionButton title="Save profile" onPress={handleSave} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  saveRow: {
    marginTop: 8,
    gap: 8,
  },
  saved: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
  },
});
