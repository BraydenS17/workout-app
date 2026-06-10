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
  if (name === 'calendar') renderCalendar();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    closeSidebar();          // collapse the drawer after choosing a tab on mobile
  });
});

// ===== SIDEBAR (mobile drawer) =====
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('show');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('show');
}

document.getElementById('sidebar-toggle').addEventListener('click', openSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

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
  setsInput.value   = ex.sets || '';
  repsInput.value   = parseFirstNumber(ex.reps)   ?? '';
  weightInput.value = parseFirstNumber(ex.weight) ?? '';
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
  renderTodayWorkout();
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

  // Sidebar chip
  document.getElementById('rank-chip-icon').textContent = rank.icon;
  document.getElementById('rank-chip-name').textContent = rank.name;
  document.getElementById('rank-chip-name').style.color = rank.color;
  document.getElementById('rank-chip').style.borderColor = rank.color;

  // Mobile top-bar chip (icon only)
  const mIcon = document.getElementById('rank-chip-icon-mobile');
  const mChip = document.getElementById('rank-chip-mobile');
  if (mIcon) mIcon.textContent = rank.icon;
  if (mChip) mChip.style.borderColor = rank.color;

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
      if (document.getElementById('view-calendar').classList.contains('active')) renderCalendar();
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

// ===== ROUTINES =====
let routineDraft = [];        // exercises being added in the builder
let editingRoutineId = null;  // id of the routine being edited (null = creating new)

const rbHeading = document.getElementById('rb-heading');
const rbSaveBtn = document.getElementById('rb-save-btn');
const rbFocus = document.getElementById('routine-focus');
const rbDay = document.getElementById('routine-day');
const rbCardio = document.getElementById('routine-cardio');
const rbExercise = document.getElementById('rb-exercise');
const rbMuscle = document.getElementById('rb-muscle');
const rbSets = document.getElementById('rb-sets');
const rbReps = document.getElementById('rb-reps');
const rbWeight = document.getElementById('rb-weight');

// Build a "sets × reps @ weight" string from a routine exercise (handles ranges)
function prescriptionStr(ex) {
  const setsReps = ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : (ex.reps || (ex.sets ? `${ex.sets} sets` : ''));
  const wt = ex.weight ? ` @ ${ex.weight}` : '';
  return (setsReps + wt).trim();
}

document.getElementById('rb-add-btn').addEventListener('click', () => {
  const name = rbExercise.value.trim();
  if (!name) { rbExercise.focus(); return; }
  routineDraft.push({
    exercise: name,
    muscle: rbMuscle.value || null,
    sets:   parseInt(rbSets.value) || null,
    reps:   rbReps.value.trim()    || null,   // string: supports ranges like "4-6"
    weight: rbWeight.value.trim()  || null,   // string: supports "205-215 lb", "BW + 25 lb"
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
    const detail = [ex.muscle, prescriptionStr(ex)].filter(Boolean).join(' • ');
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

document.getElementById('rb-clear-btn').addEventListener('click', exitEditMode);

rbSaveBtn.addEventListener('click', () => {
  const name = document.getElementById('routine-name').value.trim();
  if (!name) { alert('Give your routine a name first.'); return; }
  if (!routineDraft.length) { alert('Add at least one exercise.'); return; }

  const meta = {
    name,
    focus: rbFocus.value.trim() || null,
    day: rbDay.value || null,
    cardio: rbCardio.value.trim() || null,
    exercises: routineDraft.slice(),
  };

  if (editingRoutineId !== null) {
    // Update the existing routine in place
    const routine = routines.find(r => r.id === editingRoutineId);
    if (routine) Object.assign(routine, meta);
  } else {
    // Create a new routine
    routines.push({ id: Date.now(), ...meta });
  }

  saveRoutines(routines);
  exitEditMode();
  renderRoutines();
  updateRoutineLoader();
});

// Load a routine into the builder for editing
function enterEditMode(routine) {
  editingRoutineId = routine.id;
  routineDraft = routine.exercises.map(ex => ({ ...ex }));
  document.getElementById('routine-name').value = routine.name;
  rbFocus.value = routine.focus || '';
  rbDay.value = routine.day || '';
  rbCardio.value = routine.cardio || '';
  rbHeading.textContent = `Editing: ${routine.name}`;
  rbSaveBtn.textContent = 'Update Routine';
  renderRoutineDraft();
  rbHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reset the builder back to "create new" state
function exitEditMode() {
  editingRoutineId = null;
  routineDraft = [];
  document.getElementById('routine-name').value = '';
  rbFocus.value = '';
  rbDay.value = '';
  rbCardio.value = '';
  rbHeading.textContent = 'Build a Routine';
  rbSaveBtn.textContent = 'Save Routine';
  renderRoutineDraft();
}

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
        <span class="routine-card-title">
          ${r.day ? `<span class="routine-day-badge">${escHtml(r.day)}</span>` : ''}
          ${escHtml(r.name)}
        </span>
        <span class="routine-card-count">${r.exercises.length} exercise${r.exercises.length > 1 ? 's' : ''}</span>
      </div>
      ${r.focus ? `<div class="routine-focus">${escHtml(r.focus)}</div>` : ''}
      <ul class="routine-exercises">
        ${r.exercises.map(ex => {
          const d = prescriptionStr(ex);
          return `<li><span class="re-name">${escHtml(ex.exercise)}</span><span class="re-detail">${escHtml(d)}</span></li>`;
        }).join('')}
      </ul>
      ${r.cardio ? `<div class="routine-cardio">🏃 ${escHtml(r.cardio)}</div>` : ''}
      <div class="routine-card-actions">
        <button class="btn-primary routine-log-btn" data-id="${r.id}">Log Today</button>
        <button class="btn-secondary routine-edit-btn" data-id="${r.id}">Edit</button>
        <button class="btn-danger routine-del-btn" data-id="${r.id}">Delete</button>
      </div>
    </div>`).join('');

  // Edit routine
  container.querySelectorAll('.routine-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const routine = routines.find(r => r.id === parseInt(btn.dataset.id));
      if (routine) enterEditMode(routine);
    });
  });

  // Log entire routine for today
  container.querySelectorAll('.routine-log-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const routine = routines.find(r => r.id === parseInt(btn.dataset.id));
      if (!routine) return;
      if (!confirm(`Log all ${routine.exercises.length} exercises from "${routine.name}" for today?`)) return;
      logRoutineOnDate(routine, toDateStr(new Date()));
      if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
      alert(`Logged ${routine.exercises.length} exercises from "${routine.name}" using the lower end of each range! 💪`);
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
        if (editingRoutineId === id) exitEditMode();
        renderRoutines();
        updateRoutineLoader();
      }
    });
  });
}

// ===== TODAY'S WORKOUT (dashboard) =====
function renderTodayWorkout() {
  const el = document.getElementById('today-workout');
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const routine = routines.find(r => r.day === todayName);

  if (!routine) { el.classList.add('hidden'); return; }

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="today-left">
      <div class="today-eyebrow">Today's Workout · ${escHtml(todayName)}</div>
      <div class="today-name">${escHtml(routine.name)}</div>
      ${routine.focus ? `<div class="today-focus">${escHtml(routine.focus)}</div>` : ''}
    </div>
    <button class="btn-primary" id="today-open-btn">Open Routine →</button>`;
  document.getElementById('today-open-btn').addEventListener('click', () => showView('routines'));
}

// ===== CALENDAR =====
let calYear, calMonth;        // currently viewed month
let calSelectedDate = null;   // YYYY-MM-DD of the selected day

(function initCalState() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
})();

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});
document.getElementById('cal-today-btn').addEventListener('click', () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  calSelectedDate = toDateStr(now);
  renderCalendar();
});

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  document.getElementById('cal-title').textContent =
    new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekday = new Date(calYear, calMonth, 1).getDay();
  const todayStr = toDateStr(new Date());
  const monthPrefix = `${calYear}-${pad2(calMonth + 1)}`;

  // Aggregate this month's workouts by day
  const dayData = {};
  workouts.forEach(w => {
    if (w.date && w.date.startsWith(monthPrefix)) {
      if (!dayData[w.date]) dayData[w.date] = { count: 0, volume: 0 };
      dayData[w.date].count++;
      dayData[w.date].volume += entryVolume(w);
    }
  });
  const maxVol = Math.max(1, ...Object.values(dayData).map(d => d.volume));

  // Which weekdays have a scheduled routine
  const scheduledWeekdays = new Set(routines.filter(r => r.day).map(r => r.day));

  let cells = '';
  for (let i = 0; i < firstWeekday; i++) cells += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = ymd(calYear, calMonth, d);
    const data = dayData[dateStr];
    const weekdayName = new Date(calYear, calMonth, d).toLocaleDateString('en-US', { weekday: 'long' });
    const classes = ['cal-cell'];

    if (data) {
      const ratio = data.volume / maxVol;
      let level = 1;
      if (data.volume > 0) {
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
      }
      classes.push('l' + level);
    }
    if (dateStr === todayStr) classes.push('today');
    if (dateStr === calSelectedDate) classes.push('selected');
    if (scheduledWeekdays.has(weekdayName)) classes.push('scheduled');

    const meta = data ? `<div class="cal-cell-meta"><span class="cal-count">${data.count}×</span></div>` : '';
    cells += `<div class="${classes.join(' ')}" data-date="${dateStr}"><span class="cal-daynum">${d}</span>${meta}</div>`;
  }
  grid.innerHTML = cells;

  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      calSelectedDate = cell.dataset.date;
      renderCalendar();
    });
  });

  renderCalSummary(dayData);
  renderCalDetail();
}

function renderCalSummary(dayData) {
  const vals = Object.values(dayData);
  const activeDays = vals.length;
  const totalWorkouts = vals.reduce((s, d) => s + d.count, 0);
  const totalVolume = vals.reduce((s, d) => s + d.volume, 0);
  document.getElementById('cal-summary').innerHTML = `
    <div class="cal-summary-card"><div class="cal-summary-val">${activeDays}</div><div class="cal-summary-label">Active Days</div></div>
    <div class="cal-summary-card"><div class="cal-summary-val">${totalWorkouts}</div><div class="cal-summary-label">Workouts</div></div>
    <div class="cal-summary-card"><div class="cal-summary-val">${Math.round(totalVolume).toLocaleString()}</div><div class="cal-summary-label">Volume (lbs)</div></div>`;
}

function renderCalDetail() {
  const el = document.getElementById('cal-detail');
  if (!calSelectedDate) {
    el.innerHTML = '<p class="empty-msg">Select a day to see what you did — or schedule a routine onto it.</p>';
    return;
  }

  const dayWorkouts = workouts.filter(w => w.date === calSelectedDate);
  const weekdayName = new Date(calSelectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const scheduled = routines.filter(r => r.day === weekdayName);

  let html = `<div class="cal-detail-head">${formatDateLabel(calSelectedDate)}</div>`;

  if (scheduled.length) {
    html += '<div class="cal-detail-sub">Scheduled</div>';
    html += scheduled.map(r => `
      <div class="cal-sched-card">
        <div class="cal-sched-info">
          <div class="cal-sched-name">${escHtml(r.name)}</div>
          ${r.focus ? `<div class="cal-sched-focus">${escHtml(r.focus)}</div>` : ''}
        </div>
        <button class="btn-primary cal-log-btn" data-id="${r.id}">Log on this day</button>
      </div>`).join('');
  }

  html += '<div class="cal-detail-sub">Logged</div>';
  if (dayWorkouts.length) {
    html += `<div class="workout-cards">${dayWorkouts.map(w => workoutCardHTML(w)).join('')}</div>`;
  } else {
    html += '<p class="empty-msg">Nothing logged on this day.</p>';
  }

  el.innerHTML = html;

  el.querySelectorAll('.cal-log-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const routine = routines.find(r => r.id === parseInt(btn.dataset.id));
      if (!routine) return;
      if (!confirm(`Log all ${routine.exercises.length} exercises from "${routine.name}" on ${formatDateLabel(calSelectedDate)}?`)) return;
      logRoutineOnDate(routine, calSelectedDate);
      renderCalendar();
    });
  });

  attachDeleteListeners(el);
}

// Log a routine's exercises onto a specific date (ranges -> lower-bound numbers)
function logRoutineOnDate(routine, dateStr) {
  const base = Date.now();
  routine.exercises.forEach((ex, i) => {
    workouts.unshift({
      id: base + i,
      date: dateStr,
      category: 'Strength',
      exercise: ex.exercise,
      muscle: ex.muscle || null,
      sets: ex.sets || null,
      reps: parseFirstNumber(ex.reps),
      weight: parseFirstNumber(ex.weight),
      notes: `From routine: ${routine.name}`,
    });
  });
  saveWorkouts(workouts);
  updateExerciseSuggestions();
}

// ===== SEED DATA =====
// The user's 4-day split, pre-loaded once on first run.
const SEED_FLAG = 'seeded_routines_v1';
const SEED_ROUTINES = [
  {
    name: 'Day 1 — Monday', day: 'Monday',
    focus: 'Chest · Quads · Front delt · Side delt · Triceps · Calves',
    cardio: '15-20 min incline treadmill or bike',
    exercises: [
      { exercise: 'Flat Barbell Bench Press', muscle: 'Chest', sets: 4, reps: '4-6', weight: '205-215 lb' },
      { exercise: 'BB Back Squat', muscle: 'Legs', sets: 4, reps: '5-6', weight: '315 lb' },
      { exercise: 'DB Shoulder Press', muscle: 'Shoulders', sets: 3, reps: '6-8', weight: '65 lb' },
      { exercise: 'Cable Lateral Raise', muscle: 'Shoulders', sets: 3, reps: '10-12', weight: '80-90 lb stack' },
      { exercise: 'Overhead Rope Cable Extension', muscle: 'Arms', sets: 3, reps: '8-10', weight: '55-60 lb' },
      { exercise: 'Single-leg Calf Raise', muscle: 'Legs', sets: 3, reps: '8-10', weight: '200 lb' },
    ],
  },
  {
    name: 'Day 2 — Tuesday', day: 'Tuesday',
    focus: 'Back · Hamstrings · Glutes · Rear delt · Biceps · Brachialis · Forearms',
    cardio: '15-20 min incline treadmill or bike',
    exercises: [
      { exercise: 'RDL', muscle: 'Legs', sets: 4, reps: '5-6', weight: '345 lb' },
      { exercise: 'Neutral Grip Row', muscle: 'Back', sets: 4, reps: '6-8', weight: '170 lb' },
      { exercise: 'Wide Grip Pull-up', muscle: 'Back', sets: 3, reps: '6-8', weight: 'BW + 10-25 lb' },
      { exercise: 'Seated Hamstring Curl', muscle: 'Legs', sets: 3, reps: '8-10', weight: '210 lb' },
      { exercise: 'Rear Delt Cable Fly (single arm)', muscle: 'Shoulders', sets: 3, reps: '12-15', weight: '25-35 lb' },
      { exercise: 'Incline DB Curl', muscle: 'Arms', sets: 3, reps: '8-10', weight: '40 lb' },
      { exercise: 'Cable Hammer Curl', muscle: 'Arms', sets: 3, reps: '8-10', weight: '60 lb' },
      { exercise: 'Wrist Curl', muscle: 'Arms', sets: 3, reps: '8-10', weight: '190 lb' },
    ],
  },
  {
    name: 'Day 3 — Thursday', day: 'Thursday',
    focus: 'Chest · Hamstrings · Glutes · Front delt · Biceps · Brachialis · Calves',
    cardio: '15-20 min incline treadmill or bike',
    exercises: [
      { exercise: 'Incline Bench Press', muscle: 'Chest', sets: 4, reps: '6-8', weight: '185 lb' },
      { exercise: 'Chest Press Machine', muscle: 'Chest', sets: 3, reps: '8-10', weight: '180 lb' },
      { exercise: 'Hip Thrust', muscle: 'Legs', sets: 3, reps: '8-10', weight: '185-225 lb' },
      { exercise: 'Lying Leg Curl', muscle: 'Legs', sets: 3, reps: '10-12', weight: '160-180 lb' },
      { exercise: 'EZ-bar Curl', muscle: 'Arms', sets: 3, reps: '10-12', weight: '85-95 lb' },
      { exercise: 'Cross-body Hammer Curl', muscle: 'Arms', sets: 3, reps: '10-12', weight: '30-35 lb' },
      { exercise: 'Single-leg Calf Raise', muscle: 'Legs', sets: 3, reps: '8-10', weight: '200 lb' },
    ],
  },
  {
    name: 'Day 4 — Friday', day: 'Friday',
    focus: 'Back · Quads · Side delt · Rear delt · Triceps',
    cardio: '15-20 min incline treadmill or bike',
    exercises: [
      { exercise: 'Weighted Wide Grip Pull-up', muscle: 'Back', sets: 4, reps: '5-7', weight: 'BW + 25-45 lb' },
      { exercise: 'Seated Cable Row (wide grip)', muscle: 'Back', sets: 3, reps: '8-10', weight: '160-180 lb' },
      { exercise: 'Leg Press', muscle: 'Legs', sets: 4, reps: '8-10', weight: '400-450 lb' },
      { exercise: 'Leg Extension', muscle: 'Legs', sets: 3, reps: '8-10', weight: '265 lb' },
      { exercise: 'Cable Lateral Raise', muscle: 'Shoulders', sets: 3, reps: '12-15', weight: '70-80 lb stack' },
      { exercise: 'Face Pull', muscle: 'Shoulders', sets: 3, reps: '12-15', weight: '50-65 lb' },
      { exercise: 'Rope Pushdown', muscle: 'Arms', sets: 3, reps: '8-10', weight: '55-60 lb' },
      { exercise: 'Dips', muscle: 'Arms', sets: 3, reps: '6-8', weight: 'BW + 10-25 lb' },
    ],
  },
];

// Load the seed routines once. Guarded by a flag so deleting them won't re-add.
function seedRoutinesIfNeeded() {
  if (localStorage.getItem(SEED_FLAG)) return;
  if (routines.length === 0) {
    const base = Date.now();
    routines = SEED_ROUTINES.map((r, i) => ({ id: base + i, ...r }));
    saveRoutines(routines);
  }
  localStorage.setItem(SEED_FLAG, '1');
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

// Extract the first number from a value that may be a string range
// e.g. "4-6" -> 4, "205-215 lb" -> 205, "BW + 25 lb" -> 25, 60 -> 60
function parseFirstNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const m = String(val).match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// ===== CHART.JS LOADER =====
// Load the vendored local copy first (works fully offline); fall back to the
// CDN only if the local file is missing; degrade gracefully if neither loads.
function loadChartJS(callback) {
  if (window.Chart) { callback(); return; }
  const local = document.createElement('script');
  local.src = './chart.umd.min.js';
  local.onload = callback;
  local.onerror = () => {
    const cdn = document.createElement('script');
    cdn.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    cdn.onload = callback;
    cdn.onerror = () => callback();
    document.head.appendChild(cdn);
  };
  document.head.appendChild(local);
}

// ===== SERVICE WORKER (offline / installable PWA) =====
// Only registers over http/https (not file://, where it isn't supported).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ===== INIT =====
seedRoutinesIfNeeded();
updateRoutineLoader();
loadChartJS(() => {
  updateExerciseSuggestions();
  renderDashboard();
});
