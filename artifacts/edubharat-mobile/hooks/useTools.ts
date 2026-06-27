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
        id: 'interview-ace',
        title: 'Interview Ace',
        subtitle: 'Mock interviews and feedback',
        icon: 'users',
        color: colors.tools.interview,
      },
      {
        id: 'resume-intelligence',
        title: 'Resume IQ',
        subtitle: 'Analyze and improve your resume',
        icon: 'file-text',
        color: colors.tools.resume,
      },
      {
        id: 'rozgar-samachar',
        title: 'Rozgar',
        subtitle: 'Discover jobs and opportunities',
        icon: 'briefcase',
        color: colors.tools.rozgar,
      },
    ],
    [colors.tools],
  );
}
