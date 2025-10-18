import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext.js';
import NotificationCenter from './NotificationCenter';
import SyncStatusModal from './SyncStatusModal.js';
import OfflineDataViewer from './OfflineDataViewer.js';
import Button from './Button.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isOnline, pendingActions, syncStatus, forceSync } = useOffline();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showDataViewer, setShowDataViewer] = useState(false);

  const handleSyncClick = () => {
    if (pendingActions > 0 && isOnline) {
      forceSync();
    } else {
      setShowSyncModal(true);
    }
  };

  return (
    <>
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold">Club Attendance</Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {user.role === 'student' && <Link to="/student">Dashboard</Link>}
                {user.role === 'core_team' && <Link to="/core">Core</Link>}
                {user.role === 'teacher' && <Link to="/teacher">Teacher</Link>}

                {/* Offline/Sync Controls */}
                <div className="flex items-center space-x-2">
                  {/* Connection Status */}
                  <div className={`flex items-center space-x-1 text-sm ${
                    isOnline ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="hidden sm:inline">
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Sync Status */}
                  {pendingActions > 0 && (
                    <Button
                      onClick={handleSyncClick}
                      className="text-xs py-1 px-2"
                      loading={syncStatus === 'syncing'}
                      variant={syncStatus === 'error' ? 'danger' : 'primary'}
                    >
                      {syncStatus === 'syncing' ? 'Syncing...' :
                       syncStatus === 'error' ? 'Retry' :
                       `Sync (${pendingActions})`}
                    </Button>
                  )}

                  {/* Data Viewer Button */}
                  <Button
                    onClick={() => setShowDataViewer(true)}
                    variant="secondary"
                    className="text-xs py-1 px-2"
                  >
                    📊
                  </Button>
                </div>

                <NotificationCenter />
                <Link to="/profile">Profile</Link>
                <button onClick={logout} className="text-sm text-red-600">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Modals */}
      <SyncStatusModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
      <OfflineDataViewer
        isOpen={showDataViewer}
        onClose={() => setShowDataViewer(false)}
      />
    </>
  );
}
