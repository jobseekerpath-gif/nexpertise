---
name: Tutor portrait system
description: How AI teacher portraits are generated and wired into the app
---

# Tutor Portrait System

## Rule
All AI teacher avatars use real AI-generated portrait photos stored in `artifacts/edubharat/public/images/`. Never use cartoon SVG as the primary avatar — SVG is the fallback only.

**Why:** The master prompt explicitly bans cartoon avatars and requires "realistic AI-generated human portraits." Browser-fallback SVG is kept for resilience only.

## How to apply
- Portrait images live at `/images/tutor-<id>.jpg` inside `public/images/`
- All 6 tutor personas defined in `artifacts/edubharat/src/lib/tutors.ts` (TUTORS array + INTERVIEW_COACHES)
- `AnimatedAvatar` accepts `imageSrc` prop — resets `imgFailed` state on `imageSrc` change so switching tutors always tries the new image
- To add a new tutor: generate portrait via `generateImage(...)`, add entry to `TUTORS` array, done

## Current tutors
- priya (female, orange, Friendly Spoken English)
- rohit (male, blue, Corporate Communication)
- maya (female, teal, Business English)
- arjun (male, purple, Interview English)
- neha (female, pink, Pronunciation)
- rahul (male, amber, Grammar & Writing)
- raj (male, navy, Interview Coach — INTERVIEW_COACHES array)
