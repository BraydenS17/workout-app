# 🏋️ Workout Tracker

A clean, fast, **fully offline** workout tracking web app. No accounts, no backend, no build step — just open `index.html` and start logging. All your data lives in your browser's `localStorage`.

Built with plain **HTML, CSS, and vanilla JavaScript**. The only external dependency is [Chart.js](https://www.chartjs.org/) (loaded from a CDN, and the app degrades gracefully if you're offline).

---

## ✨ Features

### 📊 Dashboard
- **Rank hero card** — your current rank, XP, and an animated progress bar to the next tier
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
- Add exercises with target muscle group, sets, reps, and weight
- **Log an entire routine for today** with one click
- Save, view, and delete routines

### 📅 History
- All workouts grouped by date with per-day volume totals
- **Search** by exercise and **filter** by category
- **PR badges** on record-setting workouts
- **Export / Import** your data as JSON for backup or transfer between devices

### ⏱️ Rest Timer
- Preset durations (1:00 / 1:30 / 2:00 / 3:00)
- Start / pause / resume / reset
- **Auto-starts** when you save a strength set
- Audible beep on completion (via the Web Audio API — no sound file needed)

### 🏅 Ranks
Earn XP and climb 9 tiers from **Rookie 🥚** to **Legend 👑**.

XP is earned from:
- **50 XP** per workout logged
- **1 XP** per 100 lbs of total volume lifted
- **30 XP** per unique exercise (rewards variety)

A celebration toast fires whenever you rank up.

---

## 🚀 Getting Started

No installation required.

1. Download or clone this folder.
2. Open `index.html` in any modern web browser.
3. Start logging workouts!

> 💡 To use it from anywhere, you can host the folder on any static site host (GitHub Pages, Netlify, Vercel, etc.) — there's no server-side code.

---

## 📁 Project Structure

```
website/
├── index.html    # Markup and app structure
├── styles.css    # All styling (dark theme, responsive)
├── app.js        # All app logic and state management
└── README.md     # You are here
```

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
