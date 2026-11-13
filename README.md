# Padel Americano – Version 1

A small mobile-first web app for recording a 5-player, 15-game padel Americano session.
Plain HTML, CSS and JavaScript. No backend, no database, no login, no dependencies, no external requests.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure, header, bottom navigation. |
| `styles.css` | All visual design (colors are variables at the top of the file). |
| `logic.js` | **Players, the 15-game schedule, scoring, ranking and local-storage code.** No screen code. To change names or the schedule, edit `PLAYERS` and `SCHEDULE` here. |
| `app.js` | The screens, buttons and navigation. |
| `tests.js` | Automated checks of the logic (`node tests.js`). Optional; not needed to run the app. |

## Run locally

Simplest: double-click `index.html`; it opens in your browser and works.

Alternative (closer to real hosting), from this folder:

    python3 -m http.server 8000

then open http://localhost:8000.

To run the tests (needs Node.js): `node tests.js`

## Deploy as a static site

Upload the folder's contents (everything except, optionally, `tests.js` and this README). No build step.

- **Netlify:** app.netlify.com/drop, then drag the folder onto the page.
- **GitHub Pages:** put the files in a repository, then Settings > Pages > deploy from the `main` branch, root folder.
- **Vercel:** import the repository (or run `vercel` in the folder); framework preset "Other", no build command, output directory = root.

Open the resulting link on the phone that will record results. Use the same link and the same browser each time (see below).

## How local storage is used

- One key, `padelAmericano.v1`, in the browser's local storage on the device.
- It stores only the saved results: `{ "version": 1, "results": { "A1": 6, "A2": 3, ... } }`, where each number is Pair A's score. Player totals are never stored; they are recalculated from the schedule and these results every time.
- It is written after every save, edit and reset. An unsaved score selection is not stored.
- On start the app reads it back, ignores anything missing, corrupted, from another version or invalid, and opens at the first unanswered game (or the final summary if all 15 are done).
- Data is per browser and per device. Private/incognito windows, clearing site data, or switching browser or domain starts a fresh session. If storage is blocked entirely, the app still works but shows a warning, and results are lost on refresh.

## Assumptions

- Ranking positions use standard competition ranking: two players tied for 1st are both "1" and the next is "3". Tied rows show a "tied" badge. Rows with identical points and wins are listed in player-list order only for display.
- Before any game is saved, standings show "–" instead of five tied positions.
- A "win" is a strictly higher pair score; 4–4 gives no wins.
- Editing a result never changes which games count as complete, and the current game stays the first unanswered one.
- The score buttons in the edit screen preselect the saved score.
- The Reset action is in the header, away from Save & Next, and requires confirmation.
- Single language (English); no PWA/offline install files in V1 (the app has no network dependencies, so after the first load it normally reopens from cache or the file itself).
