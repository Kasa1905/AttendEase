import React from 'react';

export default function ProgressBar({ percent = 0, color = 'bg-blue-500' }) {
  return (
    <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
      <div className={`${color} h-3`} style={{ width: `${percent}%`, transition: 'width 300ms ease' }} />
    </div>
  );
}
