'use strict';

// ===== STORAGE =====
const STORAGE_KEY = 'workouts_v1';
const ROUTINES_KEY = 'routines_v1';

function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveWorkouts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function saveRoutines(list) {
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
}

let workouts = loadJSON(STORAGE_KEY);
let routines = loadJSON(ROUTINES_KEY);

// ===== METRIC HELPERS =====
// Estimated one-rep max (Epley formula): weight * (1 + reps/30)
function estimatedORM(w) {
  if (!w.weight || !w.reps) return 0;
  return Math.round(w.weight * (1 + w.reps / 30));
}

// Total volume for a single entry: sets * reps * weight
function entryVolume(w) {
  if (!w.sets || !w.reps || !w.weight) return 0;
  return w.sets * w.reps * w.weight;
}

function isStrength(w) {
  return w.weight != null && w.reps != null;
}

// ===== RANKS =====
// XP is earned from logging workouts, total volume lifted, and exercise variety.
const RANKS = [
  { name: 'Rookie',     icon: '🥚', min: 0,     color: '#9ca3af', glow: 'rgba(156,163,175,0.18)' },
  { name: 'Novice',     icon: '🐣', min: 500,   color: '#84cc16', glow: 'rgba(132,204,22,0.18)' },
  { name: 'Apprentice', icon: '💪', min: 1500,  color: '#22c55e', glow: 'rgba(34,197,94,0.18)' },
  { name: 'Warrior',    icon: '⚔️', min: 3500,  color: '#3b82f6', glow: 'rgba(59,130,246,0.20)' },
  { name: 'Gladiator',  icon: '🛡️', min: 7000,  color: '#6c63ff', glow: 'rgba(108,99,255,0.22)' },
  { name: 'Beast',      icon: '🦍', min: 12000, color: '#a855f7', glow: 'rgba(168,85,247,0.22)' },
  { name: 'Champion',   icon: '🏆', min: 20000, color: '#ec4899', glow: 'rgba(236,72,153,0.22)' },
  { name: 'Titan',      icon: '🔱', min: 32000, color: '#f59e0b', glow: 'rgba(245,158,11,0.24)' },
  { name: 'Legend',     icon: '👑', min: 50000, color: '#fbbf24', glow: 'rgba(251,191,36,0.28)' },
];

// XP = 50 per workout + 1 per 100 lbs total volume + 30 per unique exercise
function computeXP(list) {
  const workoutXP = list.length * 50;
  const totalVolume = list.reduce((sum, w) => sum + entryVolume(w), 0);
  const volumeXP = Math.floor(totalVolume / 100);
  const varietyXP = new Set(list.map(w => w.exercise.toLowerCase())).size * 30;
  return workoutXP + volumeXP + varietyXP;
}

// Returns { rank, index, next, xp, progress } for a given XP total
function getRankInfo(xp) {
  let index = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) { index = i; break; }
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  const progress = next
    ? (xp - rank.min) / (next.min - rank.min)
    : 1;
  return { rank, index, next, xp, progress };
}

// ===== NAVIGATION =====
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

function showView(name) {
  views.forEach(v => v.classList.remove('active'));
  navBtns.forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'routines') renderRoutines();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ===== FORM LOGIC =====
const form = document.getElementById('workout-form');
const categorySelect = document.getElementById('workout-category');
const strengthFields = document.getElementById('strength-fields');
const cardioFields = document.getElementById('cardio-fields');
const successMsg = document.getElementById('form-success');
const exerciseInput = document.getElementById('workout-exercise');
const setsInput = document.getElementById('workout-sets');
const repsInput = document.getElementById('workout-reps');
const weightInput = document.getElementById('workout-weight');

document.getElementById('workout-date').valueAsDate = new Date();

categorySelect.addEventListener('change', () => {
  const isCardio = categorySelect.value === 'Cardio';
  strengthFields.classList.toggle('hidden', isCardio);
  cardioFields.classList.toggle('hidden', !isCardio);
  updateLastTimePanel();
});

// Live "last time" hint + est 1RM preview
exerciseInput.addEventListener('input', updateLastTimePanel);
[setsInput, repsInput, weightInput].forEach(el =>
  el.addEventListener('input', updateOrmHint));

function updateLastTimePanel() {
  const panel = document.getElementById('last-time-panel');
  const content = document.getElementById('last-time-content');
  const name = exerciseInput.value.trim().toLowerCase();

  if (!name) { panel.classList.add('hidden'); return; }

  const prev = workouts.find(w => w.exercise.toLowerCase() === name);
  if (!prev) { panel.classList.add('hidden'); return; }

  const stats = buildStatsStr(prev);
  content.innerHTML = `${stats || 'logged'} &mdash; ${formatDateLabel(prev.date)}`;
  panel.classList.remove('hidden');
}

function updateOrmHint() {
  const hint = document.getElementById('est-orm-hint');
  const reps = parseInt(repsInput.value);
  const weight = parseFloat(weightInput.value);
  if (reps && weight) {
    const orm = Math.round(weight * (1 + reps / 30));
    hint.innerHTML = `Estimated 1-rep max: <strong>${orm} lbs</strong>`;
    hint.classList.remove('hidden');
  } else {
    hint.classList.add('hidden');
  }
}

document.getElementById('clear-form-btn').addEventListener('click', resetForm);

function resetForm() {
  form.reset();
  document.getElementById('workout-date').valueAsDate = new Date();
  strengthFields.classList.remove('hidden');
  cardioFields.classList.add('hidden');
  successMsg.classList.add('hidden');
  document.getElementById('last-time-panel').classList.add('hidden');
  document.getElementById('est-orm-hint').classList.add('hidden');
}

// Fill the log form with an exercise's defaults (from a routine)
function fillFormFromExercise(ex) {
  categorySelect.value = 'Strength';
  strengthFields.classList.remove('hidden');
  cardioFields.classList.add('hidden');
  exerciseInput.value = ex.exercise || '';
  document.getElementById('workout-muscle').value = ex.muscle || '';
  setsInput.value   = ex.sets   || '';
  repsInput.value   = ex.reps   || '';
  weightInput.value = ex.weight || '';
  updateLastTimePanel();
  updateOrmHint();
  exerciseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Routine quick-fill dropdown on the log form
const routineLoader = document.getElementById('routine-loader');
routineLoader.addEventListener('change', () => {
  const idx = routineLoader.value;
  if (idx === '') return;
  const routine = routines[parseInt(idx)];
  if (routine && routine.exercises.length) {
    fillFormFromExercise(routine.exercises[0]);
    if (routine.exercises.length > 1) {
      successMsg.textContent = `Loaded "${routine.name}" — first of ${routine.exercises.length} exercises. Save, then pick the next.`;
      successMsg.classList.remove('hidden');
      setTimeout(() => successMsg.classList.add('hidden'), 4000);
    }
  }
  routineLoader.value = '';
});

function updateRoutineLoader() {
  routineLoader.innerHTML = '<option value="">-- None --</option>' +
    routines.map((r, i) => `<option value="${i}">${escHtml(r.name)}</option>`).join('');
}

form.addEventListener('submit', e => {
  e.preventDefault();

  const category = categorySelect.value;
  const isCardio = category === 'Cardio';

  const entry = {
    id: Date.now(),
    date: document.getElementById('workout-date').value,
    category,
    exercise: exerciseInput.value.trim(),
    notes: document.getElementById('workout-notes').value.trim(),
  };

  if (isCardio) {
    entry.duration = parseFloat(document.getElementById('workout-duration').value) || null;
    entry.distance = parseFloat(document.getElementById('workout-distance').value) || null;
  } else {
    entry.sets   = parseInt(setsInput.value)   || null;
    entry.reps   = parseInt(repsInput.value)   || null;
    entry.weight = parseFloat(weightInput.value) || null;
    entry.muscle = document.getElementById('workout-muscle').value || null;
  }

  // Detect PRs BEFORE inserting the new entry
  const prs = detectPRs(entry);

  // Capture rank before saving so we can detect a rank-up
  const oldRankIndex = getRankInfo(computeXP(workouts)).index;

  workouts.unshift(entry);
  saveWorkouts(workouts);
  updateExerciseSuggestions();

  const newInfo = getRankInfo(computeXP(workouts));
  const rankedUp = newInfo.index > oldRankIndex;

  // Feedback — rank-up takes priority over PR in the toast
  if (rankedUp) {
    showRankToast(newInfo.rank);
    successMsg.textContent = `Workout saved — ranked up to ${newInfo.rank.name}! ${newInfo.rank.icon}`;
  } else if (prs.length) {
    showPRToast(prs);
    successMsg.textContent = `Workout saved — ${prs.length} new PR${prs.length > 1 ? 's' : ''}! 🏆`;
  } else {
    successMsg.textContent = 'Workout saved!';
  }
  successMsg.classList.remove('hidden');
  setTimeout(() => successMsg.classList.add('hidden'), 2800);

  // Auto-start rest timer for strength sets
  if (!isCardio && entry.weight) startTimer(timerDuration);

  resetForm();
});

// ===== PR DETECTION =====
// Returns array of human-readable PR descriptions for the new entry,
// comparing against all PRIOR entries of the same exercise.
function detectPRs(entry) {
  if (!isStrength(entry)) return [];
  const name = entry.exercise.toLowerCase();
  const prior = workouts.filter(w => w.exercise.toLowerCase() === name && isStrength(w));

  const prs = [];
  const bestWeight = Math.max(0, ...prior.map(w => w.weight || 0));
  const bestOrm    = Math.max(0, ...prior.map(estimatedORM));
  const bestVol    = Math.max(0, ...prior.map(entryVolume));

  if (entry.weight > bestWeight)       prs.push(`Heaviest ${entry.exercise}: ${entry.weight} lbs`);
  if (estimatedORM(entry) > bestOrm)   prs.push(`Best est. 1RM: ${estimatedORM(entry)} lbs`);
  if (entryVolume(entry) > bestVol)    prs.push(`Most volume: ${entryVolume(entry).toLocaleString()} lbs`);
  return prs;
}

function showPRToast(prs) {
  const toast = document.getElementById('pr-toast');
  toast.innerHTML = `🏆 New PR! ${prs[0]}`;
  toast.classList.remove('hidden');
  // force reflow so transition fires
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3500);
}

// Was this entry a PR at the time it was logged? (for badges in lists)
function wasPR(entry) {
  if (!isStrength(entry)) return false;
  const name = entry.exercise.toLowerCase();
  const prior = workouts.filter(w =>
    w.exercise.toLowerCase() === name && isStrength(w) && w.id < entry.id);
  const bestWeight = Math.max(0, ...prior.map(w => w.weight || 0));
  const bestOrm    = Math.max(0, ...prior.map(estimatedORM));
  return entry.weight > bestWeight || estimatedORM(entry) > bestOrm;
}

// ===== EXERCISE AUTOCOMPLETE =====
function updateExerciseSuggestions() {
  const datalist = document.getElementById('exercise-suggestions');
  const unique = [...new Set(workouts.map(w => w.exercise))];
  datalist.innerHTML = unique.map(e => `<option value="${escHtml(e)}">`).join('');

  const progressSelect = document.getElementById('progress-exercise-select');
  const current = progressSelect.value;
  progressSelect.innerHTML = '<option value="">-- Select an exercise --</option>' +
    unique.map(e => `<option value="${escHtml(e)}" ${e === current ? 'selected' : ''}>${escHtml(e)}</option>`).join('');
}

// ===== DASHBOARD =====
function renderDashboard() {
  renderRank();
  renderStats();
  renderPRs();
  renderMuscleVolume();
  renderRecent();
  updateExerciseSuggestions();
  renderProgressChart();
}

// Rank hero + header chip
function renderRank() {
  const info = getRankInfo(computeXP(workouts));
  const { rank, next, xp, progress } = info;

  // Header chip
  document.getElementById('rank-chip-icon').textContent = rank.icon;
  document.getElementById('rank-chip-name').textContent = rank.name;
  document.getElementById('rank-chip-name').style.color = rank.color;
  document.getElementById('rank-chip').style.borderColor = rank.color;

  // Hero card
  const hero = document.getElementById('rank-hero');
  hero.style.setProperty('--rank-color', rank.color);
  hero.style.setProperty('--rank-glow', rank.glow);
  hero.style.borderColor = rank.color;

  document.getElementById('rank-hero-icon').textContent = rank.icon;
  document.getElementById('rank-hero-name').textContent = rank.name;
  document.getElementById('rank-hero-xp').textContent = `${xp.toLocaleString()} XP`;
  document.getElementById('rank-progress-fill').style.width = `${Math.round(progress * 100)}%`;

  const nextEl = document.getElementById('rank-hero-next');
  if (next) {
    const remaining = (next.min - xp).toLocaleString();
    nextEl.innerHTML = `<strong>${remaining} XP</strong> to <strong>${next.icon} ${next.name}</strong>`;
  } else {
    nextEl.innerHTML = `Max rank reached — you're a <strong>${rank.name}</strong>! 👑`;
  }
}

function showRankToast(rank) {
  const toast = document.getElementById('pr-toast');
  toast.innerHTML = `${rank.icon} Rank up! You're now a <strong>${rank.name}</strong>`;
  toast.style.background = `linear-gradient(135deg, ${rank.color}, #a78bfa)`;
  toast.classList.remove('hidden');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.background = ''; // restore default gold for PR toasts
    }, 300);
  }, 4000);
}

// Weekly volume split per muscle group, as proportional bars
function renderMuscleVolume() {
  const container = document.getElementById('muscle-volume');

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const totals = {};
  workouts
    .filter(w => w.muscle && new Date(w.date + 'T00:00:00') >= startOfWeek)
    .forEach(w => {
      const vol = entryVolume(w);
      if (vol) totals[w.muscle] = (totals[w.muscle] || 0) + vol;
    });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    container.innerHTML = '<p class="empty-msg">Tag exercises with a muscle group to see your weekly split.</p>';
    return;
  }

  const max = entries[0][1];
  container.innerHTML = entries.map(([muscle, vol]) => `
    <div class="muscle-row">
      <span class="muscle-name">${escHtml(muscle)}</span>
      <div class="muscle-bar-track">
        <div class="muscle-bar-fill" style="width:${Math.round((vol / max) * 100)}%"></div>
      </div>
      <span class="muscle-val">${Math.round(vol).toLocaleString()} lbs</span>
    </div>`).join('');
}

function renderStats() {
  document.getElementById('stat-total').textContent = workouts.length;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekWorkouts = workouts.filter(w => new Date(w.date + 'T00:00:00') >= startOfWeek);
  document.getElementById('stat-week').textContent = weekWorkouts.length;

  const weekVolume = weekWorkouts.reduce((sum, w) => sum + entryVolume(w), 0);
  document.getElementById('stat-volume').textContent = Math.round(weekVolume).toLocaleString();

  document.getElementById('stat-streak').textContent = calcStreak();
}

function calcStreak() {
  if (!workouts.length) return 0;
  const days = [...new Set(workouts.map(w => w.date))].sort((a, b) => b.localeCompare(a));
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// Personal records grid — best per strength exercise
function renderPRs() {
  const container = document.getElementById('pr-list');
  const strengthEntries = workouts.filter(isStrength);

  if (!strengthEntries.length) {
    container.innerHTML = '<p class="empty-msg">Log some strength workouts to set records!</p>';
    return;
  }

  const byExercise = {};
  strengthEntries.forEach(w => {
    const key = w.exercise.toLowerCase();
    if (!byExercise[key]) {
      byExercise[key] = { name: w.exercise, weight: 0, orm: 0, volume: 0 };
    }
    const rec = byExercise[key];
    rec.weight = Math.max(rec.weight, w.weight || 0);
    rec.orm    = Math.max(rec.orm, estimatedORM(w));
    rec.volume = Math.max(rec.volume, entryVolume(w));
  });

  const records = Object.values(byExercise)
    .sort((a, b) => b.orm - a.orm)
    .slice(0, 8);

  container.innerHTML = records.map(r => `
    <div class="pr-card">
      <div class="pr-exercise">${escHtml(r.name)}</div>
      <div class="pr-stats">
        <div class="pr-stat"><span class="pr-stat-label">Top weight</span><span class="pr-stat-val">${r.weight} lbs</span></div>
        <div class="pr-stat"><span class="pr-stat-label">Est. 1RM</span><span class="pr-stat-val">${r.orm} lbs</span></div>
        <div class="pr-stat"><span class="pr-stat-label">Best volume</span><span class="pr-stat-val">${r.volume.toLocaleString()} lbs</span></div>
      </div>
    </div>`).join('');
}

function renderRecent() {
  const container = document.getElementById('recent-list');
  const recent = workouts.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = '<p class="empty-msg">No workouts yet. Start logging!</p>';
    return;
  }
  container.innerHTML = recent.map(w => workoutCardHTML(w)).join('');
  attachDeleteListeners(container);
}

// ===== HISTORY =====
const historySearch = document.getElementById('history-search');
const historyCatFilter = document.getElementById('history-category-filter');

historySearch.addEventListener('input', renderHistory);
historyCatFilter.addEventListener('change', renderHistory);

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (workouts.length === 0) return;
  if (confirm('Delete ALL workout history? This cannot be undone.')) {
    workouts = [];
    saveWorkouts(workouts);
    renderHistory();
  }
});

// Export / Import
document.getElementById('export-btn').addEventListener('click', () => {
  if (!workouts.length) { alert('Nothing to export yet.'); return; }
  const blob = new Blob([JSON.stringify(workouts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workouts-${toDateStr(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-btn').addEventListener('click', () =>
  document.getElementById('import-file').click());

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      if (confirm(`Import ${imported.length} workouts? This replaces current data.`)) {
        workouts = imported;
        saveWorkouts(workouts);
        renderHistory();
      }
    } catch {
      alert('Could not import — file is not valid workout data.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function renderHistory() {
  const container = document.getElementById('history-list');
  const query = historySearch.value.toLowerCase();
  const cat = historyCatFilter.value;

  const filtered = workouts.filter(w => {
    const matchQuery = !query || w.exercise.toLowerCase().includes(query);
    const matchCat = !cat || w.category === cat;
    return matchQuery && matchCat;
  });

  if (!filtered.length) {
    container.innerHTML = '<p class="empty-msg">No workouts match your filters.</p>';
    return;
  }

  const byDate = {};
  filtered.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  container.innerHTML = sortedDates.map(date => {
    const dayVol = byDate[date].reduce((s, w) => s + entryVolume(w), 0);
    const volStr = dayVol ? `<span class="day-volume">${Math.round(dayVol).toLocaleString()} lbs volume</span>` : '';
    return `
      <div class="history-day-group">
        <div class="history-day-label">
          <span>${formatDateLabel(date)} &mdash; ${byDate[date].length} workout${byDate[date].length > 1 ? 's' : ''}</span>
          ${volStr}
        </div>
        ${byDate[date].map(w => workoutCardHTML(w)).join('')}
      </div>`;
  }).join('');

  attachDeleteListeners(container);
}

// ===== CARD HTML =====
function workoutCardHTML(w) {
  const badgeClass = `badge-${w.category.toLowerCase()}`;
  const statsStr = buildStatsStr(w);
  const prBadge = wasPR(w) ? '<span class="pr-flag">PR</span>' : '';

  return `
    <div class="workout-card" data-id="${w.id}">
      <div class="card-left">
        <div class="card-exercise">${escHtml(w.exercise)} ${prBadge}</div>
        <div class="card-meta">
          <span class="card-badge ${badgeClass}">${escHtml(w.category)}</span>
        </div>
        ${statsStr ? `<div class="card-stats">${statsStr}</div>` : ''}
        ${w.notes ? `<div class="card-notes">${escHtml(w.notes)}</div>` : ''}
      </div>
      <div class="card-right">
        <span class="card-date">${formatDateLabel(w.date)}</span>
        <button class="btn-delete" data-id="${w.id}" title="Delete">&#10005;</button>
      </div>
    </div>`;
}

function buildStatsStr(w) {
  const parts = [];
  if (w.sets)     parts.push(`${w.sets} sets`);
  if (w.reps)     parts.push(`${w.reps} reps`);
  if (w.weight)   parts.push(`${w.weight} lbs`);
  if (w.duration) parts.push(`${w.duration} min`);
  if (w.distance) parts.push(`${w.distance} mi`);
  if (isStrength(w)) parts.push(`1RM ~${estimatedORM(w)}`);
  return parts.join(' &bull; ');
}

function attachDeleteListeners(container) {
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      workouts = workouts.filter(w => w.id !== id);
      saveWorkouts(workouts);
      updateExerciseSuggestions();
      if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
      if (document.getElementById('view-history').classList.contains('active')) renderHistory();
    });
  });
}

// ===== PROGRESS CHART =====
let chartInstance = null;
let currentMetric = 'weight';

document.getElementById('progress-exercise-select').addEventListener('change', renderProgressChart);
document.querySelectorAll('.metric-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMetric = btn.dataset.metric;
    renderProgressChart();
  });
});

function renderProgressChart() {
  const exercise = document.getElementById('progress-exercise-select').value;
  const emptyMsg = document.getElementById('progress-empty');
  const canvas = document.getElementById('progress-chart');

  if (!exercise || !window.Chart) {
    emptyMsg.classList.remove('hidden');
    canvas.classList.add('hidden');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const entries = workouts
    .filter(w => w.exercise.toLowerCase() === exercise.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date));

  emptyMsg.classList.add('hidden');
  canvas.classList.remove('hidden');

  const labels = entries.map(w => formatDateLabel(w.date));

  let data, dataLabel;
  if (currentMetric === 'orm') {
    data = entries.map(w => estimatedORM(w) || (w.distance || w.duration || 0));
    dataLabel = 'Estimated 1RM (lbs)';
  } else if (currentMetric === 'volume') {
    data = entries.map(w => entryVolume(w) || (w.distance || w.duration || 0));
    dataLabel = 'Volume (lbs)';
  } else {
    data = entries.map(w => w.weight || w.distance || w.duration || 0);
    dataLabel = 'Top Weight (lbs)';
  }

  if (chartInstance) chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: dataLabel,
        data,
        borderColor: '#6c63ff',
        backgroundColor: 'rgba(108,99,255,0.12)',
        pointBackgroundColor: '#6c63ff',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e8e8f0', font: { size: 12 } } },
        tooltip: {
          backgroundColor: '#1a1a24',
          borderColor: '#2e2e40',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#a78bfa',
          padding: 10,
        }
      },
      scales: {
        x: {
          ticks: { color: '#8888a8', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#8888a8', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: false,
        }
      }
    }
  });
}

// ===== REST TIMER =====
let timerDuration = 90;   // default seconds
let timerRemaining = 0;
let timerInterval = null;
let timerRunning = false;

const timerDisplay = document.getElementById('timer-display');
const timerToggle = document.getElementById('timer-toggle');

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timerDuration = parseInt(btn.dataset.sec);
    startTimer(timerDuration);
  });
});

timerToggle.addEventListener('click', () => {
  if (timerRunning) pauseTimer();
  else if (timerRemaining > 0) resumeTimer();
  else startTimer(timerDuration);
});

document.getElementById('timer-reset').addEventListener('click', resetTimer);

function startTimer(seconds) {
  clearInterval(timerInterval);
  timerRemaining = seconds;
  timerRunning = true;
  timerDisplay.classList.add('running');
  timerDisplay.classList.remove('done');
  timerToggle.textContent = 'Pause';
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
}

function resumeTimer() {
  timerRunning = true;
  timerToggle.textContent = 'Pause';
  timerDisplay.classList.add('running');
  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerToggle.textContent = 'Resume';
  timerDisplay.classList.remove('running');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = 0;
  timerToggle.textContent = 'Start';
  timerDisplay.classList.remove('running', 'done');
  updateTimerDisplay();
}

function tick() {
  timerRemaining--;
  updateTimerDisplay();
  if (timerRemaining <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerToggle.textContent = 'Start';
    timerDisplay.classList.remove('running');
    timerDisplay.classList.add('done');
    notifyTimerDone();
  }
}

function updateTimerDisplay() {
  const m = Math.floor(Math.max(0, timerRemaining) / 60);
  const s = Math.max(0, timerRemaining) % 60;
  timerDisplay.textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function notifyTimerDone() {
  // Audible beep via Web Audio API (no external file needed)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  } catch { /* audio not available */ }
}

// ===== ROUTINES =====
let routineDraft = [];   // exercises being added in the builder

const rbExercise = document.getElementById('rb-exercise');
const rbMuscle = document.getElementById('rb-muscle');
const rbSets = document.getElementById('rb-sets');
const rbReps = document.getElementById('rb-reps');
const rbWeight = document.getElementById('rb-weight');

document.getElementById('rb-add-btn').addEventListener('click', () => {
  const name = rbExercise.value.trim();
  if (!name) { rbExercise.focus(); return; }
  routineDraft.push({
    exercise: name,
    muscle: rbMuscle.value || null,
    sets:   parseInt(rbSets.value)   || null,
    reps:   parseInt(rbReps.value)   || null,
    weight: parseFloat(rbWeight.value) || null,
  });
  rbExercise.value = '';
  rbMuscle.value = '';
  rbSets.value = '';
  rbReps.value = '';
  rbWeight.value = '';
  rbExercise.focus();
  renderRoutineDraft();
});

function renderRoutineDraft() {
  const list = document.getElementById('rb-list');
  if (!routineDraft.length) { list.innerHTML = ''; return; }
  list.innerHTML = routineDraft.map((ex, i) => {
    const detail = [
      ex.muscle,
      ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null,
      ex.weight ? `${ex.weight} lbs` : null,
    ].filter(Boolean).join(' • ');
    return `
      <li class="rb-item">
        <span><span class="rb-item-name">${escHtml(ex.exercise)}</span>
        ${detail ? `<span class="rb-item-detail"> — ${escHtml(detail)}</span>` : ''}</span>
        <button class="rb-item-remove" data-i="${i}" title="Remove">&times;</button>
      </li>`;
  }).join('');
  list.querySelectorAll('.rb-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      routineDraft.splice(parseInt(btn.dataset.i), 1);
      renderRoutineDraft();
    });
  });
}

document.getElementById('rb-clear-btn').addEventListener('click', () => {
  routineDraft = [];
  document.getElementById('routine-name').value = '';
  renderRoutineDraft();
});

document.getElementById('rb-save-btn').addEventListener('click', () => {
  const name = document.getElementById('routine-name').value.trim();
  if (!name) { alert('Give your routine a name first.'); return; }
  if (!routineDraft.length) { alert('Add at least one exercise.'); return; }
  routines.push({ id: Date.now(), name, exercises: routineDraft.slice() });
  saveRoutines(routines);
  routineDraft = [];
  document.getElementById('routine-name').value = '';
  renderRoutineDraft();
  renderRoutines();
  updateRoutineLoader();
});

function renderRoutines() {
  updateRoutineLoader();
  const container = document.getElementById('routines-list');
  if (!routines.length) {
    container.innerHTML = '<p class="empty-msg">No routines yet. Build one to get started!</p>';
    return;
  }
  container.innerHTML = routines.map(r => `
    <div class="routine-card" data-id="${r.id}">
      <div class="routine-card-head">
        <span class="routine-card-title">${escHtml(r.name)}</span>
        <span class="routine-card-count">${r.exercises.length} exercise${r.exercises.length > 1 ? 's' : ''}</span>
      </div>
      <ul class="routine-exercises">
        ${r.exercises.map(ex => {
          const d = [ex.muscle, ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null, ex.weight ? `${ex.weight} lbs` : null]
            .filter(Boolean).join(' • ');
          return `<li><span class="re-name">${escHtml(ex.exercise)}</span><span>${escHtml(d)}</span></li>`;
        }).join('')}
      </ul>
      <div class="routine-card-actions">
        <button class="btn-primary routine-log-btn" data-id="${r.id}">Log Today</button>
        <button class="btn-danger routine-del-btn" data-id="${r.id}">Delete</button>
      </div>
    </div>`).join('');

  // Log entire routine for today
  container.querySelectorAll('.routine-log-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const routine = routines.find(r => r.id === parseInt(btn.dataset.id));
      if (!routine) return;
      if (!confirm(`Log all ${routine.exercises.length} exercises from "${routine.name}" for today?`)) return;
      const today = toDateStr(new Date());
      let base = Date.now();
      routine.exercises.forEach((ex, i) => {
        workouts.unshift({
          id: base + i,
          date: today,
          category: 'Strength',
          exercise: ex.exercise,
          muscle: ex.muscle || null,
          sets: ex.sets || null,
          reps: ex.reps || null,
          weight: ex.weight || null,
          notes: `From routine: ${routine.name}`,
        });
      });
      saveWorkouts(workouts);
      updateExerciseSuggestions();
      alert(`Logged ${routine.exercises.length} exercises! 💪`);
    });
  });

  // Delete routine
  container.querySelectorAll('.routine-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const routine = routines.find(r => r.id === id);
      if (routine && confirm(`Delete routine "${routine.name}"?`)) {
        routines = routines.filter(r => r.id !== id);
        saveRoutines(routines);
        renderRoutines();
        updateRoutineLoader();
      }
    });
  });
}

// ===== HELPERS =====
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== CHART.JS CDN LOADER =====
function loadChartJS(callback) {
  if (window.Chart) { callback(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  script.onload = callback;
  script.onerror = () => callback(); // degrade gracefully if offline
  document.head.appendChild(script);
}

// ===== INIT =====
updateTimerDisplay();
updateRoutineLoader();
loadChartJS(() => {
  updateExerciseSuggestions();
  renderDashboard();
});
