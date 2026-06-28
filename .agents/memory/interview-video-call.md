---
name: Interview Ace video call UI
description: The interview session phase uses a full-screen dark video-call layout with webcam PiP and a red hang-up end button.
---

When `phase === "interview"`, the InterviewAce page renders a fixed full-screen dark overlay instead of the old card+sidebar layout.

**Layout:**
- `fixed inset-0 bg-gray-950 flex flex-col z-30` with `style={{ top: 56 }}` to sit below the nav bar
- Top HUD: coach name + interview type left, timer right — gradient overlay so text is readable over dark bg
- Thin progress bar strip below HUD
- Flex-1 center area: AI avatar large + voice visualiser bars + question subtitle at bottom
- User webcam PiP: `position: absolute top-14 right-3`, 24×18 (sm: 32×24), mirrored with `scaleX(-1)`
- Bottom panel: `bg-gray-900` with Textarea + mic pill + Submit + red PhoneOff hang-up button

**Webcam:**
- `startWebcam()` calls `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`
- Stream stored in `webcamStreamRef.current`; attached to `<video ref={webcamRef}>` via 200ms setTimeout after phase transition
- `stopWebcam()` called in `endEarly()` and component unmount cleanup
- `cameraError` state shown as "No camera" fallback in the PiP box

**End call:**
- Red circular button (`bg-red-600 rounded-full w-10 h-10`) with `PhoneOff` icon
- Calls `endEarly()` which also calls `synth.stop()` + `stopWebcam()`

**Why:** Old layout had a mobile progress bar rendering as a thin yellow line (collapsed layout). Video call feel matches the "live interview" expectation without needing paid lip-sync APIs.
