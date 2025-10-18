import { useState, useCallback } from 'react';
import useApi from './useApi';

const useReports = () => {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  // Generate report preview
  const generateReportPreview = useCallback(async (reportType, filters) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/reports/preview', {
        reportType,
        filters,
        limit: 50
      });

      setReportData(response.data.data);
      return response.data.data;
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || 'Failed to generate report preview';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Export report
  const exportReport = useCallback(async (reportType, filters, format) => {
    setLoading(true);
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
      const filename = `club-attendance-${reportType}-report-${timestamp}.${format === 'excel' ? 'xlsx' : format}`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || 'Failed to export report';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Clear error
  const clearError = useCallback(() => {
    setError('');
  }, []);

  // Clear report data
  const clearReportData = useCallback(() => {
    setReportData(null);
  }, []);

  return {
    loading,
    error,
    reportData,
    generateReportPreview,
    exportReport,
    clearError,
    clearReportData
  };
};

export default useReports;