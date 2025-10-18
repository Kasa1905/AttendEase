import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';

const ReportFilters = ({ filters, onFiltersChange, onApplyFilters, reportType }) => {
  const api = useApi();
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [eventSuggestions, setEventSuggestions] = useState([]);
  const [eventQuery, setEventQuery] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  // Handle student search
  const handleStudentSearch = async (query) => {
    setStudentQuery(query);
    if (query.length < 2) {
      setStudentSuggestions([]);
      return;
    }

    setIsLoadingStudents(true);
    try {
      const res = await api.get(`/users?role=student&query=${query}&limit=10`);
      setStudentSuggestions(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch student suggestions', err);
      setStudentSuggestions([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Handle event search
  const handleEventSearch = async (query) => {
    setEventQuery(query);
    if (query.length < 2) {
      setEventSuggestions([]);
      return;
    }

    setIsLoadingEvents(true);
    try {
      const res = await api.get(`/events?query=${query}&limit=10`);
      setEventSuggestions(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch event suggestions', err);
      setEventSuggestions([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Select student from suggestions
  const selectStudent = (student) => {
    handleFilterChange('userId', student.id);
    setStudentQuery(`${student.firstName} ${student.lastName}`);
    setStudentSuggestions([]);
  };

  // Select event from suggestions
  const selectEvent = (event) => {
    handleFilterChange('eventId', event.id);
    setEventQuery(event.name);
    setEventSuggestions([]);
  };

  // Clear all filters
  const clearFilters = () => {
    onFiltersChange({
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
    setStudentQuery('');
    setEventQuery('');
    setStudentSuggestions([]);
    setEventSuggestions([]);
  };

  // Preset date ranges
  const setDatePreset = (preset) => {
    const today = new Date();
    let dateFrom = '';
    let dateTo = '';

    switch (preset) {
      case 'today':
        dateFrom = dateTo = today.toISOString().slice(0, 10);
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        dateFrom = weekStart.toISOString().slice(0, 10);
        dateTo = today.toISOString().slice(0, 10);
        break;
      case 'thisMonth':
        dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        dateTo = today.toISOString().slice(0, 10);
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        dateFrom = lastMonth.toISOString().slice(0, 10);
        dateTo = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
        break;
      default:
        break;
    }

    onFiltersChange({
      ...filters,
      dateFrom,
      dateTo
    });
  };

  // Get status options based on report type
  const getStatusOptions = () => {
    switch (reportType) {
      case 'attendance':
        return [
          { value: 'present_in_class', label: 'Present in Class' },
          { value: 'on_club_duty', label: 'On Club Duty' },
          { value: 'absent', label: 'Absent' }
        ];
      case 'duty':
        return [
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' }
        ];
      default:
        return [];
    }
  };

  // Get reason options for penalty reports
  const getReasonOptions = () => [
    { value: 'missed_hourly_log', label: 'Missed Hourly Log' },
    { value: 'insufficient_duty_hours', label: 'Insufficient Duty Hours' },
    { value: 'excessive_break', label: 'Excessive Break' },
    { value: 'other', label: 'Other' }
  ];

  // Get severity options for penalty reports
  const getSeverityOptions = () => [
    { value: 'warning', label: 'Warning' },
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' }
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Report Filters</h3>
        <button
          onClick={clearFilters}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-6">
        {/* Date Range Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Date Range
          </label>

          {/* Date Presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['today', 'thisWeek', 'thisMonth', 'lastMonth'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {preset === 'today' ? 'Today' :
                 preset === 'thisWeek' ? 'This Week' :
                 preset === 'thisMonth' ? 'This Month' : 'Last Month'}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Student Filter */}
        {(reportType === 'attendance' || reportType === 'duty' || reportType === 'penalty') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => handleStudentSearch(e.target.value)}
                placeholder="Search and select student..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isLoadingStudents && (
                <div className="absolute right-3 top-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
              {studentSuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                  {studentSuggestions.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => selectStudent(student)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {student.firstName} {student.lastName} ({student.email})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Filter */}
        {(reportType === 'attendance' || reportType === 'duty') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {getStatusOptions().map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.status?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentStatus = filters.status || [];
                      if (e.target.checked) {
                        handleFilterChange('status', [...currentStatus, option.value]);
                      } else {
                        handleFilterChange('status', currentStatus.filter(s => s !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Approval Status Filter */}
        {reportType === 'attendance' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Status
            </label>
            <select
              value={filters.approvalStatus || ''}
              onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        )}

        {/* Event Filter */}
        {reportType === 'duty' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event
            </label>
            <div className="relative">
              <input
                type="text"
                value={eventQuery}
                onChange={(e) => handleEventSearch(e.target.value)}
                placeholder="Search and select event..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isLoadingEvents && (
                <div className="absolute right-3 top-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
              {eventSuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                  {eventSuggestions.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => selectEvent(event)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {event.name} ({new Date(event.date).toLocaleDateString()})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reason Filter for Penalty Reports */}
        {reportType === 'penalty' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <div className="flex flex-wrap gap-2">
              {getReasonOptions().map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.reason?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentReason = filters.reason || [];
                      if (e.target.checked) {
                        handleFilterChange('reason', [...currentReason, option.value]);
                      } else {
                        handleFilterChange('reason', currentReason.filter(r => r !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Severity Filter for Penalty Reports */}
        {reportType === 'penalty' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity
            </label>
            <div className="flex flex-wrap gap-2">
              {getSeverityOptions().map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.severity?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentSeverity = filters.severity || [];
                      if (e.target.checked) {
                        handleFilterChange('severity', [...currentSeverity, option.value]);
                      } else {
                        handleFilterChange('severity', currentSeverity.filter(s => s !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Active Status Filter */}
        {(reportType === 'duty' || reportType === 'penalty') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.isActive || ''}
              onChange={(e) => handleFilterChange('isActive', e.target.value === '' ? undefined : e.target.value === 'true')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive/Resolved</option>
            </select>
          </div>
        )}

        {/* Role Filter for Member Activity */}
        {reportType === 'member' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={filters.role || ''}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="core_team">Core Team</option>
            </select>
          </div>
        )}

        {/* Apply Filters Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onApplyFilters}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;