import React, { useState, useMemo } from 'react';
import { useOffline } from '../../contexts/OfflineContext.js';
import Button from './Button.js';

export default function OfflineDataViewer({ isOpen, onClose }) {
  const { offlineData, loadOfflineData } = useOffline();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredData = useMemo(() => {
    let data = Object.entries(offlineData);

    // Filter by type
    if (filter !== 'all') {
      data = data.filter(([key, value]) => {
        if (filter === 'attendance') return key.includes('attendance');
        if (filter === 'duty_session') return key.includes('duty_session');
        if (filter === 'hourly_log') return key.includes('hourly_log');
        if (filter === 'pending') return !value.synced;
        if (filter === 'synced') return value.synced;
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      data = data.filter(([key, value]) =>
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(value.data).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort data
    data.sort((a, b) => {
      const [keyA, valueA] = a;
      const [keyB, valueB] = b;

      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = valueA.timestamp - valueB.timestamp;
          break;
        case 'type':
          comparison = keyA.localeCompare(keyB);
          break;
        case 'size':
          comparison = JSON.stringify(valueA.data).length - JSON.stringify(valueB.data).length;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [offlineData, filter, searchTerm, sortBy, sortOrder]);

  const getDataTypeIcon = (key) => {
    if (key.includes('attendance')) return '📝';
    if (key.includes('duty_session')) return '⏰';
    if (key.includes('hourly_log')) return '📊';
    return '📄';
  };

  const getSyncStatusBadge = (synced) => {
    return synced ? (
      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Synced</span>
    ) : (
      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Pending</span>
    );
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDataSize = (data) => {
    const size = JSON.stringify(data).length;
    if (size < 1024) return `${size} B`;
    return `${(size / 1024).toFixed(1)} KB`;
  };

  const calculateDataFreshness = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleRefresh = () => {
    loadOfflineData();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(offlineData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `offline-data-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Offline Data Viewer</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">All Data</option>
              <option value="attendance">Attendance</option>
              <option value="duty_session">Duty Sessions</option>
              <option value="hourly_log">Hourly Logs</option>
              <option value="pending">Pending Sync</option>
              <option value="synced">Synced</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="timestamp">Timestamp</option>
              <option value="type">Type</option>
              <option value="size">Size</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 border rounded text-sm"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="flex-1 min-w-48">
            <input
              type="text"
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-1 text-sm"
            />
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleRefresh} className="text-sm py-1">
              Refresh
            </Button>
            <Button onClick={handleExport} variant="secondary" className="text-sm py-1">
              Export
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Freshness</th>
                <th className="px-4 py-2 text-left">Size</th>
                <th className="px-4 py-2 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No offline data found
                  </td>
                </tr>
              ) : (
                filteredData.map(([key, value]) => (
                  <tr key={key} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <span>{getDataTypeIcon(key)}</span>
                        <span className="capitalize">
                          {key.split('_').slice(0, -1).join(' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{key}</td>
                    <td className="px-4 py-2">{getSyncStatusBadge(value.synced)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {calculateDataFreshness(value.timestamp)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDataSize(value.data)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatTimestamp(value.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-gray-600">
          <div>
            Showing {filteredData.length} of {Object.keys(offlineData).length} records
          </div>
          <div>
            Total storage: ~{(JSON.stringify(offlineData).length / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
    </div>
  );
}