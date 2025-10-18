import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { showToast } from '../../utils/helpers';

export default function AttendanceDetailModal({ recordId, isOpen, onClose }) {
  const api = useApi();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (isOpen && recordId) {
      loadRecordDetails();
    }
  }, [isOpen, recordId]);

  const loadRecordDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/${recordId}/details`);
      setRecord(res.data?.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load record details';
      showToast(msg, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/bulk-approve', { ids: [recordId] });
      showToast('Record approved successfully', 'success');
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to approve record';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/attendance/bulk-reject', { ids: [recordId], reason: rejectReason });
      showToast('Record rejected successfully', 'success');
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to reject record';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present_in_class': return 'bg-green-100 text-green-800';
      case 'on_club_duty': return 'bg-blue-100 text-blue-800';
      case 'absent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalColor = (isApproved) => {
    if (isApproved === true) return 'bg-green-100 text-green-800';
    if (isApproved === false) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Attendance Record Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading details...</span>
          </div>
        ) : record ? (
          <div className="space-y-6">
            {/* Student Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-3">Student Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <div className="text-gray-900">{record.User?.firstName} {record.User?.lastName}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <div className="text-gray-900">{record.User?.email}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Role:</span>
                  <div className="text-gray-900 capitalize">{record.User?.role}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                    {record.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Attendance Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-3">Attendance Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <div className="text-gray-900">{formatDate(record.createdAt)}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Last Updated:</span>
                  <div className="text-gray-900">{formatDate(record.updatedAt)}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Approval Status:</span>
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getApprovalColor(record.isApproved)}`}>
                    {record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Duty Eligible:</span>
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${record.dutyEligible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {record.dutyEligible ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Duty Session Information */}
            {record.DutySession && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">Duty Session Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Started:</span>
                    <div className="text-gray-900">{formatDate(record.DutySession.startedAt)}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Ended:</span>
                    <div className="text-gray-900">
                      {record.DutySession.endedAt ? formatDate(record.DutySession.endedAt) : 'Ongoing'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Total Duration:</span>
                    <div className="text-gray-900">{formatDuration(record.DutySession.totalDurationMinutes)}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${record.DutySession.endedAt ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {record.DutySession.endedAt ? 'Completed' : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Hourly Logs */}
                {record.DutySession.HourlyLogs && record.DutySession.HourlyLogs.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Hourly Logs ({record.DutySession.HourlyLogs.length})</h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {record.DutySession.HourlyLogs.map((log) => (
                        <div key={log.id} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(log.createdAt)}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Previous Work:</span>
                              <div className="text-gray-900 mt-1">{log.previousHourWork}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Next Plan:</span>
                              <div className="text-gray-900 mt-1">{log.nextHourPlan}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Event Information */}
            {record.Event && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">Event Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Event Name:</span>
                    <div className="text-gray-900">{record.Event.name}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Event Date:</span>
                    <div className="text-gray-900">{formatDate(record.Event.date)}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Description:</span>
                    <div className="text-gray-900 mt-1">{record.Event.description}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments/Notes */}
            {record.notes && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">Notes</h4>
                <div className="text-gray-900">{record.notes}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Failed to load record details
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <div>
            {record && record.isApproved === null && (
              <div className="flex space-x-2">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => setShowRejectReason(true)}
                  disabled={actionLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        {/* Reject Reason Modal */}
        {showRejectReason && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Reject Record</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection"
                className="w-full p-2 border rounded mb-4"
                rows="3"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowRejectReason(false);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}