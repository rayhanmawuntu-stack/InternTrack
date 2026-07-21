# InternTrack — GitHub Pages + Google Sheets (cloud-only)

This build preserves the original InternTrack interface while making Google Sheets the only persistent data store.

## What is included

- The original React/Vite UI without a redesign.
- No `localStorage`, `sessionStorage`, IndexedDB, cookies, or offline browser database.
- Google Sheets is loaded before the app opens.
- Every profile, attendance record, clock session, activity, quick note, full note, calendar event, work-hours setting, profile field, and notification preference is written to Google Sheets.
- Writes are read back from the Apps Script endpoint to confirm that Sheets committed them.
- Cross-device refresh when the page regains focus and every 30 seconds while open.
- Per-profile 6-digit PIN verification enforced by the Apps Script backend.
- Salted, server-peppered PIN hashes, five-attempt rate limiting, 15-minute lockouts, and temporary six-hour sessions.
- Pre-authentication requests expose only the profile picker; profile records are loaded only after successful verification.
- A ready-to-deploy GitHub Pages workflow.
- A prebuilt static site in `site/`.
- The Google Apps Script backend in `apps-script/`.

Because there is no persistent browser copy, the app requires an internet connection and a working Apps Script endpoint. If Sheets cannot be reached during startup, InternTrack shows a connection screen instead of opening with empty or stale local data.

## Google Sheets tabs

`setup()` creates and maintains these tabs:

- `InternTrackData` — canonical application records used by the app.
- `InternTrackUsers` — readable user profiles.
- `InternTrackAttendance` — clock-in, clock-out, past attendance, and attendance type.
- `InternTrackActivities` — dashboard activity entries.
- `InternTrackNotes` — full notes and tags.
- `InternTrackCalendar` — calendar events.
- `InternTrackSettings` — work hours, contact fields, notifications, and the quick note.
- `InternTrackAuth` — PIN salts, keyed hashes, failed-attempt counters, and lockout timestamps. Plain PINs are never stored.

The readable tabs are mirrors of `InternTrackData`; edit data through the app so the canonical and readable tabs stay aligned.

## 1. Create or upgrade the Google Sheets backend

1. Create or open the Google Sheet used by InternTrack.
2. Open **Extensions → Apps Script**.
3. Replace the existing `Code.gs` with `apps-script/Code.gs` from this project.
4. In Apps Script, open **Project Settings**, enable the manifest file, and replace `appsscript.json` with `apps-script/appsscript.json` if needed.
5. Run `setup()` once and approve spreadsheet access. This creates/rebuilds all readable tabs and the private `InternTrackAuth` tab.
6. Select **Deploy → Manage deployments**.
7. Edit the Web app deployment and choose **New version**.
8. Keep **Execute as** set to **Me** and **Who has access** set to **Anyone**.
9. Deploy and retain the URL ending in `/exec`.

## 2. Frontend connection

This package is already configured to use:

```text
https://script.google.com/macros/s/AKfycbxiaYVOslliEKT5hAMwDnaUZSfVT2EUXpMI507Dz0fveMV0nmwQTooGr1t9ulRPqgXi/exec
```

The endpoint is set in both `public/config.js` and the prebuilt `site/config.js`:

```js
window.INTERNTRACK_CONFIG = {
  syncEnabled: true,
  apiUrl: "https://script.google.com/macros/s/AKfycbxiaYVOslliEKT5hAMwDnaUZSfVT2EUXpMI507Dz0fveMV0nmwQTooGr1t9ulRPqgXi/exec",
  workspaceId: "interntrack-main",
  requestTimeoutMs: 12000
};
```

Use the same `workspaceId` on every laptop and phone that should share the same data.

## 3. Deploy to GitHub Pages

### GitHub Actions

1. Push this project folder to a GitHub repository.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` or `master`.

The included workflow installs dependencies, builds the project, and deploys `dist/`.

### Prebuilt site

Publish the contents of `site/` as the root of a static host. It already contains the compiled HTML, CSS, and JavaScript.

## Local development

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm run build
npm run preview
```

## Important behavior

- There is no offline mode.
- Refreshing or closing the page clears the temporary in-memory view; the next load comes from Google Sheets again.
- A PIN is required again after a refresh, explicit sign-out, backend cache eviction, or the six-hour session expiry.
- Existing profiles created before PIN authentication show **Create security PIN** once. The first successful claim secures that profile; deploy the new Apps Script version before publishing the updated frontend.
- Five consecutive incorrect PIN attempts lock that profile for 15 minutes.
- If a write cannot be confirmed, the app retries while that page remains open.
- Use the updated Apps Script backend. The previous backend does not create all readable tabs.

## Privacy note

The Apps Script deployment URL and workspace ID remain visible because the frontend is public. Access to profile data is enforced with backend PIN sessions, but a six-digit PIN is not a replacement for enterprise identity, audit, or compliance controls. Do not store regulated or highly sensitive information without stronger identity-based authentication.
