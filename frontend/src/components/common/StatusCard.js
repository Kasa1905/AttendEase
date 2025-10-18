import React from 'react';

export default function StatusCard({ icon, title, value, description, variant = 'info', onClick }) {
  const color = variant === 'success' ? 'border-green-300' : variant === 'warning' ? 'border-yellow-300' : variant === 'danger' ? 'border-red-300' : 'border-blue-300';
  return (
    <div onClick={onClick} className={`p-4 border ${color} rounded-md bg-white cursor-pointer`}> 
      <div className="flex items-start space-x-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="font-semibold text-lg">{value}</div>
          {description && <div className="text-sm text-gray-600">{description}</div>}
        </div>
      </div>
    </div>
  );
}
