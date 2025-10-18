import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { showToast } from '../../utils/helpers';

export default function StrikeOverview() {
  const api = useApi();
  const [strikes, setStrikes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    userId: '',
    page: 1,
    pageSize: 20
  });

  // Load strikes
  useEffect(() => {
    loadStrikes();
  }, [filters]);

  // Load statistics
  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStrikes = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (params.status === 'all') delete params.status;
      if (!params.userId) delete params.userId;

      const res = await api.get('/strikes', { params });
      setStrikes(res.data?.data || []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load strikes';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const res = await api.get('/strikes/statistics');
      setStatistics(res.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const getStrikeReasonColor = (reason) => {
    const colors = {
      missed_hourly_log: 'bg-yellow-100 text-yellow-800',
      insufficient_duty_hours: 'bg-orange-100 text-orange-800',
      excessive_break: 'bg-red-100 text-red-800'
    };
    return colors[reason] || 'bg-gray-100 text-gray-800';
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

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total Strikes</h3>
          <p className="text-2xl font-bold text-blue-600">{statistics?.data?.totalStrikes || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Active Strikes</h3>
          <p className="text-2xl font-bold text-red-600">{statistics?.data?.activeStrikes || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Resolved Strikes</h3>
          <p className="text-2xl font-bold text-green-600">{statistics?.data?.resolvedStrikes || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Students with Strikes</h3>
          <p className="text-2xl font-bold text-purple-600">{statistics?.data?.usersWithStrikes || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              placeholder="Enter student ID"
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Strikes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Strike Records</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading strikes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {strikes.map((strike) => (
                  <tr key={strike.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {strike.user?.firstName} {strike.user?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{strike.user?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStrikeReasonColor(strike.reason)}`}>
                        {strike.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        strike.status === 'active'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {strike.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(strike.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {strike.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {strikes.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No strikes found matching the current filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}