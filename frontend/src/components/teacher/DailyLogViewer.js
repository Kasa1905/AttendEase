import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { showToast } from '../../utils/helpers';

export default function DailyLogViewer({ selectedDate, onDateChange }) {
  const api = useApi();
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const [expandedStudents, setExpandedStudents] = useState(new Set());

  useEffect(() => {
    loadDailyData();
  }, [selectedDate]);

  const loadDailyData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/daily-summary/${selectedDate}`);
      setDailyData(res.data?.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load daily data';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpansion = (studentId) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedStudents(newExpanded);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getAttendanceStatusColor = (status) => {
    switch (status) {
      case 'present_in_class': return 'bg-green-100 text-green-800';
      case 'on_club_duty': return 'bg-blue-100 text-blue-800';
      case 'absent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalStatusColor = (isApproved) => {
    if (isApproved === true) return 'bg-green-100 text-green-800';
    if (isApproved === false) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const renderAttendanceTab = () => {
    if (!dailyData?.attendanceRecords?.length) {
      return <div className="p-8 text-center text-gray-500">No attendance records for this date</div>;
    }

    return (
      <div className="space-y-4">
        {dailyData.attendanceRecords.map((record) => (
          <div key={record.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="font-medium text-gray-900">
                  {record.User?.firstName} {record.User?.lastName}
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAttendanceStatusColor(record.status)}`}>
                  {record.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getApprovalStatusColor(record.isApproved)}`}>
                  {record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending'}
                </span>
              </div>
              <button
                onClick={() => toggleStudentExpansion(record.userId)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                {expandedStudents.has(record.userId) ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {expandedStudents.has(record.userId) && (
              <div className="mt-3 space-y-2">
                {record.DutySession && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm font-medium text-gray-700 mb-2">Duty Session</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Started:</span> {formatDate(record.DutySession.startedAt)}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span> {formatDuration(record.DutySession.totalDurationMinutes || 0)}
                      </div>
                      {record.DutySession.endedAt && (
                        <div>
                          <span className="font-medium">Ended:</span> {formatDate(record.DutySession.endedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {record.DutySession?.HourlyLogs?.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm font-medium text-gray-700 mb-2">Hourly Logs ({record.DutySession.HourlyLogs.length})</div>
                    <div className="space-y-2">
                      {record.DutySession.HourlyLogs.map((log) => (
                        <div key={log.id} className="text-sm bg-white p-2 rounded border">
                          <div className="font-medium">{formatDate(log.createdAt)}</div>
                          <div className="text-gray-600 mt-1">
                            <div><strong>Previous work:</strong> {log.previousHourWork}</div>
                            <div><strong>Next plan:</strong> {log.nextHourPlan}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDutySessionsTab = () => {
    if (!dailyData?.dutySessions?.length) {
      return <div className="p-8 text-center text-gray-500">No duty sessions for this date</div>;
    }

    return (
      <div className="space-y-4">
        {dailyData.dutySessions.map((session) => (
          <div key={session.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="font-medium text-gray-900">
                  {session.User?.firstName} {session.User?.lastName}
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${session.endedAt ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                  {session.endedAt ? 'Completed' : 'Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <span className="font-medium">Started:</span> {formatDate(session.startedAt)}
              </div>
              <div>
                <span className="font-medium">Duration:</span> {formatDuration(session.totalDurationMinutes || 0)}
              </div>
              {session.endedAt && (
                <div>
                  <span className="font-medium">Ended:</span> {formatDate(session.endedAt)}
                </div>
              )}
            </div>

            {session.HourlyLogs?.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Hourly Logs ({session.HourlyLogs.length})</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {session.HourlyLogs.map((log) => (
                    <div key={log.id} className="text-sm bg-gray-50 p-2 rounded">
                      <div className="font-medium">{formatDate(log.createdAt)}</div>
                      <div className="text-gray-600 mt-1">
                        <div><strong>Work:</strong> {log.previousHourWork}</div>
                        <div><strong>Plan:</strong> {log.nextHourPlan}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderHourlyLogsTab = () => {
    if (!dailyData?.hourlyLogs?.length) {
      return <div className="p-8 text-center text-gray-500">No hourly logs for this date</div>;
    }

    return (
      <div className="space-y-4">
        {dailyData.hourlyLogs.map((log) => (
          <div key={log.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-gray-900">
                {log.User?.firstName} {log.User?.lastName}
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(log.createdAt)}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Previous Hour Work:</span>
                <div className="mt-1 text-gray-700">{log.previousHourWork}</div>
              </div>
              <div>
                <span className="font-medium">Next Hour Plan:</span>
                <div className="mt-1 text-gray-700">{log.nextHourPlan}</div>
              </div>
            </div>

            {log.DutySession && (
              <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                <div><strong>Session Duration:</strong> {formatDuration(log.DutySession.totalDurationMinutes || 0)}</div>
                <div><strong>Session Status:</strong> {log.DutySession.endedAt ? 'Completed' : 'Active'}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Picker */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Daily Log Viewer</h2>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => loadDailyData()}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {dailyData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{dailyData.summary.totalAttendance}</div>
            <div className="text-sm text-gray-600">Total Attendance</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{dailyData.summary.totalDutySessions}</div>
            <div className="text-sm text-gray-600">Duty Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">{dailyData.summary.totalHourlyLogs}</div>
            <div className="text-sm text-gray-600">Hourly Logs</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Attendance ({dailyData?.summary?.totalAttendance || 0})
            </button>
            <button
              onClick={() => setActiveTab('duty')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'duty'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Duty Sessions ({dailyData?.summary?.totalDutySessions || 0})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Hourly Logs ({dailyData?.summary?.totalHourlyLogs || 0})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading daily data...</span>
            </div>
          ) : (
            <>
              {activeTab === 'attendance' && renderAttendanceTab()}
              {activeTab === 'duty' && renderDutySessionsTab()}
              {activeTab === 'logs' && renderHourlyLogsTab()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}