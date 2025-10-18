import React, { useState } from 'react';
import StatusCard from '../components/common/StatusCard';
import RequestApprovalInterface from '../components/core-team/RequestApprovalInterface';
import RequestStats from '../components/core-team/RequestStats';
import StrikeManagement from '../components/core-team/StrikeManagement';
import StrikeOverview from '../components/common/StrikeOverview';
import QuickExportCard from '../components/reports/QuickExportCard';
import ReportGenerator from '../components/reports/ReportGenerator';
import MemberImportModal from '../components/core-team/MemberImportModal';
import { useAuth } from '../contexts/AuthContext';

export default function CoreTeamDashboard(){
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showImportModal, setShowImportModal] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'members', label: 'Member Management', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📋' },
    { id: 'strikes', label: 'Strike Management', icon: '⚠️' }
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
      title: 'Penalty Report',
      description: 'Strike and penalty records with resolution tracking',
      icon: '⚠️',
      color: 'bg-red-500',
      reportType: 'penalty',
      filters: {
        isActive: 'true'
      }
    },
    {
      title: 'Member Activity',
      description: 'Comprehensive member engagement analysis',
      icon: '👥',
      color: 'bg-purple-500',
      reportType: 'member',
      filters: {}
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Core Team Dashboard</h1>
              <div className="ml-4 text-sm text-gray-600">
                Welcome back, {user?.firstName} {user?.lastName}
              </div>
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
                onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <StatusCard title="Active Sessions" value="-" />
              <StatusCard title="Pending Requests" value="-" />
              <StatusCard title="Alerts" value="-" />
              <StatusCard title="Recent Imports" value="0" />
              <div className="col-span-1">
                <StrikeOverview compact={true} />
              </div>
            </div>

            {/* Quick Export Cards */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Exports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickExportCards.map((card, index) => (
                  <QuickExportCard
                    key={index}
                    title={card.title}
                    description={card.description}
                    icon={card.icon}
                    color={card.color}
                    reportType={card.reportType}
                    filters={card.filters}
                    userRole="core_team"
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2"><RequestApprovalInterface /></div>
              <div><RequestStats /></div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Member Management Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Member Management</h2>
                  <p className="text-gray-600 mt-1">Import and manage club members in bulk</p>
                </div>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                >
                  <span className="mr-2">📤</span>
                  Import Members
                </button>
              </div>
            </div>

            {/* Member Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Total Members</h3>
                    <p className="text-gray-600">Active club members</p>
                    <p className="text-2xl font-bold text-green-600">-</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Last Import</h3>
                    <p className="text-gray-600">Most recent bulk import</p>
                    <p className="text-sm font-medium text-blue-600">No recent imports</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <span className="text-2xl">📋</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Import Templates</h3>
                    <p className="text-gray-600">Download import templates</p>
                    <div className="flex space-x-2 mt-2">
                      <button className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                        CSV Template
                      </button>
                      <button className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                        Excel Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Import History */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Import History</h3>
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-2 block">📋</span>
                <p>No import history available</p>
                <p className="text-sm">Import history will appear here after your first bulk import</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <ReportGenerator userRole="core_team" />
        )}

        {activeTab === 'strikes' && (
          <StrikeManagement />
        )}
      </div>

      {/* Member Import Modal */}
      <MemberImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
