# flexiTracker v1

A simple offline Android-friendly PWA. 
No framework, account, backend, or external API.

## Defaults
- Changeable default working hours, now set to 07:00–15:00, with a 30-minute unpaid lunch, required work 7.5 per weekday
- Todays missing hours count after 15:00
- Norwegian holidays and weekends: no hours required
- Logged vacation and sick leave: 0 flex change
- Flex day off: −450 min
- Working on holidays/weekends earns time. If it should be overtime - don't log it!
- Bulk leave skips weekends and public holidays

## Run on PC
Open this folder in VS Code. In a terminal run:
```sh
py -m http.server 8000
```
Visit http://localhost:8000 in browser.

## Install on Android

The installed app works without internet.  
**IMPORTANT:** The data lives in the browser's local storage *on local device*, not on the hosted site or PC. JSON export is available. Private browsing, browser/site-data deletion, or reinstalling may remove data.

## Files
- `index.html`: application markup
- `style.css`: design
- `app.js`: calendar, Holidays, flex calculations and data storage
- `sw.js`: offline caching
- `manifest.webmanifest`: installable app metadata
- `icon*.png`: Android app icons

## Limitations / next improvements
- Full-day leave only; partial leave, overtime multipliers and custom work schedules are not supported.
- Default working time and cutoff are global, not day-specific.
- Local storage is simple but not synchronized or backed up to another device.
- If you change settings, historical balances are recalculated using the new daily target.
- Dates before the tracking start date are ignored in balance calculations; entries can still be logged for them.
- Files/functions should be more separated, some cleaning is needed.

## Update 1.0.1, 19.10
Manual input for times in addition to clock. Able to save arrival time before leaving for the day.