import React, { useState } from 'react';
import useApi from '../../hooks/useApi';

const QuickExportCard = ({ title, description, icon, color, reportType, filters, userRole }) => {
  const api = useApi();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const handleQuickExport = async (format) => {
    setIsExporting(true);
    setError('');

    try {
      const response = await api.post(`/reports/export/${format}`, {
        reportType,
        filters
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `club-${reportType}-${timestamp}.${format === 'excel' ? 'xlsx' : format}`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || 'Export failed';
      setError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white text-lg`}>
            {icon}
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600">{description}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={() => handleQuickExport('pdf')}
          disabled={isExporting}
          className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
              PDF
            </div>
          ) : (
            'PDF'
          )}
        </button>
        <button
          onClick={() => handleQuickExport('excel')}
          disabled={isExporting}
          className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
              Excel
            </div>
          ) : (
            'Excel'
          )}
        </button>
        <button
          onClick={() => handleQuickExport('csv')}
          disabled={isExporting}
          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
              CSV
            </div>
          ) : (
            'CSV'
          )}
        </button>
      </div>
    </div>
  );
};

export default QuickExportCard;