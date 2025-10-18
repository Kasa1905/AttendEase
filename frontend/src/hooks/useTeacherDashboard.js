import { useState, useEffect, useCallback } from 'react';
import useApi from './useApi';
import { showToast } from '../utils/helpers';

export const useTeacherDashboard = () => {
  const api = useApi();

  // State for different dashboard sections
  const [dailyData, setDailyData] = useState(null);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    approvalStatus: '',
    studentName: '',
    userId: '',
    studentNumber: '',
    minDutyDuration: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    eventId: ''
  });

  // Modal states
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    recordId: null
  });

  // Load daily summary data
  const loadDailyData = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/daily-summary/${date}`);
      setDailyData(res.data?.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load daily data';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Load pending approval records
  const loadPendingRecords = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const res = await api.get(`/attendance/pending-approval?${queryParams}`);
      const records = res.data?.data || [];
      setPendingRecords(records);
      setFilteredRecords(records);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load pending records';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  // Apply filters to records
  const applyFilters = useCallback(() => {
    let filtered = [...pendingRecords];

    // Student name filter
    if (filters.studentName) {
      filtered = filtered.filter(record => {
        const fullName = `${record.User?.firstName} ${record.User?.lastName}`.toLowerCase();
        return fullName.includes(filters.studentName.toLowerCase());
      });
    }

    // Student ID filter
    if (filters.userId) {
      filtered = filtered.filter(record => record.userId === filters.userId);
    }

    // Student Number filter
    if (filters.studentNumber) {
      filtered = filtered.filter(record => record.User?.studentId == parseInt(filters.studentNumber));
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    // Approval status filter
    if (filters.approvalStatus) {
      const approvalValue = filters.approvalStatus === 'approved' ? true :
                           filters.approvalStatus === 'rejected' ? false : null;
      filtered = filtered.filter(record => record.isApproved === approvalValue);
    }

    // Event ID filter
    if (filters.eventId) {
      filtered = filtered.filter(record => record.eventId === parseInt(filters.eventId));
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(record => new Date(record.createdAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(record => new Date(record.createdAt) <= toDate);
    }

    // Duty duration filter
    if (filters.minDutyDuration) {
      const minMinutes = parseInt(filters.minDutyDuration) * 60;
      filtered = filtered.filter(record =>
        record.DutySession?.totalDurationMinutes >= minMinutes
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (filters.sortBy) {
        case 'firstName':
          aValue = `${a.User?.firstName} ${a.User?.lastName}`.toLowerCase();
          bValue = `${b.User?.firstName} ${b.User?.lastName}`.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredRecords(filtered);
  }, [pendingRecords, filters]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      status: '',
      approvalStatus: '',
      studentName: '',
      userId: '',
      studentNumber: '',
      minDutyDuration: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      eventId: ''
    });
  }, []);

  // Bulk approve records
  const bulkApprove = useCallback(async (recordIds) => {
    setActionLoading(true);
    try {
      const res = await api.post('/attendance/bulk-approve', { ids: recordIds });
      showToast(`Successfully approved ${recordIds.length} records`, 'success');
      setSelectedRecords(new Set());
      loadPendingRecords();
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to approve records';
      showToast(msg, 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [api, loadPendingRecords]);

  // Bulk reject records
  const bulkReject = useCallback(async (recordIds, reason = '') => {
    setActionLoading(true);
    try {
      const res = await api.post('/attendance/bulk-reject', { ids: recordIds, reason });
      showToast(`Successfully rejected ${recordIds.length} records`, 'success');
      setSelectedRecords(new Set());
      loadPendingRecords();
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to reject records';
      showToast(msg, 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [api, loadPendingRecords]);

  // Individual approve/reject
  const approveRecord = useCallback(async (recordId) => {
    return bulkApprove([recordId]);
  }, [bulkApprove]);

  const rejectRecord = useCallback(async (recordId, reason = '') => {
    return bulkReject([recordId], reason);
  }, [bulkReject]);

  // Selection management
  const toggleRecordSelection = useCallback((recordId) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  }, []);

  const selectAllRecords = useCallback(() => {
    setSelectedRecords(prev => {
      if (prev.size === filteredRecords.length) {
        return new Set();
      } else {
        return new Set(filteredRecords.map(r => r.id));
      }
    });
  }, [filteredRecords]);

  const clearSelection = useCallback(() => {
    setSelectedRecords(new Set());
  }, []);

  // Modal management
  const openDetailModal = useCallback((recordId) => {
    setDetailModal({ isOpen: true, recordId });
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailModal({ isOpen: false, recordId: null });
  }, []);

  // Refresh all data
  const refreshData = useCallback(() => {
    loadPendingRecords();
    if (dailyData) {
      // Refresh daily data if we have a date
      const currentDate = new Date().toISOString().slice(0, 10);
      loadDailyData(currentDate);
    }
  }, [loadPendingRecords, loadDailyData, dailyData]);

  // Apply filters when records or filters change
  useEffect(() => {
    if (pendingRecords.length > 0) {
      applyFilters();
    }
  }, [pendingRecords, filters, applyFilters]);

  return {
    // Data
    dailyData,
    pendingRecords,
    filteredRecords,
    selectedRecords,
    loading,
    actionLoading,
    filters,

    // Actions
    loadDailyData,
    loadPendingRecords,
    updateFilters,
    resetFilters,
    bulkApprove,
    bulkReject,
    approveRecord,
    rejectRecord,
    toggleRecordSelection,
    selectAllRecords,
    clearSelection,
    refreshData,

    // Modal
    detailModal,
    openDetailModal,
    closeDetailModal
  };
};