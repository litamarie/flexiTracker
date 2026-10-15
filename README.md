#flexiTracker (v1)

A simple offline Android-friendly PWA. No framework, account, backend, or external API.

## Defaults
- 07:00–15:00, 30-minute unpaid lunch
- Required work: 450 minutes (7 h 30 min) per weekday
- Missing past weekdays from your tracking start date: −450 min; today's missing hours count after 15:00
- Norwegian statutory holidays and weekends: no hours required
- Logged vacation and sick leave: 0 flex change; flex day off: −450 min; working on holidays/weekends earns time
- Bulk leave skips weekends and public holidays and requires confirmation before overwriting entries

## Run on your PC (VS Code)

Open this folder in VS Code. In a terminal run:
```sh
py -m http.server 8000
```

Visit http://localhost:8000 in Chrome. Don't just double-click `index.html` if you want to test PWA offline/install behavior.

## Install on Android

Host these **static files** on any HTTPS-enabled static hosting service, e.g. GitHub Pages (no always-on server). Open that HTTPS URL on your Android phone in Chrome, then use the browser menu **Install app** or **Add to Home screen**. Visit it once while online to cache the files. Afterwards, the installed app works without internet. Local development on a PC's `localhost` does not directly work from a phone across the LAN without HTTPS.

IMPORTANT: The data lives in the browser's local storage *on that device*, not on the hosted site or your PC. Export a JSON backup periodically. Private browsing, browser/site-data deletion, or reinstalling may remove it. GitHub Pages hosting makes the app code publicly accessible (not your locally stored entries).

## Files
- `index.html`: application markup
- `style.css`: design
- `app.js`: calendar, Norwegian holidays, flex calculations and data storage
- `sw.js`: offline caching
- `manifest.webmanifest`: installable app metadata
- `icon*.png`: Android app icons

## Limitations / next improvements
- Full-day leave only; partial leave, overtime multipliers and custom work schedules are not yet supported.
- Default working time and cutoff are global, not day-specific.
- Local storage is simple but not automatically synchronized or backed up to another device.
- If you change settings, historical balances are recalculated using the new daily target.
- Dates before the tracking start date are ignored in balance calculations; entries can still be logged for them.