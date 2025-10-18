import React from 'react';
export default function Input({ label, error, ...props }) {
  return (
    <label className="block">
      {label && <div className="text-sm mb-1">{label}</div>}
      <input className={`w-full p-2 border rounded ${error ? 'border-red-500' : ''}`} {...props} />
      {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
    </label>
  );
}
