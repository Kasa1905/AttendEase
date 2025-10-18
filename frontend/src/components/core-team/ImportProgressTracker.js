import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ProgressBar from '../common/ProgressBar';
import TimerDisplay from '../common/TimerDisplay';

const ImportProgressTracker = ({
  batchId,
  socket,
  onComplete,
  onError,
  className = ''
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState([]);
  const [startTime] = useState(Date.now());
  const [estimatedTime, setEstimatedTime] = useState(null);

  useEffect(() => {
    if (!socket || !batchId) return;

    // Join import room
    socket.emit('join-import-room', { batchId });

    const handleProgress = (data) => {
      if (data.batchId === batchId) {
        setProgress(data.progress || 0);
        setProcessed(data.processed || 0);
        setTotal(data.total || 0);
        setStatus(data.currentOperation || 'Processing...');

        // Calculate estimated completion time
        if (data.processed > 0 && data.total > 0) {
          const elapsed = Date.now() - startTime;
          const rate = data.processed / elapsed; // items per millisecond
          const remaining = data.total - data.processed;
          const estimated = remaining / rate;
          setEstimatedTime(Math.max(1000, estimated)); // At least 1 second
        }
      }
    };

    const handleComplete = (data) => {
      if (data.batchId === batchId) {
        setProgress(100);
        setStatus('Import completed successfully!');
        setProcessed(data.results?.successful || 0);
        setTotal((data.results?.successful || 0) + (data.results?.failed || 0));

        if (onComplete) {
          onComplete(data.results);
        }
      }
    };

    const handleError = (data) => {
      if (data.batchId === batchId) {
        setStatus('Import failed');
        setErrors([data.error || 'Unknown error occurred']);

        if (onError) {
          onError(data.error);
        }
      }
    };

    // Listen for progress updates
    socket.on('import-progress', handleProgress);
    socket.on('import-completed', handleComplete);
    socket.on('import-error', handleError);

    // Cleanup
    return () => {
      socket.off('import-progress', handleProgress);
      socket.off('import-completed', handleComplete);
      socket.off('import-error', handleError);
      // Leave import room
      socket.emit('leave-import-room', { batchId });
    };
  }, [socket, batchId, startTime, onComplete, onError]);

  const formatTime = (milliseconds) => {
    if (!milliseconds) return 'Calculating...';

    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s remaining`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  const getStatusColor = () => {
    if (errors.length > 0) return 'text-red-600';
    if (progress === 100) return 'text-green-600';
    return 'text-blue-600';
  };

  const getStatusIcon = () => {
    if (errors.length > 0) return '❌';
    if (progress === 100) return '✅';
    return '⏳';
  };

  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Import Progress
        </h3>
        <div className={`flex items-center text-sm ${getStatusColor()}`}>
          <span className="mr-2">{getStatusIcon()}</span>
          <span>{status}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <ProgressBar
          progress={progress}
          className="mb-2"
          color={errors.length > 0 ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-blue-500'}
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>{processed} of {total} processed</span>
          <span>{progress}% complete</span>
        </div>
      </div>

      {/* Time Information */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-500">Elapsed Time</div>
          <TimerDisplay startTime={startTime} />
        </div>
        <div>
          <div className="text-sm text-gray-500">Estimated Time</div>
          <div className="text-sm font-medium">
            {estimatedTime ? formatTime(estimatedTime) : 'Calculating...'}
          </div>
        </div>
      </div>

      {/* Current Operation Details */}
      {processed > 0 && total > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">Current Operation</div>
          <div className="text-sm font-medium text-gray-900">{status}</div>
          <div className="text-xs text-gray-500 mt-1">
            Processing user {processed} of {total}
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Import Errors
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary */}
      {progress === 100 && errors.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Import Completed Successfully!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>All {total} users have been imported successfully.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ImportProgressTracker.propTypes = {
  batchId: PropTypes.string.isRequired,
  socket: PropTypes.object,
  onComplete: PropTypes.func,
  onError: PropTypes.func,
  className: PropTypes.string
};

export default ImportProgressTracker;