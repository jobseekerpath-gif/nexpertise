import { useMemo } from 'react';
import { useColors } from '@/hooks/useColors';
import type { ToolInfo } from '@/components/ToolCard';

export function useTools(): ToolInfo[] {
  const colors = useColors();
  return useMemo(
    () => [
      {
        id: 'english-guru',
        title: 'English Guru',
        subtitle: 'Practice speaking with AI tutors',
        icon: 'message-circle',
        color: colors.tools.english,
      },
      {
        id: 'tools-pro',
        title: 'Tools Pro',
        subtitle: 'Grammar, writing & vocabulary',
        icon: 'tool',
        color: colors.tools.english,
      },
      {
        id: 'my-journey',
        title: 'My Journey',
        subtitle: 'CEFR roadmap & streak tracking',
        icon: 'compass',
        color: colors.tools.english,
      },
      {
        id: 'interview-ace',
        title: 'Interview Ace',
        subtitle: 'Mock interviews and feedback',
        icon: 'users',
        color: colors.tools.interview,
      },
      {
        id: 'resume-intelligence',
        title: 'Resume',
        subtitle: 'ATS score & keyword analysis',
        icon: 'file-text',
        color: colors.tools.resume,
      },
      {
        id: 'rozgar-samachar',
        title: 'Rozgar Samachar',
        subtitle: 'Live jobs & salary insights',
        icon: 'briefcase',
        color: colors.tools.rozgar,
      },
    ],
    [colors.tools],
  );
}
