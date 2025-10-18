import React, { useEffect, useState } from 'react';

export default function TimerDisplay({ startTime, format = 'HH:MM:SS', interval = 1000, paused = false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let t;
    if (!paused) t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [paused, interval]);

  if (!startTime) return <div className="text-sm text-gray-500">--:--</div>;
  const s = new Date(startTime);
  const diff = Math.max(0, Math.floor((now - s)/1000));
  const hh = String(Math.floor(diff/3600)).padStart(2,'0');
  const mm = String(Math.floor((diff%3600)/60)).padStart(2,'0');
  const ss = String(diff%60).padStart(2,'0');
  const display = format === 'HH:MM' ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`;
  return <div aria-live="polite" className="text-sm font-mono">{display}</div>;
}
