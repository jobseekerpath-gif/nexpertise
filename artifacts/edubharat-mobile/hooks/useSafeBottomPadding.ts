import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns the bottom padding needed to avoid the tab bar overlapping content.
 *
 * iOS 26 with NativeTabs uses a system tab bar (liquid glass) that is not part
 * of the React Navigation bottom-tabs context, so useBottomTabBarHeight() is
 * only safe for the classic tab bar path. isLiquidGlassAvailable() is stable
 * for the app session, so this conditional hook call is safe.
 */
export function useSafeBottomPadding(): number {
  const insets = useSafeAreaInsets();
  if (isLiquidGlassAvailable()) {
    return insets.bottom + 24;
  }
  const tabHeight = useBottomTabBarHeight();
  return insets.bottom + tabHeight + 24;
}
