import { useState, useCallback } from 'react';
import { showToast } from '../utils/helpers';
import useApi from '../hooks/useApi';

const API_BASE = '/leave-requests'; // relative to API_BASE set in api.js

export default function useLeaveRequests() {
  const { get, post, put, del, loading: apiLoading, error: apiError } = useApi();
  const [error, setError] = useState(null);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await get(`${API_BASE}/my`);
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.message || 'Failed to load requests', 'error');
      throw err;
    }
  }, [get]);

  const submitRequest = useCallback(async (payload) => {
    try {
      const res = await post(`${API_BASE}`, payload);
      showToast(res.data?.message || 'Request submitted', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to submit', 'error');
      throw err;
    }
  }, [post]);

  const deleteRequest = useCallback(async (id) => {
    try {
      const res = await del(`${API_BASE}/${id}`);
      showToast(res.data?.message || 'Deleted', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to delete', 'error');
      throw err;
    }
  }, [del]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await get(`${API_BASE}/pending`);
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to load pending', 'error');
      throw err;
    }
  }, [get]);

  const approve = useCallback(async (id) => {
    try {
      const res = await put(`${API_BASE}/${id}/approve`);
      showToast(res.data?.message || 'Approved', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to approve', 'error');
      throw err;
    }
  }, [put]);

  const reject = useCallback(async (id, reason) => {
    try {
      const res = await put(`${API_BASE}/${id}/reject`, { rejectionReason: reason });
      showToast(res.data?.message || 'Rejected', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to reject', 'error');
      throw err;
    }
  }, [put]);

  const bulkApprove = useCallback(async (ids) => {
    try {
      const res = await post(`${API_BASE}/bulk-approve`, { ids });
      showToast(res.data?.message || 'Bulk approved', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed bulk approve', 'error');
      throw err;
    }
  }, [post]);

  const updateRequest = useCallback(async (id, payload) => {
    try {
      const res = await put(`${API_BASE}/${id}`, payload);
      showToast(res.data?.message || 'Updated', 'success');
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to update', 'error');
      throw err;
    }
  }, [put]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await get(`${API_BASE}/stats`);
      return res.data || res;
    } catch (err) {
      setError(err.message || err);
      showToast(err.response?.data?.error || err.message || 'Failed to load stats', 'error');
      throw err;
    }
  }, [get]);

  return {
    loading: apiLoading,
    error: error || apiError,
    fetchMyRequests,
    submitRequest,
    deleteRequest,
    fetchPending,
    approve,
    reject,
    bulkApprove,
    fetchStats,
    updateRequest,
  };
}
