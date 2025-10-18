import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import useApi from '../../hooks/useApi';
import FileDropZone from '../common/FileDropZone';
import ImportPreviewTable from './ImportPreviewTable';
import ImportProgressTracker from './ImportProgressTracker';
import Button from '../common/Button';
import { useSocket } from '../../contexts/SocketContext';

const STEPS = {
  UPLOAD: 'upload',
  PREVIEW: 'preview',
  CONFIRM: 'confirm',
  PROGRESS: 'progress',
  COMPLETE: 'complete'
};

const MemberImportModal = ({ isOpen, onClose }) => {
  const api = useApi();
  const socket = useSocket();
  const [currentStep, setCurrentStep] = useState(STEPS.UPLOAD);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset modal state when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(STEPS.UPLOAD);
      setSelectedFile(null);
      setPreviewData(null);
      setSelectedRows([]);
      setBatchId(null);
      setImportResults(null);
      setError('');
    }
  }, [isOpen]);

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    setError('');
  }, []);

  const handleUploadAndPreview = useCallback(async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/users/import/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setPreviewData(response.data);
      setBatchId(response.data.batchId);

      // Join import room for real-time updates
      if (socket && response.data.batchId) {
        socket.emit('join-import-room', { batchId: response.data.batchId });
      }

      // Auto-select all valid rows
      const validRows = response.data.validRows.map(row => row.rowNumber);
      setSelectedRows(validRows);

      setCurrentStep(STEPS.PREVIEW);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process file');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, api]);

  const handleConfirmImport = useCallback(async () => {
    if (!batchId || selectedRows.length === 0) return;

    setIsLoading(true);
    setError('');

    try {
      const validRows = previewData.validRows.filter(row =>
        selectedRows.includes(row.rowNumber)
      );

      const { data } = await api.post('/users/import/confirm', {
        batchId,
        validRows,
        fileName: selectedFile.name,
        format: selectedFile.name.split('.').pop().toLowerCase()
      });

      setImportResults(data.results);
      setCurrentStep(STEPS.PROGRESS);

      // If sockets don't deliver within 10 seconds, auto-complete with response
      setTimeout(() => {
        if (!importResults) {
          setCurrentStep(STEPS.COMPLETE);
        }
      }, 10000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start import');
      setIsLoading(false);
    }
  }, [batchId, selectedRows, previewData, api, selectedFile, importResults]);

  const handleImportComplete = useCallback((results) => {
    setImportResults(results);
    setCurrentStep(STEPS.COMPLETE);
  }, []);

  const handleImportError = useCallback((error) => {
    setError(error);
    setCurrentStep(STEPS.PREVIEW);
  }, []);

  const handleDownloadTemplate = useCallback(async (format = 'csv') => {
    try {
      const response = await api.get(`/users/import/template?format=${format}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `member_import_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  }, [api]);

  const handleRetry = useCallback(() => {
    setCurrentStep(STEPS.UPLOAD);
    setSelectedFile(null);
    setPreviewData(null);
    setSelectedRows([]);
    setBatchId(null);
    setImportResults(null);
    setError('');
  }, []);

  const renderStepIndicator = () => {
    const steps = [
      { key: STEPS.UPLOAD, label: 'Upload', icon: '📁' },
      { key: STEPS.PREVIEW, label: 'Preview', icon: '👁️' },
      { key: STEPS.CONFIRM, label: 'Confirm', icon: '✅' },
      { key: STEPS.PROGRESS, label: 'Import', icon: '⚙️' },
      { key: STEPS.COMPLETE, label: 'Complete', icon: '🎉' }
    ];

    return (
      <div className="flex items-center justify-center mb-6">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              currentStep === step.key
                ? 'bg-blue-600 text-white'
                : Object.values(STEPS).indexOf(currentStep) > index
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {Object.values(STEPS).indexOf(currentStep) > index ? '✓' : step.icon}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-1 ${
                Object.values(STEPS).indexOf(currentStep) > index
                  ? 'bg-green-600'
                  : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Member Data</h3>
        <p className="text-sm text-gray-600">
          Upload a CSV or Excel file containing member information. The file should include columns for email, firstName, lastName, and role.
        </p>
      </div>

      <FileDropZone
        onFileSelect={handleFileSelect}
        acceptedTypes={['.csv', '.xlsx']}
        maxSize={10 * 1024 * 1024} // 10MB
        placeholder="Drag and drop your member data file here"
      />

      {selectedFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">File selected: {selectedFile.name}</p>
              <p className="text-xs text-blue-600">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <Button
            onClick={() => handleDownloadTemplate('csv')}
            variant="secondary"
            size="sm"
          >
            Download CSV Template
          </Button>
          <Button
            onClick={() => handleDownloadTemplate('xlsx')}
            variant="secondary"
            size="sm"
          >
            Download Excel Template
          </Button>
        </div>
        <Button
          onClick={handleUploadAndPreview}
          disabled={!selectedFile || isLoading}
          loading={isLoading}
        >
          {isLoading ? 'Processing...' : 'Next: Preview Data'}
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Import Data</h3>
        <p className="text-sm text-gray-600">
          Review the data before importing. Invalid rows are highlighted in red. You can exclude problematic rows from the import.
        </p>
      </div>

      {previewData && (
        <ImportPreviewTable
          data={[...previewData.validRows, ...previewData.invalidRows]}
          onRowSelect={setSelectedRows}
          selectedRows={selectedRows}
        />
      )}

      <div className="flex justify-between">
        <Button onClick={() => setCurrentStep(STEPS.UPLOAD)} variant="secondary">
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep(STEPS.CONFIRM)}
          disabled={selectedRows.length === 0}
        >
          Next: Confirm Import
        </Button>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Import</h3>
        <p className="text-sm text-gray-600">
          You're about to import {selectedRows.length} users. This action cannot be undone.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Import Summary
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>{selectedRows.length}</strong> users will be imported</li>
                <li>Welcome emails will be sent to new users</li>
                <li>Duplicate users will be skipped</li>
                <li>This process may take several minutes for large imports</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={() => setCurrentStep(STEPS.PREVIEW)} variant="secondary">
          Back
        </Button>
        <Button
          onClick={handleConfirmImport}
          loading={isLoading}
          className="bg-green-600 hover:bg-green-700"
        >
          {isLoading ? 'Starting Import...' : 'Start Import'}
        </Button>
      </div>
    </div>
  );

  const renderProgressStep = () => (
    <div className="space-y-6">
      <ImportProgressTracker
        batchId={batchId}
        socket={socket}
        onComplete={handleImportComplete}
        onError={handleImportError}
      />
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-2 text-lg font-medium text-gray-900">Import Completed!</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your member data has been successfully imported.
        </p>
      </div>

      {importResults && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-green-800 mb-2">Import Results</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-green-700">Successful:</span>
              <span className="ml-2 font-medium">{importResults.successful || 0}</span>
            </div>
            <div>
              <span className="text-red-700">Failed:</span>
              <span className="ml-2 font-medium">{importResults.failed || 0}</span>
            </div>
            <div>
              <span className="text-blue-700">Success Rate:</span>
              <span className="ml-2 font-medium">
                {importResults.totalProcessed ?
                  Math.round((importResults.successful / importResults.totalProcessed) * 100) : 0}%
              </span>
            </div>
            <div>
              <span className="text-gray-700">Total Processed:</span>
              <span className="ml-2 font-medium">{importResults.totalProcessed || 0}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <Button onClick={handleRetry} variant="secondary">
          Import More Users
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                {renderStepIndicator()}

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {currentStep === STEPS.UPLOAD && renderUploadStep()}
                {currentStep === STEPS.PREVIEW && renderPreviewStep()}
                {currentStep === STEPS.CONFIRM && renderConfirmStep()}
                {currentStep === STEPS.PROGRESS && renderProgressStep()}
                {currentStep === STEPS.COMPLETE && renderCompleteStep()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

MemberImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default MemberImportModal;