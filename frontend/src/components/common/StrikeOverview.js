import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { Link } from 'react-router-dom';

export default function StrikeOverview({ compact = false }) {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [recentStrikes, setRecentStrikes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, strikesRes] = await Promise.all([
        api.get('/strikes/statistics'),
        api.get('/strikes/history', { params: { limit: compact ? 3 : 5 } })
      ]);

      setStats(statsRes.data);
      setRecentStrikes(strikesRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load strike overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      return diffInHours === 0 ? 'Just now' : `${diffInHours}h ago`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} bg-white rounded-lg shadow-md`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-4' : 'p-6'} bg-white rounded-lg shadow-md`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-gray-800`}>
          Strike Overview
        </h3>
        {!compact && (
          <Link
            to="/strikes"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All →
          </Link>
        )}
      </div>

      {stats && (
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-4 mb-6`}>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.activeStrikes > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.activeStrikes}
            </div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalStrikes}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          {!compact && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.resolvedStrikes}</div>
                <div className="text-xs text-gray-600">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.usersWithStrikes}</div>
                <div className="text-xs text-gray-600">Affected Users</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Recent Strikes */}
      {recentStrikes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Recent Activity
          </h4>
          <div className="space-y-3">
            {recentStrikes.map((strike) => (
              <div key={strike.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {strike.reason}
                  </p>
                  <p className="text-xs text-gray-500">
                    User {strike.userId} • {formatDate(strike.createdAt)}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  strike.status === 'active' ? 'text-red-600 bg-red-100' :
                  strike.status === 'resolved' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                }`}>
                  {strike.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!stats || stats.totalStrikes === 0) && (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-gray-500 text-sm">No strikes recorded</p>
        </div>
      )}
    </div>
  );
}