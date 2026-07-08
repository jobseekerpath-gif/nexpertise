---
name: Expo vector-icons must be preloaded
description: Why @expo/vector-icons render as tofu boxes in native Expo Go and the required fix
---

# Expo vector-icons render as boxes in native Expo Go unless preloaded

On Expo SDK 54 (react-native 0.81, @expo/vector-icons 15), icon glyphs
(`<Feather .../>` etc.) render as empty "tofu" boxes on a **physical device via
Expo Go** even though they render fine in the **web preview**. The web bundle
injects the icon font CSS automatically; native does not always self-load it in
time before first render.

**Rule:** preload every `@expo/vector-icons` family used in the app inside the
root `useFonts(...)` call in `app/_layout.tsx`, e.g. `...Feather.font`. Only
Feather is used in EduBharat Mobile — if another family is added (Ionicons,
MaterialIcons, ...), spread its `.font` too.

**Why:** the app already gates render on `useFonts` for the Inter text fonts
(`if (!fontsLoaded && !fontError) return null;`). Adding the icon font to that
same gate guarantees glyphs exist before anything paints, so no tofu boxes.

**How to apply:** if a user reports "all icons are broken squares" or "the app
looks dummy/placeholder" on their phone but the Replit web preview looks fine,
this is the cause. The web screenshot tool will NOT reproduce it — trust the
user's device screenshot. Fix = preload the icon font; then have them re-scan
the QR in Expo Go (old bundle is cached).
