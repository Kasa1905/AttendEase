import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import Button from '../common/Button';
import { showToast } from '../../utils/helpers';

export default function StrikeManagement() {
  const api = useApi();
  const [strikes, setStrikes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStrikes, setSelectedStrikes] = useState([]);
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
      setStatistics(res.data?.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleResolveStrike = async (strikeId, resolutionNotes = 'Resolved by core team') => {
    try {
      await api.put(`/strikes/${strikeId}/resolve`, { resolutionNotes });
      setStrikes(prev => prev.map(strike =>
        strike.id === strikeId
          ? { ...strike, status: 'resolved', resolutionNotes, resolvedAt: new Date().toISOString() }
          : strike
      ));
      showToast('Strike resolved successfully', 'success');
      loadStatistics(); // Refresh stats
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to resolve strike';
      showToast(msg, 'error');
    }
  };

  const handleBulkResolve = async () => {
    if (selectedStrikes.length === 0) {
      showToast('Please select strikes to resolve', 'warning');
      return;
    }

    try {
      await api.post('/strikes/bulk-resolve', {
        strikeIds: selectedStrikes,
        resolutionNotes: 'Bulk resolved by core team'
      });

      setStrikes(prev => prev.map(strike =>
        selectedStrikes.includes(strike.id)
          ? { ...strike, status: 'resolved', resolutionNotes: 'Bulk resolved by core team', resolvedAt: new Date().toISOString() }
          : strike
      ));

      setSelectedStrikes([]);
      showToast(`Resolved ${selectedStrikes.length} strikes successfully`, 'success');
      loadStatistics(); // Refresh stats
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to resolve strikes';
      showToast(msg, 'error');
    }
  };

  const toggleStrikeSelection = (strikeId) => {
    setSelectedStrikes(prev =>
      prev.includes(strikeId)
        ? prev.filter(id => id !== strikeId)
        : [...prev, strikeId]
    );
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
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Strike Management</h2>
        {selectedStrikes.length > 0 && (
          <Button
            onClick={handleBulkResolve}
            className="bg-green-600 hover:bg-green-700 text-white"
            loading={loading}
          >
            Resolve Selected ({selectedStrikes.length})
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.totalStrikes}</div>
            <div className="text-sm text-blue-800">Total Strikes</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{statistics.activeStrikes}</div>
            <div className="text-sm text-red-800">Active Strikes</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.resolvedStrikes}</div>
            <div className="text-sm text-green-800">Resolved Strikes</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{statistics.usersWithStrikes}</div>
            <div className="text-sm text-yellow-800">Users with Strikes</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
        </select>

        <input
          type="text"
          placeholder="Filter by User ID"
          value={filters.userId}
          onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <Button onClick={loadStrikes} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Strikes List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading strikes...</p>
        </div>
      ) : strikes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Strikes Found</h3>
          <p className="text-gray-500">No strikes match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {strikes.map((strike) => (
            <div key={strike.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedStrikes.includes(strike.id)}
                  onChange={() => toggleStrikeSelection(strike.id)}
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{strike.reason}</h3>
                      <p className="text-sm text-gray-600">User ID: {strike.userId}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        strike.status === 'active' ? 'text-red-600 bg-red-100' :
                        strike.status === 'resolved' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                      }`}>
                        {strike.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Strike #{strike.strikeCountAtTime}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{strike.description}</p>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Created: {formatDate(strike.createdAt)}</p>
                    {strike.resolvedAt && <p>Resolved: {formatDate(strike.resolvedAt)}</p>}
                    {strike.resolution && <p>Resolution: {strike.resolution}</p>}
                  </div>
                </div>

                {strike.status === 'active' && (
                  <Button
                    onClick={() => handleResolveStrike(strike.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm"
                    loading={loading}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}