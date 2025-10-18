import React from 'react';
import AttendanceSelector from '../components/student/AttendanceSelector';
import DutySessionInterface from '../components/student/DutySessionInterface';
import HourlyLogForm from '../components/student/HourlyLogForm';
import BreakManager from '../components/student/BreakManager';
import HourlyLogHistory from '../components/student/HourlyLogHistory';
import StatusCard from '../components/common/StatusCard';
import StrikeOverview from '../components/common/StrikeOverview';
import StrikeHistory from '../components/student/StrikeHistory';
import useDutySession from '../hooks/useDutySession';
import useApi from '../hooks/useApi';
import { getTodayDateString } from '../utils/helpers';
import LeaveRequestForm from '../components/student/LeaveRequestForm';
import MyRequests from '../components/student/MyRequests';

export default function StudentDashboard() {
  const { session, currentLog, loading, refresh, start, end } = useDutySession();
  const api = useApi();
  const [todayAttendance, setTodayAttendance] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = getTodayDateString();
        const res = await api.get(`/attendance/date/${today}`);
        if (!cancelled) setTodayAttendance(res?.data?.[0] || null);
      } catch (e) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const canStartSession = todayAttendance?.status === 'on_club_duty';

  const handleAttendanceMarked = async (serverData) => {
    // refresh session state
    try { await refresh(); } catch (e) { /* ignore */ }
    // refetch today's attendance to update canStartSession
    try {
      const today = getTodayDateString();
      const res = await api.get(`/attendance/date/${today}`);
      setTodayAttendance(res?.data?.[0] || null);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <AttendanceSelector onMarked={handleAttendanceMarked} />
        </div>
        <div className="space-y-4">
          <StatusCard title="Session Status" value={session ? (session.endedAt ? 'Ended' : 'Active') : 'No session'} description={session ? new Date(session.startTime || session.startedAt).toLocaleString() : ''} />
          <StrikeOverview compact={true} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <DutySessionInterface session={session} currentLog={currentLog} loading={loading} canStartSession={canStartSession} onStart={start} onEnd={() => end(session?.id)} />
        </div>
        <div className="lg:col-span-1">
          {session && <HourlyLogForm session={session} lastLog={currentLog} />}
          {!session && <div className="p-4 border rounded bg-white">No active session - start a session to log hourly work.</div>}
        </div>
        <div className="lg:col-span-1">
          <div className="mt-4"><HourlyLogHistory sessionId={session ? session.id : null} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LeaveRequestForm />
        </div>
        <div>
          <MyRequests />
        </div>
      </div>

      <StrikeHistory />
    </div>
  );
}
