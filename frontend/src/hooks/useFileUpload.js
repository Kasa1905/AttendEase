import { useState, useCallback } from 'react';
import useApi from './useApi';
import { useSocket } from '../contexts/SocketContext';

const useFileUpload = () => {
  const api = useApi();
  const socket = useSocket();
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    progress: 0,
    error: null,
    result: null
  });

  const uploadFile = useCallback(async (endpoint, file, options = {}) => {
    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      result: null
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Add additional form data if provided
      if (options.additionalData) {
        Object.entries(options.additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadState(prev => ({
            ...prev,
            progress: percentCompleted
          }));
        },
        ...options
      });

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        result: response.data
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        result: null
      });
      throw error;
    }
  }, [api]);

  const uploadImportFile = useCallback(async (file) => {
    return uploadFile('/users/import/preview', file);
  }, [uploadFile]);

  const confirmImport = useCallback(async (batchId, validRows) => {
    setUploadState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const response = await api.post('/users/import/confirm', {
        batchId,
        validRows
      });

      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        result: response.data
      }));

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Import confirmation failed';
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [api]);

  const downloadTemplate = useCallback(async (format = 'csv') => {
    try {
      const response = await api.get(`/users/import/template?format=${format}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `member_import_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        error: 'Failed to download template'
      }));
      throw error;
    }
  }, [api]);

  const getImportHistory = useCallback(async (params = {}) => {
    try {
      const response = await api.get('/users/import/history', { params });
      return response.data;
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        error: 'Failed to fetch import history'
      }));
      throw error;
    }
  }, [api]);

  const resetUploadState = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      result: null
    });
  }, []);

  return {
    uploadState,
    uploadFile,
    uploadImportFile,
    confirmImport,
    downloadTemplate,
    getImportHistory,
    resetUploadState
  };
};

export default useFileUpload;