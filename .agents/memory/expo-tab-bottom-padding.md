---
name: Expo tab bottom padding
description: Safe bottom padding strategy for Expo Router apps that support both NativeTabs (iOS 26 liquid glass) and classic bottom tabs.
---

Expo Router supports `NativeTabs` on iOS 26+ and falls back to classic `Tabs` on older iOS/Android/web. The bottom padding strategy must be different for each mode because `useBottomTabBarHeight` from `@react-navigation/bottom-tabs` only works inside the classic bottom-tabs navigator.

**Rule:** Use a single `useSafeBottomPadding()` hook that returns `insets.bottom + 24` for NativeTabs and `insets.bottom + useBottomTabBarHeight() + 24` for classic tabs. Apply the returned value to `ScrollView`/`FlatList` `contentContainerStyle.paddingBottom` on every tab screen.

**Why:** Calling `useBottomTabBarHeight()` when the active navigator is `NativeTabs` throws or returns an invalid value because the screen is no longer inside the bottom-tabs context. Hardcoding tab bar height breaks on devices with different safe-area insets.

**How to apply:**
1. Gate on `isLiquidGlassAvailable()` from `expo-glass-effect` (stable for the app session).
2. Only call `useBottomTabBarHeight()` in the classic-tabs branch.
3. Add `@react-navigation/bottom-tabs` as an explicit dependency so TypeScript resolves the import.
