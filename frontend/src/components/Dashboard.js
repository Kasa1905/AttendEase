import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import StudentDashboard from '../pages/StudentDashboard';
import TeacherDashboard from '../pages/TeacherDashboard';
import CoreTeamDashboard from '../pages/CoreTeamDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();
  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'core_team' || role === 'core') return <CoreTeamDashboard />;
  return <StudentDashboard />;
}
