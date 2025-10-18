import React, { useState } from 'react';

export default function QuickActions({ selectedRecords, onBulkApprove, onBulkReject }) {
  const [loading, setLoading] = useState(false);

  const handleBulkApprove = async () => {
    if (selectedRecords.size === 0) {
      return;
    }

    setLoading(true);
    try {
      await onBulkApprove();
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRecords.size === 0) {
      return;
    }

    setLoading(true);
    try {
      await onBulkReject();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>

      {/* Bulk Actions for Selected Records */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Bulk Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBulkApprove}
            disabled={loading || selectedRecords.size === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Processing...' : `Approve Selected (${selectedRecords.size})`}
          </button>
          <button
            onClick={handleBulkReject}
            disabled={loading || selectedRecords.size === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Processing...' : `Reject Selected (${selectedRecords.size})`}
          </button>
        </div>
        {selectedRecords.size === 0 && (
          <p className="text-sm text-gray-500 mt-2">Select records to enable bulk actions</p>
        )}
      </div>

      {/* Coming Soon Features */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Features</h4>
        <div className="space-y-2">
          <button
            disabled
            className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm cursor-not-allowed"
            title="Coming soon"
          >
            Export Data
          </button>
          <button
            disabled
            className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm cursor-not-allowed"
            title="Coming soon"
          >
            Generate Report
          </button>
          <button
            disabled
            className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm cursor-not-allowed"
            title="Coming soon"
          >
            Send Reminders
          </button>
        </div>
      </div>
    </div>
  );
}