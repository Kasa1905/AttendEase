import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function Button({ children, loading, className = '', ...props }) {
  return (
    <button className={`btn-primary ${className}`} disabled={loading} {...props}>
      {loading ? <LoadingSpinner size={4} /> : children}
    </button>
  );
}
