import React from 'react';
export default function LoadingSpinner({ size = 24, text }) {
  const style = { width: size, height: size, borderWidth: 4, borderStyle: 'solid', borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'transparent' };
  return (
    <div className="flex items-center gap-3">
      <div style={style} className="animate-spin rounded-full" aria-hidden="true" />
      {text && <span>{text}</span>}
    </div>
  );
}
