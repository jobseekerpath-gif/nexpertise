---
name: Voice switching should stop playback
description: Changing tutor voice should immediately cancel any active speech so the session never mixes voices.
---

When the user changes the tutor voice, stop any currently playing speech immediately before the next utterance starts.

**Why:** if the old utterance keeps playing after a voice change, the user hears mixed male/female playback and the setting feels broken.

**How to apply:** wire voice-setting changes to cancel speech right away, then let the next response use the newly selected voice.