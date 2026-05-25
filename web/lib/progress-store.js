const QUIZ_LOG_KEY = "wordmaster-quiz-log";
const ACTIVITY_KEY = "wordmaster-activity";

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadQuizLog() {
  return readJson(QUIZ_LOG_KEY, []);
}

export function addQuizEntry(entry) {
  const log = loadQuizLog();
  log.unshift({
    id: `${Date.now()}-${Math.random()}`,
    at: new Date().toISOString(),
    wordId: entry.wordId,
    word: entry.word,
    correct: Boolean(entry.correct),
    picked: entry.picked,
    answer: entry.answer
  });
  writeJson(QUIZ_LOG_KEY, log.slice(0, 200));
  return log;
}

export function getQuizAccuracy(log = loadQuizLog()) {
  if (!log.length) return 0;
  const correct = log.filter((item) => item.correct).length;
  return Math.round((correct / log.length) * 100);
}

function loadActivity() {
  return readJson(ACTIVITY_KEY, {});
}

export function recordStudyActivity() {
  const activity = loadActivity();
  const key = new Date().toISOString().slice(0, 10);
  activity[key] = (activity[key] || 0) + 1;
  writeJson(ACTIVITY_KEY, activity);
  return activity;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function getStreakViewModel() {
  const activity = loadActivity();
  const today = new Date();
  const week = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = dateKey(day);
    const count = activity[key] || 0;
    week.push({
      key,
      label: day.toLocaleDateString("en-US", { weekday: "narrow" }),
      fullLabel: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      count,
      isToday: offset === 0,
      active: count > 0
    });
  }

  let streak = 0;
  const cursor = new Date(today);
  while ((activity[dateKey(cursor)] || 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const weekTotal = week.reduce((sum, day) => sum + day.count, 0);

  return { streak, week, weekTotal, todayCount: week[6]?.count || 0 };
}

export function getProgressSnapshot(stats = {}, log = loadQuizLog()) {
  const streakInfo = getStreakViewModel();
  return {
    ...stats,
    accuracy: getQuizAccuracy(log),
    streak: streakInfo.streak
  };
}
