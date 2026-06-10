# 🏋️ Workout Tracker

A clean, fast, **fully offline** workout tracking web app. No accounts, no backend, no build step — just open `index.html` and start logging. All your data lives in your browser's `localStorage`.

Built with plain **HTML, CSS, and vanilla JavaScript**. The only external dependency is [Chart.js](https://www.chartjs.org/) (loaded from a CDN, and the app degrades gracefully if you're offline).

---

## ✨ Features

### 📊 Dashboard
- **Rank hero card** — your current rank, XP, and an animated progress bar to the next tier
- **Today's Workout** — automatically surfaces the routine scheduled for today's weekday, with a shortcut to open it
- **Quick stats** — total workouts, workouts this week, current day streak, and weekly volume
- **Personal Records** — your best weight, estimated 1RM, and volume per exercise
- **Muscle group volume** — a weekly breakdown showing how your training is split across muscle groups
- **Progress chart** — track any exercise over time by Top Weight, Est. 1RM, or Volume

### 📝 Log Workout
- Supports **Strength**, **Cardio**, **Flexibility**, **Sports**, and **Other** categories
- Adaptive fields — sets/reps/weight for strength, duration/distance for cardio
- **"Last time" hint** — see your previous performance for an exercise as you type (progressive overload)
- **Live estimated 1RM** preview using the Epley formula
- **Exercise autocomplete** from your history
- **Quick-fill from a routine** to log faster

### 🗂️ Routines
- Build reusable workout templates (e.g. "Push Day", "Leg Day")
- Add exercises with target muscle group, sets, and **rep/weight ranges** — supports notations like `4-6`, `205-215 lb`, `BW + 25 lb`, and `80-90 lb stack`
- Tag each routine with a **muscle focus**, a **scheduled day** (drives "Today's Workout"), and a **cardio** finisher
- **Edit** any routine after creating it — change its name, metadata, or exercises and update in place
- **Log an entire routine for today** with one click (ranges fill in at their lower end as a starting point)
- **Quick-fill the Log form** from a routine to record set-by-set
- Save, view, edit, and delete routines
- Comes **pre-loaded with a 4-day split** on first run (delete or edit freely — it won't come back)

### 🗓️ Calendar
- **Monthly heatmap** — each day is shaded by how much volume you lifted (GitHub-contributions style)
- **Scheduled-day markers** — green dots mark weekdays that have a routine assigned
- **Month navigation** with a "Today" jump button
- **Monthly summary** — active days, total workouts, and total volume
- **Click any day** to see what you logged, plus any scheduled routine
- **Log a routine onto a specific date** — great for backfilling or planning ahead

### 📅 History
- All workouts grouped by date with per-day volume totals
- **Search** by exercise and **filter** by category
- **PR badges** on record-setting workouts
- **Export / Import** your data as JSON for backup or transfer between devices

### 🏅 Ranks
Earn XP and climb 9 tiers from **Rookie 🥚** to **Legend 👑**.

XP is earned from:
- **50 XP** per workout logged
- **1 XP** per 100 lbs of total volume lifted
- **30 XP** per unique exercise (rewards variety)

A celebration toast fires whenever you rank up.

---

## 🚀 Getting Started

No installation required for a quick look:

1. Download or clone this folder.
2. Open `index.html` in any modern web browser.
3. Start logging workouts!

---

## 📱 Install on your iPhone (offline app, no third-party host)

This is a **PWA** — it can be installed to your home screen and runs **fully offline**
(Chart.js is bundled locally and a service worker caches everything). To install it,
the page must be served over `http`/`localhost` once — opening a raw `file://` link
won't register the service worker. You don't need any external host; serve it from
your own machine or even from the phone itself.

**Option A — install from your computer (same Wi-Fi):**
1. In this folder, run a local server:
   ```bash
   python3 -m http.server 8000
   ```
2. Find your computer's local IP (e.g. `192.168.1.42`).
3. On the iPhone (same Wi-Fi), open Safari → `http://192.168.1.42:8000`.
4. Tap **Share → Add to Home Screen**. Done — open it from the icon; it now works
   offline, anywhere, no Wi-Fi needed.

**Option B — fully on-device (works anywhere, no computer):**
1. Install the free **a-Shell** app from the App Store.
2. Put this folder in a-Shell's directory, then run `python3 -m http.server 8000`.
3. In Safari open `http://localhost:8000` → **Share → Add to Home Screen**.

Once it's on your home screen, the server is no longer needed — the cached app
launches straight from the icon, offline.

> ⚠️ **Data is per-device.** Everything is stored in that phone's browser storage.
> Use **Export** (History tab) to back up, and **Import** to restore or move devices.
> If you want true sync across phone + computer, that requires a self-hosted backend
> (e.g. on a home machine reachable via Tailscale).

---

## 📁 Project Structure

```
website/
├── index.html             # Markup and app structure
├── styles.css             # All styling (dark theme, responsive, safe-area aware)
├── app.js                 # All app logic and state management
├── sw.js                  # Service worker (offline caching)
├── manifest.webmanifest   # PWA manifest (name, icons, theme)
├── chart.umd.min.js       # Vendored Chart.js (offline, no CDN)
├── icon-180/192/512.png   # App icons
├── make-icons.py          # Regenerates the icons (build helper, optional)
└── README.md              # You are here
```

> When you change `index.html`, `styles.css`, or `app.js`, bump the `CACHE` version
> string in `sw.js` so installed copies pick up the update.

---

## 💾 Data & Privacy

- **Everything stays on your device.** Workouts and routines are saved in `localStorage` under the keys `workouts_v1` and `routines_v1`.
- Nothing is ever sent to a server.
- Use **Export** (in the History tab) to back up your data, and **Import** to restore it or move it to another browser/device.
- Clearing your browser data will erase your workouts, so export regularly if your history matters to you.

---

## 🛠️ Tech Notes

- **Estimated 1RM** uses the Epley formula: `weight × (1 + reps / 30)`
- **Volume** is calculated as `sets × reps × weight`
- **Day streak** counts consecutive days with at least one logged workout
- The progress chart is rendered with **Chart.js 4**; if the CDN is unreachable, the rest of the app still works
- Fully **responsive** — works on desktop and mobile

---

## 🌱 Ideas for the Future

- Edit existing workouts (to backfill muscle groups on older entries)
- Supersets and per-set logging
- Body-weight and measurement tracking
- Dark/light theme toggle

---

Made for tracking gains. 💪
