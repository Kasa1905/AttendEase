import { useCallback, useEffect, useRef, useState } from 'react';

export default function useTimer({ initial = 0, interval = 1000, autoStart = false } = {}) {
  const [running, setRunning] = useState(!!autoStart);
  const [elapsed, setElapsed] = useState(initial);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  const start = useCallback(() => {
    if (running) return;
    startRef.current = Date.now() - elapsed;
    setRunning(true);
  }, [running, elapsed]);

  const pause = useCallback(() => { setRunning(false); }, []);
  const reset = useCallback((val = 0) => { setElapsed(val); startRef.current = Date.now() - val; }, []);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => { setElapsed(Math.max(0, Date.now() - (startRef.current || Date.now()))); }, interval);
    } else {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => clearInterval(timerRef.current);
  }, [running, interval]);

  return { elapsed, running, start, pause, reset };
}
