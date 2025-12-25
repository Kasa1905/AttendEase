import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { OfflineProvider } from './contexts/OfflineContext.js';
import NotificationToast from './components/common/NotificationToast';
import OfflineIndicator from './components/common/OfflineIndicator.js';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import StudentDashboard from './pages/StudentDashboard';
import CoreTeamDashboard from './pages/CoreTeamDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Profile from './pages/Profile';
import Navbar from './components/common/Navbar';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/react';
import sentryService from './services/sentryService';
import { SENTRY_DSN, ENV as APP_ENV, SENTRY_TRACES_SAMPLE_RATE, APP_VERSION, IS_PROD } from './config/env';

export default function App() {
  // Initialize Sentry
  useEffect(() => {
    sentryService.init({
      dsn: SENTRY_DSN,
      environment: APP_ENV,
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      release: APP_VERSION,
      enabled: IS_PROD
    });
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-700 mb-4">
            We're sorry, but something went wrong. Our team has been notified and is working on a fix.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Reload page
          </button>
        </div>
      </div>
    }>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <OfflineProvider>
            <div className="min-h-screen bg-gray-100">
              <Navbar />
              <main className="p-4">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  <Route
                    path="/student"
                    element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>}
                  />
                  <Route
                    path="/core"
                    element={<ProtectedRoute role="core_team"><CoreTeamDashboard /></ProtectedRoute>}
                  />
                  <Route
                    path="/teacher"
                    element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>}
                  />

                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                  <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
              </main>

              {/* Offline indicator in bottom-right corner */}
              <div className="fixed bottom-4 right-4 z-40">
                <OfflineIndicator />
              </div>
            </div>
          </OfflineProvider>
          <Toaster position="top-right" />
          <NotificationToast />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
    </Sentry.ErrorBoundary>
  );
}
