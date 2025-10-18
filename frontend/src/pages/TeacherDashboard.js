import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import DailyLogViewer from '../components/teacher/DailyLogViewer';
import AttendanceApprovalInterface from '../components/teacher/AttendanceApprovalInterface';
import TeacherFilters from '../components/teacher/TeacherFilters';
import QuickActions from '../components/teacher/QuickActions';
import AttendanceDetailModal from '../components/teacher/AttendanceDetailModal';
import StrikeOverview from '../components/teacher/StrikeOverview';
import QuickExportCard from '../components/reports/QuickExportCard';
import ReportGenerator from '../components/reports/ReportGenerator';
import { showToast } from '../utils/helpers';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const {
    dailyData,
    pendingRecords,
    filteredRecords,
    selectedRecords,
    loading,
    actionLoading,
    filters,
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
    detailModal,
    openDetailModal,
    closeDetailModal
  } = useTeacherDashboard();

  const [activeTab, setActiveTab] = useState('daily-logs');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    // Load initial data
    loadPendingRecords();
    loadDailyData(selectedDate);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    loadDailyData(date);
  };

  const handleBulkApprove = async () => {
    if (selectedRecords.size === 0) {
      showToast('Please select records to approve', 'warning');
      return;
    }

    try {
      await bulkApprove(Array.from(selectedRecords));
    } catch (err) {
      // Error already handled in hook
    }
  };

  const handleBulkReject = async () => {
    if (selectedRecords.size === 0) {
      showToast('Please select records to reject', 'warning');
      return;
    }

    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    try {
      await bulkReject(Array.from(selectedRecords), rejectReason);
    } catch (err) {
      // Error already handled in hook
    } finally {
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  const handleRefresh = () => {
    refreshData();
    loadDailyData(selectedDate);
  };

  const tabs = [
    { id: 'daily-logs', label: 'Daily Logs', icon: '📊' },
    { id: 'approvals', label: 'Attendance Approvals', icon: '✅' },
    { id: 'reports', label: 'Reports', icon: '📋' },
    { id: 'filters', label: 'Advanced Filters', icon: '🔍' },
    { id: 'actions', label: 'Quick Actions', icon: '⚡' },
    { id: 'strikes', label: 'Strike Overview', icon: '⚠️' }
  ];

  const quickExportCards = [
    {
      title: 'Attendance Summary',
      description: 'Complete attendance records with approval status',
      icon: '📊',
      color: 'bg-blue-500',
      reportType: 'attendance',
      filters: {
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10)
      }
    },
    {
      title: 'Duty Session Report',
      description: 'Detailed duty logs with hourly breakdowns',
      icon: '⏰',
      color: 'bg-green-500',
      reportType: 'duty',
      filters: {
        dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10)
      }
    },
    {
      title: 'Daily Summary',
      description: 'Teacher-specific daily attendance and duty summaries',
      icon: '📅',
      color: 'bg-orange-500',
      reportType: 'daily',
      filters: {
        dateFrom: new Date().toISOString().slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10)
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
              <div className="ml-4 text-sm text-gray-600">
                Welcome back, {user?.firstName} {user?.lastName}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Pending Approvals: <span className="font-semibold text-blue-600">{pendingRecords.length}</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bulk Actions Bar (when records are selected) */}
        {selectedRecords.size > 0 && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-800">
                {selectedRecords.size} record{selectedRecords.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={actionLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading ? 'Approving...' : 'Approve Selected'}
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={actionLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Selected'}
                </button>
                <button
                  onClick={clearSelection}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'daily-logs' && (
            <div>
              {/* Quick Export Cards */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Exports</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickExportCards.map((card, index) => (
                    <QuickExportCard
                      key={index}
                      title={card.title}
                      description={card.description}
                      icon={card.icon}
                      color={card.color}
                      reportType={card.reportType}
                      filters={card.filters}
                      userRole="teacher"
                    />
                  ))}
                </div>
              </div>
              <DailyLogViewer
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
              />
            </div>
          )}

          {activeTab === 'approvals' && (
            <AttendanceApprovalInterface
              records={filteredRecords}
              loading={loading}
              onApprove={approveRecord}
              onReject={rejectRecord}
              onSelectRecord={toggleRecordSelection}
              onSelectAll={selectAllRecords}
              selectedRecords={selectedRecords}
              onViewDetails={openDetailModal}
            />
          )}

          {activeTab === 'reports' && (
            <ReportGenerator userRole="teacher" />
          )}

          {activeTab === 'filters' && (
            <TeacherFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={resetFilters}
            />
          )}

          {activeTab === 'actions' && (
            <QuickActions
              selectedRecords={selectedRecords}
              onBulkApprove={handleBulkApprove}
              onBulkReject={handleBulkReject}
            />
          )}

          {activeTab === 'strikes' && (
            <StrikeOverview />
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AttendanceDetailModal
        recordId={detailModal.recordId}
        isOpen={detailModal.isOpen}
        onClose={closeDetailModal}
      />

      {/* Loading Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Processing...</span>
            </div>
          </div>
        </div>
      )}

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
                }}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
