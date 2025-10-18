import React from 'react';
import useStrikes from '../../hooks/useStrikes';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import { showToast } from '../../utils/helpers';

export default function StrikeHistory() {
  const { strikes, activeStrikeCount, loading, error, resolveStrike, loadPage, page, total, pageSize } = useStrikes();
  const { isCoreTeam, isTeacher } = useAuth();
  const canResolveStrikes = isCoreTeam() || isTeacher();

  const handleResolve = async (strikeId) => {
    try {
      await resolveStrike(strikeId, 'Resolved by user');
      showToast('Strike resolved successfully', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to resolve strike';
      showToast(msg, 'error');
    }
  };

  const getStrikeSeverity = (count) => {
    if (count >= 5) return { color: 'text-red-600', label: 'Critical' };
    if (count >= 3) return { color: 'text-orange-600', label: 'Warning' };
    return { color: 'text-yellow-600', label: 'Minor' };
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
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Strike History</h2>
          <p className="text-gray-600 mt-1">
            Active Strikes: <span className={`font-semibold ${activeStrikeCount >= 3 ? 'text-red-600' : activeStrikeCount >= 1 ? 'text-orange-600' : 'text-green-600'}`}>
              {activeStrikeCount}
            </span>
          </p>
        </div>
        {activeStrikeCount >= 3 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm font-medium">⚠️ Warning: Multiple active strikes</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error.message || 'Failed to load strikes'}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading strikes...</p>
        </div>
      ) : strikes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Strikes</h3>
          <p className="text-gray-500">Great job! You have no active strikes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {strikes.map((strike) => {
            const severity = getStrikeSeverity(strike.strikeCountAtTime);
            return (
              <div key={strike.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severity.color} bg-gray-100`}>
                        {severity.label} Strike #{strike.strikeCountAtTime}
                      </span>
                      <span className={`text-sm font-medium ${
                        strike.status === 'active' ? 'text-red-600' :
                        strike.status === 'resolved' ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {strike.status === 'active' ? 'Active' :
                         strike.status === 'resolved' ? 'Resolved' : 'Unknown'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1">{strike.reason}</h3>
                    <p className="text-sm text-gray-600 mb-2">{strike.description}</p>

                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Created: {formatDate(strike.createdAt)}</p>
                      {strike.resolvedAt && <p>Resolved: {formatDate(strike.resolvedAt)}</p>}
                      {strike.resolution && <p>Resolution: {strike.resolution}</p>}
                    </div>
                  </div>

                  <div className="ml-4">
                    {strike.status === 'active' && canResolveStrikes && (
                      <Button
                        onClick={() => handleResolve(strike.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm"
                        loading={loading}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center items-center mt-6 space-x-2">
          <Button
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1 text-sm"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <Button
            onClick={() => loadPage(page + 1)}
            disabled={page >= Math.ceil(total / pageSize) || loading}
            className="px-3 py-1 text-sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}