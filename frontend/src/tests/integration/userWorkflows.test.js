import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { rest } from 'msw';
import { server } from '../mocks/server';
import { API_BASE } from '../../config/env.test';

// Import main app components
import App from '../../App';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(() => ({ id: 'loading-toast' })),
    dismiss: jest.fn()
  }
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Test wrapper with all providers
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('Integration Tests - Frontend User Workflows', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    mockNavigate.mockClear();
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    test('User can register, login, and access protected content', async () => {
      // Setup MSW handlers for auth flow
      server.use(
        rest.post(`${API_BASE}/auth/register`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              user: {
                id: 1,
                email: 'newuser@test.com',
                firstName: 'New',
                lastName: 'User',
                role: 'student'
              },
              tokens: {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token'
              }
            })
          );
        }),
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              user: {
                id: 1,
                email: 'newuser@test.com',
                firstName: 'New',
                lastName: 'User',
                role: 'student'
              },
              tokens: {
                accessToken: 'login-access-token',
                refreshToken: 'login-refresh-token'
              }
            })
          );
        }),
        rest.get(`${API_BASE}/users/profile`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: 1,
              email: 'newuser@test.com',
              firstName: 'New',
              lastName: 'User',
              role: 'student'
            })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      // Step 1: Navigate to register page and register
      const registerLink = screen.getByRole('link', { name: /register/i });
      await user.click(registerLink);

      // Fill registration form
      await user.type(screen.getByPlaceholderText(/email/i), 'newuser@test.com');
      await user.type(screen.getByPlaceholderText(/first name/i), 'New');
      await user.type(screen.getByPlaceholderText(/last name/i), 'User');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.type(screen.getByPlaceholderText(/confirm password/i), 'password123');
      await user.selectOptions(screen.getByRole('combobox', { name: /role/i }), 'student');

      const registerButton = screen.getByRole('button', { name: /register/i });
      await user.click(registerButton);

      // Step 2: Should be redirected to student dashboard after registration
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student');
      });

      // Step 3: Verify user can access protected content
      await waitFor(() => {
        expect(screen.getByText(/welcome new/i)).toBeInTheDocument();
      });

      // Step 4: Logout and login again
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      });

      // Step 5: Login with same credentials
      await user.type(screen.getByPlaceholderText(/email/i), 'newuser@test.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Step 6: Should be redirected to dashboard again
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student');
      });

      await waitFor(() => {
        expect(screen.getByText(/welcome new/i)).toBeInTheDocument();
      });
    });

    test('Different user roles are redirected to correct dashboards', async () => {
      const testCases = [
        { role: 'student', expectedRoute: '/student' },
        { role: 'teacher', expectedRoute: '/teacher' },
        { role: 'core_team', expectedRoute: '/core' }
      ];

      for (const testCase of testCases) {
        mockNavigate.mockClear();

        server.use(
          rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
            return res(
              ctx.status(200),
              ctx.json({
                user: {
                  id: 1,
                  email: `${testCase.role}@test.com`,
                  firstName: 'Test',
                  lastName: 'User',
                  role: testCase.role
                },
                tokens: {
                  accessToken: 'test-token',
                  refreshToken: 'test-refresh'
                }
              })
            );
          })
        );

        render(<App />, { wrapper: TestWrapper });

        await user.type(screen.getByPlaceholderText(/email/i), `${testCase.role}@test.com`);
        await user.type(screen.getByPlaceholderText(/password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /login/i }));

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(testCase.expectedRoute);
        });
      }
    });
  });

  describe('Attendance Management Workflow', () => {
    beforeEach(() => {
      // Setup default authenticated student
      server.use(
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              user: {
                id: 1,
                email: 'student@test.com',
                firstName: 'Test',
                lastName: 'Student',
                role: 'student'
              },
              tokens: {
                accessToken: 'student-token',
                refreshToken: 'student-refresh'
              }
            })
          );
        }),
        rest.get(`${API_BASE}/events`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              events: [
                {
                  id: 1,
                  name: 'Weekly Meeting',
                  description: 'Regular weekly meeting',
                  date: '2024-01-15',
                  time: '14:00',
                  duration: 120,
                  location: 'Conference Room',
                  isActive: true
                },
                {
                  id: 2,
                  name: 'Workshop',
                  description: 'Technical workshop',
                  date: '2024-01-16',
                  time: '10:00',
                  duration: 180,
                  location: 'Lab 1',
                  isActive: true
                }
              ],
              pagination: {
                page: 1,
                totalPages: 1,
                totalEvents: 2
              }
            })
          );
        })
      );
    });

    test('Student can view events and mark attendance', async () => {
      server.use(
        rest.post(`${API_BASE}/attendance`, (req, res, ctx) => {
          const { eventId, status } = req.body;
          return res(
            ctx.status(201),
            ctx.json({
              id: 1,
              eventId,
              userId: 1,
              status,
              dutyEligible: status === 'present'
            })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      // Login as student
      await user.type(screen.getByPlaceholderText(/email/i), 'student@test.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Navigate to events page
      await waitFor(() => {
        expect(screen.getByText(/events/i)).toBeInTheDocument();
      });

      const eventsNavLink = screen.getByRole('link', { name: /events/i });
      await user.click(eventsNavLink);

      // Wait for events to load
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/workshop/i)).toBeInTheDocument();
      });

      // Mark attendance for first event
      const weeklyMeetingCard = screen.getByText(/weekly meeting/i).closest('.event-card');
      const markAttendanceButton = within(weeklyMeetingCard).getByRole('button', { name: /mark present/i });
      await user.click(markAttendanceButton);

      // Verify attendance was marked
      await waitFor(() => {
        expect(within(weeklyMeetingCard).getByText(/present/i)).toBeInTheDocument();
        expect(within(weeklyMeetingCard).getByRole('button', { name: /start duty/i })).toBeInTheDocument();
      });
    });

    test('Student can complete full duty workflow', async () => {
      let dutySessionId = 1;
      let hourlyLogCount = 0;

      server.use(
        rest.post(`${API_BASE}/attendance`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              id: 1,
              eventId: 1,
              userId: 1,
              status: 'present',
              dutyEligible: true
            })
          );
        }),
        rest.post(`${API_BASE}/duty-sessions`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              id: dutySessionId,
              attendanceRecordId: 1,
              userId: 1,
              status: 'active',
              startTime: new Date().toISOString()
            })
          );
        }),
        rest.post(`${API_BASE}/hourly-logs`, (req, res, ctx) => {
          hourlyLogCount++;
          return res(
            ctx.status(201),
            ctx.json({
              id: hourlyLogCount,
              dutySessionId,
              activity: req.body.activity,
              breakDuration: req.body.breakDuration,
              notes: req.body.notes,
              timestamp: new Date().toISOString()
            })
          );
        }),
        rest.post(`${API_BASE}/duty-sessions/${dutySessionId}/end`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: dutySessionId,
              status: 'completed',
              endTime: new Date().toISOString(),
              totalDuration: 125,
              hourlyLogs: [
                { id: 1, activity: 'Cleaning classroom', breakDuration: 10 },
                { id: 2, activity: 'Organizing materials', breakDuration: 15 }
              ]
            })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      // Login and navigate to events
      await user.type(screen.getByPlaceholderText(/email/i), 'student@test.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await user.click(screen.getByRole('link', { name: /events/i }));

      // Mark attendance
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
      });

      const eventCard = screen.getByText(/weekly meeting/i).closest('.event-card');
      await user.click(within(eventCard).getByRole('button', { name: /mark present/i }));

      // Start duty session
      await waitFor(() => {
        expect(within(eventCard).getByRole('button', { name: /start duty/i })).toBeInTheDocument();
      });

      await user.click(within(eventCard).getByRole('button', { name: /start duty/i }));

      // Navigate to duty session page
      await waitFor(() => {
        expect(screen.getByText(/active duty session/i)).toBeInTheDocument();
      });

      // Log first hour
      await user.type(screen.getByPlaceholderText(/activity/i), 'Cleaning classroom');
      await user.type(screen.getByPlaceholderText(/break duration/i), '10');
      await user.type(screen.getByPlaceholderText(/notes/i), 'Cleaned all desks and chairs');
      await user.click(screen.getByRole('button', { name: /log hour/i }));

      // Verify first log was added
      await waitFor(() => {
        expect(screen.getByText(/cleaning classroom/i)).toBeInTheDocument();
      });

      // Log second hour
      await user.clear(screen.getByPlaceholderText(/activity/i));
      await user.type(screen.getByPlaceholderText(/activity/i), 'Organizing materials');
      await user.clear(screen.getByPlaceholderText(/break duration/i));
      await user.type(screen.getByPlaceholderText(/break duration/i), '15');
      await user.clear(screen.getByPlaceholderText(/notes/i));
      await user.type(screen.getByPlaceholderText(/notes/i), 'Organized storage closet');
      await user.click(screen.getByRole('button', { name: /log hour/i }));

      // Verify second log was added
      await waitFor(() => {
        expect(screen.getByText(/organizing materials/i)).toBeInTheDocument();
      });

      // End duty session
      const endDutyButton = screen.getByRole('button', { name: /end duty session/i });
      await user.click(endDutyButton);

      // Confirm ending duty session
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Verify duty session completed
      await waitFor(() => {
        expect(screen.getByText(/duty session completed/i)).toBeInTheDocument();
        expect(screen.getByText(/total duration: 125 minutes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Handles network errors gracefully', async () => {
      server.use(
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res.networkError('Failed to connect');
        })
      );

      render(<App />, { wrapper: TestWrapper });

      await user.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    test('Handles server errors with appropriate messages', async () => {
      server.use(
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Internal server error' })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      await user.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });
    });

    test('Handles invalid form data', async () => {
      render(<App />, { wrapper: TestWrapper });

      // Try to submit login form with empty fields
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should not make API call and show validation errors
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    test('Handles token expiration and refresh', async () => {
      let tokenExpired = false;

      server.use(
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              user: { id: 1, email: 'test@example.com', role: 'student' },
              tokens: { accessToken: 'initial-token', refreshToken: 'refresh-token' }
            })
          );
        }),
        rest.get(`${API_BASE}/users/profile`, (req, res, ctx) => {
          if (!tokenExpired) {
            tokenExpired = true;
            return res(ctx.status(401), ctx.json({ error: 'Token expired' }));
          }
          return res(
            ctx.status(200),
            ctx.json({ id: 1, email: 'test@example.com', role: 'student' })
          );
        }),
        rest.post(`${API_BASE}/auth/refresh`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token'
            })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      // Login successfully
      await user.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Try to access protected route which will trigger token refresh
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student');
      });

      // Should eventually succeed after token refresh
      await waitFor(() => {
        expect(screen.getByText(/welcome/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Responsive Design and Accessibility', () => {
    test('Components are keyboard navigable', async () => {
      render(<App />, { wrapper: TestWrapper });

      // Tab through form elements
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });

      emailInput.focus();
      expect(emailInput).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(passwordInput).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(loginButton).toHaveFocus();

      // Submit form with Enter key
      await user.keyboard('{Enter}');
    });

    test('Components have proper ARIA labels', () => {
      render(<App />, { wrapper: TestWrapper });

      const form = screen.getByRole('form');
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      expect(form).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('Error messages are properly announced to screen readers', async () => {
      server.use(
        rest.post(`${API_BASE}/auth/login`, (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ error: 'Invalid credentials' })
          );
        })
      );

      render(<App />, { wrapper: TestWrapper });

      await user.type(screen.getByPlaceholderText(/email/i), 'wrong@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        const errorMessage = screen.getByText(/invalid credentials/i);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});