# Publishing EduBharat Mobile to the Google Play Store

This guide takes the Expo app in `artifacts/edubharat-mobile` from source to a
live Play Store listing. It only needs to be done from a machine with the Expo
CLI signed in to your Expo account — the Replit workspace is for development, the
release build itself is produced by EAS Build in the cloud.

> Nothing here builds automatically. These are the manual steps you (the app
> owner) run when you're ready to publish. The config files (`app.json`,
> `eas.json`) are already prepared.

---

## 0. One-time accounts you need

1. **Google Play Developer account** — one-time US $25 fee at
   https://play.google.com/console. Approval can take a day or two, so start early.
2. **Expo account** — free, at https://expo.dev. This is where EAS Build runs.

---

## 1. Lock the Android package name (permanent!)

`app.json` → `expo.android.package` is currently:

```
in.edubharat.mobile
```

⚠️ **This string can never be changed once the app is live on Play.** If you own
a different domain, set it to your reverse-domain (e.g. `com.yourcompany.edubharat`)
**before** the first upload. After the first release it is locked forever.

---

## 2. Install and sign in to EAS

```bash
npm install -g eas-cli
eas login
```

Then, from `artifacts/edubharat-mobile`:

```bash
eas init      # links this project to your Expo account and writes the EAS projectId into app.json
```

---

## 3. App version numbers

- `expo.version` (`1.0.0`) — the human-facing version shown on the store.
- `expo.android.versionCode` (`1`) — the internal integer Play uses to order
  builds. **Every upload must have a higher versionCode than the last.**

`eas.json` sets `"autoIncrement": true` on the `production` profile, so EAS bumps
`versionCode` for you on each production build. Only bump `version` by hand when
you want the store to show a new version string.

---

## 4. Produce the release build (AAB)

Play requires an Android App Bundle (`.aab`), which the `production` profile
builds:

```bash
eas build --platform android --profile production
```

EAS builds in the cloud and, on first run, offers to **generate a new Android
Keystore** — say yes and let EAS manage it (losing your keystore means you can
never update the app). When it finishes you get a downloadable `.aab`.

To smoke-test on a real device first, build an installable APK instead:

```bash
eas build --platform android --profile preview
```

---

## 5. First upload — must be done by hand

Google requires the **very first** build to be uploaded manually:

1. In the Play Console, **Create app** → fill in name (**EduBharat**), default
   language, app/game = App, free/paid.
2. Go to **Testing → Internal testing → Create new release**.
3. Upload the `.aab` from step 4.
4. Add release notes, then **Save → Review → Start rollout to Internal testing**.

---

## 6. Automated uploads after that (optional)

Once the app exists in the Console you can let EAS submit for you:

1. Play Console → **Setup → API access** → create/link a **Google Cloud service
   account**, grant it the *Release manager* role, and download its JSON key.
2. Save the key as `google-service-account.json` inside
   `artifacts/edubharat-mobile` (it is git-ignored — never commit it) — this path
   is already referenced in `eas.json`.
3. From then on:

```bash
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

This uploads to the **internal** track (see `eas.json` → `submit.production.android.track`).
Change `track` to `production` when you're ready for a public release.

---

## 7. Store listing checklist (done in the Play Console)

Google won't let you go live until these are filled in:

- **App icon** — 512×512 PNG (source: `assets/images/icon.png`, upscale if needed).
- **Feature graphic** — 1024×500 PNG/JPG.
- **Phone screenshots** — at least 2 (min 320px, 16:9 or 9:16). Capture from a
  `preview` build.
- **Short description** (≤80 chars) and **full description** (≤4000 chars).
- **Privacy policy URL** — required because the app has user accounts / Google
  sign-in. Host one on the EduBharat web app and link it here.
- **Data safety form** — declare what you collect. This app collects: account
  info (name, email via Google sign-in), and app activity (learning progress).
  Data is sent over HTTPS to the EduBharat API.
- **Content rating** questionnaire.
- **Target audience** — select the appropriate age groups.

---

## 8. Before you ship — app config to double-check

- **API base URL**: the mobile app talks to the EduBharat API. Make sure it
  points at your **deployed** API domain (not a dev `*.replit.dev` URL) in a
  production build. See `getApiUrl()` in the mobile source.
- **Google OAuth**: add the production redirect/scheme to the Google Cloud OAuth
  client so sign-in works in the released build.
- **`expo-router` origin** in `app.json` (currently `https://replit.com/`) should
  be your production web origin for correct deep-linking.

---

### Quick reference

| Task | Command |
| --- | --- |
| Link project to Expo | `eas init` |
| Test build (APK) | `eas build -p android --profile preview` |
| Release build (AAB) | `eas build -p android --profile production` |
| Upload to Play (after 1st manual upload) | `eas submit -p android --profile production --latest` |
