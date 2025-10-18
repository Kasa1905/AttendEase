import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import StatusCard from './StatusCard';

const ImportPreviewTable = ({
  data,
  onRowSelect,
  selectedRows = [],
  className = ''
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterText, setFilterText] = useState('');

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = data.length;
    const valid = data.filter(row => !row.errors || row.errors.length === 0).length;
    const invalid = total - valid;
    const selected = selectedRows.length;

    return { total, valid, invalid, selected };
  }, [data, selectedRows]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply text filter
    if (filterText) {
      filtered = filtered.filter(row =>
        Object.values(row.data || {}).some(value =>
          String(value).toLowerCase().includes(filterText.toLowerCase())
        ) ||
        (row.errors && row.errors.some(error =>
          error.toLowerCase().includes(filterText.toLowerCase())
        ))
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'status') {
          aValue = a.errors && a.errors.length > 0 ? 'invalid' : 'valid';
          bValue = b.errors && b.errors.length > 0 ? 'invalid' : 'valid';
        } else if (sortConfig.key === 'rowNumber') {
          aValue = a.rowNumber;
          bValue = b.rowNumber;
        } else {
          aValue = (a.data && a.data[sortConfig.key]) || '';
          bValue = (b.data && b.data[sortConfig.key]) || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, filterText, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleRowToggle = (rowNumber) => {
    if (onRowSelect) {
      const isSelected = selectedRows.includes(rowNumber);
      if (isSelected) {
        onRowSelect(selectedRows.filter(id => id !== rowNumber));
      } else {
        onRowSelect([...selectedRows, rowNumber]);
      }
    }
  };

  const handleSelectAll = () => {
    if (onRowSelect) {
      const validRows = processedData
        .filter(row => !row.errors || row.errors.length === 0)
        .map(row => row.rowNumber);

      if (selectedRows.length === validRows.length) {
        onRowSelect([]);
      } else {
        onRowSelect(validRows);
      }
    }
  };

  const getStatusBadge = (row) => {
    const hasErrors = row.errors && row.errors.length > 0;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        hasErrors
          ? 'bg-red-100 text-red-800'
          : 'bg-green-100 text-green-800'
      }`}>
        {hasErrors ? 'Invalid' : 'Valid'}
      </span>
    );
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      major: 'bg-red-100 text-red-800',
      minor: 'bg-yellow-100 text-yellow-800',
      warning: 'bg-blue-100 text-blue-800'
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        colors[severity] || 'bg-gray-100 text-gray-800'
      }`}>
        {severity || 'N/A'}
      </span>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data to preview</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard
          title="Total Rows"
          value={statistics.total}
          icon="📊"
          color="bg-blue-500"
        />
        <StatusCard
          title="Valid Rows"
          value={statistics.valid}
          icon="✅"
          color="bg-green-500"
        />
        <StatusCard
          title="Invalid Rows"
          value={statistics.invalid}
          icon="❌"
          color="bg-red-500"
        />
        <StatusCard
          title="Selected"
          value={statistics.selected}
          icon="🎯"
          color="bg-purple-500"
        />
      </div>

      {/* Filter and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Filter rows..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {onRowSelect && (
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {selectedRows.length === processedData.filter(row => !row.errors || row.errors.length === 0).length
              ? 'Deselect All'
              : 'Select All Valid'
            }
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onRowSelect && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === processedData.filter(row => !row.errors || row.errors.length === 0).length && processedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('rowNumber')}
              >
                Row
                {sortConfig.key === 'rowNumber' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('email')}
              >
                Email
                {sortConfig.key === 'email' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('firstName')}
              >
                First Name
                {sortConfig.key === 'firstName' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('lastName')}
              >
                Last Name
                {sortConfig.key === 'lastName' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('role')}
              >
                Role
                {sortConfig.key === 'role' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                Status
                {sortConfig.key === 'status' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Errors
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map((row, index) => (
              <tr key={row.rowNumber || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {onRowSelect && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.rowNumber)}
                      onChange={() => handleRowToggle(row.rowNumber)}
                      disabled={row.errors && row.errors.length > 0}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.rowNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.data?.email || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.data?.firstName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.data?.lastName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.data?.role || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(row)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {row.errors && row.errors.length > 0 ? (
                    <div className="space-y-1">
                      {row.errors.slice(0, 2).map((error, idx) => (
                        <div key={idx} className="text-red-600 text-xs">
                          • {error}
                        </div>
                      ))}
                      {row.errors.length > 2 && (
                        <div className="text-gray-500 text-xs">
                          +{row.errors.length - 2} more...
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-green-600 text-xs">No errors</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processedData.length === 0 && filterText && (
        <div className="text-center py-8">
          <p className="text-gray-500">No rows match your filter criteria</p>
        </div>
      )}
    </div>
  );
};

ImportPreviewTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    rowNumber: PropTypes.number,
    data: PropTypes.object,
    errors: PropTypes.arrayOf(PropTypes.string)
  })).isRequired,
  onRowSelect: PropTypes.func,
  selectedRows: PropTypes.arrayOf(PropTypes.number),
  className: PropTypes.string
};

export default ImportPreviewTable;