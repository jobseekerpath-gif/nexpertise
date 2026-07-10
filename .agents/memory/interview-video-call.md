---
name: Interview Ace video call UI
description: The interview session phase uses a full-screen dark video-call layout with webcam PiP and a red hang-up end button.
---

When `phase === "interview"`, the InterviewAce page renders a fixed full-screen dark overlay instead of the old card+sidebar layout.

**Layout:**
- `fixed inset-0 bg-gray-950 flex flex-col z-30` with `style={{ top: 56 }}` to sit below the nav bar
- Top HUD: coach name + interview type left, timer right — gradient overlay so text is readable over dark bg
- Thin progress bar strip below HUD
- Flex-1 center area (flex-col): a `flex-1 min-h-0` avatar region (AI avatar size `lg` + voice visualiser bars, centred) then the question caption as a `shrink-0` block in NORMAL FLOW directly below — NOT absolutely positioned. Caption box caps at `max-h-[38vh] overflow-y-auto` for long questions.
- User webcam PiP: `position: absolute top-14 right-3`, 24×18 (sm: 32×24), mirrored with `scaleX(-1)`
- Bottom panel: `bg-gray-900` with Textarea + mic pill + Submit + red PhoneOff hang-up button

**Webcam:**
- `startWebcam()` calls `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`
- Stream stored in `webcamStreamRef.current`; attached to `<video ref={webcamRef}>` via 200ms setTimeout after phase transition
- `stopWebcam()` is idempotent; `cameraError` state shown as "No camera" fallback in the PiP box

**Auto-off invariant (camera must never outlive the interview):**
- The component stays MOUNTED through the report phase, so unmount cleanup alone does NOT release the camera when the interview ends. A `useEffect` stops the webcam on ANY transition out of `phase === "interview"` (covers time-up, all-questions-done, and hang-up).
- Race guard: `startWebcam` re-checks `phaseRef.current !== "interview"` AFTER the `getUserMedia` await and stops the freshly granted stream if the interview already ended while the permission prompt was still open — otherwise a late-resolving stream attaches on the report screen and never stops.

**End call:**
- Red circular button (`bg-red-600 rounded-full w-10 h-10`) with `PhoneOff` icon
- Calls `endEarly()` which also calls `synth.stop()` + `stopWebcam()`

**Caption must never overlap the face:** the question caption sits in normal flow BELOW the avatar (its own `shrink-0` sibling), not `absolute bottom-4`. The old absolute caption floated over the vertically-centred avatar and, on short viewports (e.g. a laptop with two rows of browser tabs), covered the interviewer's face entirely — a reported bug. Keep the avatar in a `flex-1 min-h-0` region and the caption as a reserved-space sibling so they can never collide.

**Why:** Old layout had a mobile progress bar rendering as a thin yellow line (collapsed layout). Video call feel matches the "live interview" expectation without needing paid lip-sync APIs.
