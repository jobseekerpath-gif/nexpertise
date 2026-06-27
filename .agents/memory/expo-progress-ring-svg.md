---
name: Expo progress ring SVG
description: Accurate circular progress indicator in React Native using SVG stroke dash offset.
---

For a circular progress indicator in React Native, use `react-native-svg` with `Circle` elements and `strokeDasharray`/`strokeDashoffset` rather than CSS border tricks or rotation hacks.

**Rule:** Render a background `Circle` and a foreground `Circle` with `strokeDasharray={circumference}` and `strokeDashoffset={circumference - (value / 100) * circumference}`. Rotate the foreground circle by `-90` degrees so the arc starts at the 12 o'clock position.

**Why:** Border-rotation approximations do not produce a true arc proportional to the percentage, which breaks the visual accuracy of dashboards and progress rings.

**How to apply:**
1. Calculate `circumference = 2 * Math.PI * radius` from the ring size and stroke width.
2. Clamp the value to `[0, 100]` before computing the offset.
3. Use `react-native-svg` (already available in the Expo scaffold) instead of Animated or CSS-based approximations.
