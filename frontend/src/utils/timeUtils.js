export function formatDuration(minutes) {
  const h = Math.floor(minutes/60); const m = minutes % 60; return h ? `${h}h ${m}m` : `${m}m`;
}

export function calculateSessionProgress(startTime, targetMinutes = 120) {
  if (!startTime) return 0;
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(startTime))/60000));
  return Math.min(100, Math.round((elapsed/targetMinutes)*100));
}

export function getNextLogDueTime(sessionStart, logs=[]) {
  if (!sessionStart) return null;
  if (!logs.length) return new Date(new Date(sessionStart).getTime() + 60*60*1000);
  const last = logs[logs.length-1]; return new Date(new Date(last.createdAt).getTime() + 60*60*1000);
}

export function validateBreakDuration(durationMinutes) { return durationMinutes <= 30; }

export function formatTimeRemaining(targetTime) { const ms = new Date(targetTime) - Date.now(); if (ms<=0) return '0m'; const m = Math.ceil(ms/60000); return `${m}m`; }

export function isWithinLogWindow(lastLogTime, windowMinutes = 15) {
  const expected = lastLogTime ? new Date(new Date(lastLogTime).getTime() + 60*60*1000) : null;
  if (!expected) return true;
  const now = new Date();
  const low = new Date(expected.getTime() - windowMinutes*60000);
  const high = new Date(expected.getTime() + windowMinutes*60000);
  return now >= low && now <= high;
}

export function calculateTotalBreakTime(logs=[]) {
  return logs.reduce((s,l) => { if (l.breakStartedAt && l.breakEndedAt) { const gap = (new Date(l.breakEndedAt)-new Date(l.breakStartedAt))/60000; return s+gap; } return s; }, 0);
}

export function getSessionStatus(session) {
  if (!session) return 'inactive';
  if (!session.endedAt && session.startTime) return 'active';
  return 'ended';
}
