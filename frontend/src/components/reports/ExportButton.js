import React from 'react';

const ExportButton = ({ format, onExport, isLoading, disabled }) => {
  const getFormatConfig = (format) => {
    switch (format) {
      case 'pdf':
        return {
          label: 'Export PDF',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-red-600 hover:bg-red-700',
          textColor: 'text-white'
        };
      case 'excel':
        return {
          label: 'Export Excel',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-green-600 hover:bg-green-700',
          textColor: 'text-white'
        };
      case 'csv':
        return {
          label: 'Export CSV',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-blue-600 hover:bg-blue-700',
          textColor: 'text-white'
        };
      default:
        return {
          label: 'Export',
          icon: null,
          color: 'bg-gray-600 hover:bg-gray-700',
          textColor: 'text-white'
        };
    }
  };

  const config = getFormatConfig(format);

  const handleClick = () => {
    if (!disabled && !isLoading) {
      onExport(format);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
        ${config.color} ${config.textColor}
        ${disabled || isLoading
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }
        transition-all duration-200
      `}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      ) : (
        config.icon && <span className="mr-2">{config.icon}</span>
      )}
      {isLoading ? 'Exporting...' : config.label}
    </button>
  );
};

export default ExportButton;