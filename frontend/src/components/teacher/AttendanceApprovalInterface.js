import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { showToast } from '../../utils/helpers';

export default function AttendanceApprovalInterface({
  records = [],
  loading = false,
  onApprove,
  onReject,
  onSelectRecord,
  onSelectAll,
  selectedRecords = new Set(),
  onViewDetails,
}) {
  const api = useApi();
  const [localFilters, setLocalFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    studentName: ''
  });
  const [localSelectedRecords, setLocalSelectedRecords] = useState(new Set());
  const [localLoading, setLocalLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [localRecords, setLocalRecords] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingRejectAction, setPendingRejectAction] = useState(null);
  const [pendingRejectRecordId, setPendingRejectRecordId] = useState(null);

  // Use props if provided, otherwise use local state
  const currentRecords = records.length > 0 ? records : localRecords;
  const currentLoading = loading || localLoading;
  const currentSelectedRecords = selectedRecords || localSelectedRecords;
  const setCurrentSelectedRecords = selectedRecords ? () => {} : setLocalSelectedRecords;

  useEffect(() => {
    if (records.length === 0) {
      loadPendingRecords();
    }
  }, [localFilters]);

  const loadPendingRecords = async () => {
    setLocalLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(localFilters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const res = await api.get(`/attendance/pending-approval?${queryParams}`);
      // If using local state, update it
      if (records.length === 0) {
        setLocalRecords(res.data?.data || []);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load pending records';
      showToast(msg, 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSelectRecord = (recordId) => {
    if (onSelectRecord) {
      onSelectRecord(recordId);
    } else {
      const newSelected = new Set(currentSelectedRecords);
      if (newSelected.has(recordId)) {
        newSelected.delete(recordId);
      } else {
        newSelected.add(recordId);
      }
      setCurrentSelectedRecords(newSelected);
    }
  };

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      if (currentSelectedRecords.size === currentRecords.length) {
        setCurrentSelectedRecords(new Set());
      } else {
        setCurrentSelectedRecords(new Set(currentRecords.map(r => r.id)));
      }
    }
  };

  const handleBulkApprove = async () => {
    if (currentSelectedRecords.size === 0) {
      showToast('Please select records to approve', 'warning');
      return;
    }

    setBulkActionLoading(true);
    try {
      if (onApprove) {
        // Use the prop function for bulk approve
        await onApprove(Array.from(currentSelectedRecords));
      } else {
        const res = await api.post('/attendance/bulk-approve', {
          ids: Array.from(currentSelectedRecords)
        });
        showToast(`Successfully approved ${currentSelectedRecords.size} records`, 'success');
        setCurrentSelectedRecords(new Set());
        loadPendingRecords();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to approve records';
      showToast(msg, 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (currentSelectedRecords.size === 0) {
      showToast('Please select records to reject', 'warning');
      return;
    }

    setPendingRejectAction('bulk');
    setShowRejectModal(true);
  };

  const handleIndividualAction = async (recordId, action) => {
    setBulkActionLoading(true);
    try {
      if (action === 'approve' && onApprove) {
        await onApprove([recordId]);
      } else if (action === 'reject') {
        setPendingRejectRecordId(recordId);
        setPendingRejectAction('single');
        setShowRejectModal(true);
        return;
      } else {
        const endpoint = action === 'approve' ? '/attendance/bulk-approve' : '/attendance/bulk-reject';
        const res = await api.post(endpoint, {
          ids: [recordId]
        });
        showToast(`Record ${action}d successfully`, 'success');
        loadPendingRecords();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to process record';
      showToast(msg, 'error');
    } finally {
      setBulkActionLoading(false);
    }
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'present_in_class': return 'bg-green-100 text-green-800';
      case 'on_club_duty': return 'bg-blue-100 text-blue-800';
      case 'absent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRecords = currentRecords.filter(record => {
    if (localFilters.studentName) {
      const fullName = `${record.User?.firstName} ${record.User?.lastName}`.toLowerCase();
      if (!fullName.includes(localFilters.studentName.toLowerCase())) return false;
    }
    return true;
  });

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    setBulkActionLoading(true);
    try {
      if (pendingRejectAction === 'bulk') {
        if (onReject) {
          await onReject(Array.from(currentSelectedRecords), rejectReason);
        } else {
          const res = await api.post('/attendance/bulk-reject', {
            ids: Array.from(currentSelectedRecords),
            reason: rejectReason
          });
          showToast(`Successfully rejected ${currentSelectedRecords.size} records`, 'success');
          setCurrentSelectedRecords(new Set());
          loadPendingRecords();
        }
      } else if (pendingRejectAction === 'single') {
        if (onReject) {
          await onReject([pendingRejectRecordId], rejectReason);
        } else {
          const res = await api.post('/attendance/bulk-reject', {
            ids: [pendingRejectRecordId],
            reason: rejectReason
          });
          showToast(`Record rejected successfully`, 'success');
          loadPendingRecords();
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to reject records';
      showToast(msg, 'error');
    } finally {
      setBulkActionLoading(false);
      setShowRejectModal(false);
      setRejectReason('');
      setPendingRejectAction(null);
      setPendingRejectRecordId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Attendance Approval</h2>
          <div className="text-sm text-gray-600">
            {currentRecords.length} pending records
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-md font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={localFilters.status}
              onChange={(e) => setLocalFilters({...localFilters, status: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="present_in_class">Present in Class</option>
              <option value="on_club_duty">On Club Duty</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={localFilters.dateFrom}
              onChange={(e) => setLocalFilters({...localFilters, dateFrom: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={localFilters.dateTo}
              onChange={(e) => setLocalFilters({ ...localFilters, dateTo: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
            <input
              type="text"
              value={localFilters.studentName}
              onChange={(e) => setLocalFilters({...localFilters, studentName: e.target.value})}
              placeholder="Search by name..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {currentSelectedRecords.size > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              {currentSelectedRecords.size} record{currentSelectedRecords.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleBulkApprove}
                disabled={bulkActionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {bulkActionLoading ? 'Processing...' : 'Approve Selected'}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkActionLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {bulkActionLoading ? 'Processing...' : 'Reject Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {currentLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {currentRecords.length === 0 ? 'No pending records to approve' : 'No records match your filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={currentSelectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duty Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={currentSelectedRecords.has(record.id)}
                        onChange={() => handleSelectRecord(record.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {record.User?.firstName} {record.User?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.User?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.DutySession?.totalDurationMinutes
                        ? `${Math.floor(record.DutySession.totalDurationMinutes / 60)}h ${record.DutySession.totalDurationMinutes % 60}m`
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleIndividualAction(record.id, 'approve')}
                        disabled={bulkActionLoading}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleIndividualAction(record.id, 'reject')}
                        disabled={bulkActionLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Records</h3>
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
                  setShowRejectModal(false);
                  setRejectReason('');
                  setPendingRejectAction(null);
                  setPendingRejectRecordId(null);
                }}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {bulkActionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
