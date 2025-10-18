import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';
import ReportFilters from './ReportFilters';
import ExportButton from './ExportButton';
import ReportPreview from './ReportPreview';

const ReportGenerator = ({ userRole }) => {
  const api = useApi();
  const [selectedReportType, setSelectedReportType] = useState('');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    userId: '',
    status: [],
    approvalStatus: '',
    eventId: '',
    isActive: '',
    reason: [],
    severity: [],
    role: ''
  });
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Report type options based on user role
  const getReportTypes = () => {
    const baseTypes = [
      {
        id: 'attendance',
        title: 'Attendance Summary',
        description: 'Comprehensive attendance records with approval status and statistics',
        icon: '📊',
        color: 'bg-blue-500'
      },
      {
        id: 'duty',
        title: 'Duty Session Report',
        description: 'Detailed duty session logs with hourly breakdowns and duration analysis',
        icon: '⏰',
        color: 'bg-green-500'
      }
    ];

    if (userRole === 'core_team') {
      baseTypes.push(
        {
          id: 'penalty',
          title: 'Penalty Report',
          description: 'Strike and penalty records with resolution tracking',
          icon: '⚠️',
          color: 'bg-red-500'
        },
        {
          id: 'member',
          title: 'Member Activity',
          description: 'Comprehensive member engagement and activity analysis',
          icon: '👥',
          color: 'bg-purple-500'
        }
      );
    }

    if (userRole === 'teacher') {
      baseTypes.push({
        id: 'daily',
        title: 'Daily Summary',
        description: 'Teacher-specific daily attendance and duty session summaries',
        icon: '📅',
        color: 'bg-orange-500'
      });
    }

    return baseTypes;
  };

  // Handle report type selection
  const handleReportTypeSelect = (reportType) => {
    setSelectedReportType(reportType);
    setReportData(null);
    setShowPreview(false);
    setError('');
    // Reset filters when changing report type
    setFilters({
      dateFrom: '',
      dateTo: '',
      userId: '',
      status: [],
      approvalStatus: '',
      eventId: '',
      isActive: '',
      reason: [],
      severity: [],
      role: ''
    });
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Apply filters and generate report preview
  const handleApplyFilters = async () => {
    if (!selectedReportType) {
      setError('Please select a report type first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/reports/preview', {
        reportType: selectedReportType,
        filters: filters,
        limit: 50
      });

      setReportData(response.data.data);
      setShowPreview(true);
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || 'Failed to generate report preview';
      setError(errorMessage);
      setShowPreview(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export
  const handleExport = async (format) => {
    if (!selectedReportType || !reportData) {
      setError('Please generate a report preview first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await api.post(`/reports/export/${format}`, {
        reportType: selectedReportType,
        filters: filters
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `club-attendance-${selectedReportType}-report-${timestamp}.${format === 'excel' ? 'xlsx' : format}`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || 'Failed to export report';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get report statistics for display
  const getReportStats = () => {
    if (!reportData) return null;

    const { statistics, totalRecords } = reportData;

    switch (selectedReportType) {
      case 'attendance':
        return {
          total: totalRecords,
          approved: statistics.approved,
          pending: statistics.pending,
          approvalRate: statistics.approvalRate
        };
      case 'duty':
        return {
          total: totalRecords,
          active: statistics.active,
          totalHours: statistics.totalHours,
          averageHours: statistics.averageHours
        };
      case 'penalty':
        return {
          total: totalRecords,
          active: statistics.active,
          resolved: statistics.resolved
        };
      case 'member':
        return {
          total: statistics.totalMembers,
          averageAttendance: statistics.averageAttendanceRate,
          totalDutyHours: statistics.totalDutyHours
        };
      case 'daily':
        return {
          attendanceRecords: statistics.totalAttendance,
          dutySessions: statistics.totalDutySessions,
          pendingApprovals: statistics.pendingApprovals
        };
      default:
        return null;
    }
  };

  const reportTypes = getReportTypes();
  const reportStats = getReportStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Generator</h1>
            <p className="text-gray-600 mt-1">Generate comprehensive reports for attendance, duty sessions, and penalties</p>
          </div>
          {selectedReportType && (
            <button
              onClick={() => handleReportTypeSelect('')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Report Types
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!selectedReportType ? (
        /* Report Type Selection */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((reportType) => (
            <div
              key={reportType.id}
              onClick={() => handleReportTypeSelect(reportType.id)}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-gray-300"
            >
              <div className="flex items-center mb-4">
                <div className={`w-12 h-12 ${reportType.color} rounded-lg flex items-center justify-center text-white text-xl`}>
                  {reportType.icon}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">{reportType.title}</h3>
                </div>
              </div>
              <p className="text-gray-600 text-sm">{reportType.description}</p>
              <div className="mt-4 flex items-center text-blue-600 font-medium">
                <span>Select Report</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Report Configuration */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Panel */}
          <div className="lg:col-span-1">
            <ReportFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onApplyFilters={handleApplyFilters}
              reportType={selectedReportType}
            />
          </div>

          {/* Report Preview and Export */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Statistics */}
            {reportStats && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(reportStats).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{value}</div>
                      <div className="text-sm text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Options */}
            {showPreview && reportData && selectedReportType !== 'member' && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
                <div className="flex flex-wrap gap-3">
                  <ExportButton
                    format="pdf"
                    onExport={handleExport}
                    isLoading={isGenerating}
                    disabled={isGenerating}
                  />
                  <ExportButton
                    format="excel"
                    onExport={handleExport}
                    isLoading={isGenerating}
                    disabled={isGenerating}
                  />
                  {selectedReportType !== 'daily' && (
                    <ExportButton
                      format="csv"
                      onExport={handleExport}
                      isLoading={isGenerating}
                      disabled={isGenerating}
                    />
                  )}
                </div>
                {isGenerating && (
                  <div className="mt-4 flex items-center text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Generating report...
                  </div>
                )}
              </div>
            )}

            {/* Report Preview */}
            {showPreview && reportData && (
              <ReportPreview
                reportData={reportData}
                reportType={selectedReportType}
                isLoading={isLoading}
              />
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Generating report preview...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;