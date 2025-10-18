import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useApi from '../../hooks/useApi';

export default function TeacherFilters({ filters, onFiltersChange, onReset }) {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');

  // Sync filters with URL on mount
  useEffect(() => {
    const urlFilters = {};
    for (const [key, value] of searchParams) {
      if (value) urlFilters[key] = value;
    }
    if (Object.keys(urlFilters).length > 0) {
      onFiltersChange(urlFilters);
    }
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params);
  }, [filters, setSearchParams]);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleStudentSearch = async (query) => {
    setStudentQuery(query);
    if (query.length < 2) {
      setStudentSuggestions([]);
      return;
    }
    try {
      const res = await api.get(`/users?role=student&query=${query}`);
      setStudentSuggestions(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch student suggestions', err);
    }
  };

  const selectStudent = (student) => {
    onFiltersChange({ ...filters, userId: student.id });
    setStudentQuery(`${student.firstName} ${student.lastName}`);
    setStudentSuggestions([]);
  };

  const resetFilters = () => {
    onReset();
    setStudentQuery('');
    setStudentSuggestions([]);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        <button
          onClick={resetFilters}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Reset All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Date
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To Date
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attendance Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="present_in_class">Present in Class</option>
            <option value="on_club_duty">On Club Duty</option>
            <option value="absent">Absent</option>
          </select>
        </div>

        {/* Approval Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Approval Status
          </label>
          <select
            value={filters.approvalStatus || ''}
            onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Student Selector */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student
          </label>
          <div className="relative">
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => handleStudentSearch(e.target.value)}
              placeholder="Search and select student..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {studentSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {studentSuggestions.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => selectStudent(student)}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {student.firstName} {student.lastName} ({student.email})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Student Number Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Number
          </label>
          <input
            type="number"
            value={filters.studentNumber || ''}
            onChange={(e) => handleFilterChange('studentNumber', e.target.value)}
            placeholder="Enter roll number..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Duty Duration Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Duty Duration (hours)
          </label>
          <input
            type="number"
            value={filters.minDutyDuration || ''}
            onChange={(e) => handleFilterChange('minDutyDuration', e.target.value)}
            placeholder="0"
            min="0"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={filters.sortBy || 'createdAt'}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="createdAt">Date Created</option>
            <option value="updatedAt">Last Updated</option>
            <option value="firstName">Student Name</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort Order
          </label>
          <select
            value={filters.sortOrder || 'desc'}
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        {/* Event Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event
          </label>
          <select
            value={filters.eventId || ''}
            onChange={(e) => handleFilterChange('eventId', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Events</option>
            {/* This would be populated with actual events from API */}
            <option value="1">Club Meeting</option>
            <option value="2">Workshop</option>
            <option value="3">Project Work</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null;

            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const displayValue = key.includes('date') ? new Date(value).toLocaleDateString() : value;

            return (
              <span
                key={key}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {label}: {displayValue}
                <button
                  onClick={() => handleFilterChange(key, '')}
                  className="ml-1 inline-flex items-center p-0.5 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}