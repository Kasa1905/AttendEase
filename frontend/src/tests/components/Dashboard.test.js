import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { server } from '../mocks/server';
import Dashboard from '../../components/Dashboard';
import { render, createMockStudent, createMockTeacher, createMockAdmin, createMockEvent } from '../utils/testUtils';

describe('Dashboard Component', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Student Dashboard', () => {
    const mockStudent = createMockStudent({
      firstName: 'John',
      lastName: 'Doe',
      rollNumber: 'CS21001'
    });

    it('renders student dashboard with correct sections', async () => {
      render(<Dashboard />, { authUser: mockStudent });
      
      await waitFor(() => {
        expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
        expect(screen.getByText(/student dashboard/i)).toBeInTheDocument();
        expect(screen.getByTestId('upcoming-events')).toBeInTheDocument();
        expect(screen.getByTestId('attendance-summary')).toBeInTheDocument();
        expect(screen.getByTestId('duty-schedule')).toBeInTheDocument();
        expect(screen.getByTestId('notifications')).toBeInTheDocument();
      });
    });

    it('displays student-specific statistics', async () => {
      render(<Dashboard />, { authUser: mockStudent });
      
      await waitFor(() => {
        expect(screen.getByText(/attendance rate/i)).toBeInTheDocument();
        expect(screen.getByText(/events attended/i)).toBeInTheDocument();
        expect(screen.getByText(/duty hours/i)).toBeInTheDocument();
        expect(screen.getByText(/pending strikes/i)).toBeInTheDocument();
      });
    });

    it('shows upcoming events section', async () => {
      const mockEvents = [
        createMockEvent({ name: 'Weekly Meeting', date: '2024-01-15' }),
        createMockEvent({ name: 'Annual Fest', date: '2024-02-20' })
      ];

      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          return res(
            ctx.json({
              events: mockEvents,
              totalEvents: mockEvents.length,
              totalPages: 1,
              currentPage: 1
            })
          );
        })
      );

      render(<Dashboard />, { authUser: mockStudent });
      
      await waitFor(() => {
        const upcomingEvents = screen.getByTestId('upcoming-events');
        expect(within(upcomingEvents).getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(within(upcomingEvents).getByText(/annual fest/i)).toBeInTheDocument();
      });
    });

    it('displays attendance summary with correct data', async () => {
      server.use(
        rest.get('/api/reports/attendance', (req, res, ctx) => {
          return res(
            ctx.json({
              summary: {
                attendanceRate: 85.5,
                eventsAttended: 12,
                totalEvents: 14,
                dutyHours: 45
              }
            })
          );
        })
      );

      render(<Dashboard />, { authUser: mockStudent });
      
      await waitFor(() => {
        expect(screen.getByText(/85\.5%/)).toBeInTheDocument();
        expect(screen.getByText(/12/)).toBeInTheDocument();
        expect(screen.getByText(/45/)).toBeInTheDocument();
      });
    });

    it('shows duty schedule for duty-eligible students', async () => {
      const dutyEligibleStudent = createMockStudent({ dutyEligible: true });
      
      render(<Dashboard />, { authUser: dutyEligibleStudent });
      
      await waitFor(() => {
        expect(screen.getByTestId('duty-schedule')).toBeInTheDocument();
        expect(screen.getByText(/duty schedule/i)).toBeInTheDocument();
      });
    });

    it('hides duty schedule for non-duty-eligible students', async () => {
      const nonDutyStudent = createMockStudent({ dutyEligible: false });
      
      render(<Dashboard />, { authUser: nonDutyStudent });
      
      await waitFor(() => {
        expect(screen.queryByTestId('duty-schedule')).not.toBeInTheDocument();
      });
    });

    it('displays recent notifications', async () => {
      server.use(
        rest.get('/api/notifications', (req, res, ctx) => {
          return res(
            ctx.json({
              notifications: [
                {
                  id: 1,
                  title: 'New Event Created',
                  message: 'Weekly meeting scheduled for tomorrow',
                  type: 'info',
                  read: false,
                  createdAt: new Date().toISOString()
                }
              ]
            })
          );
        })
      );

      render(<Dashboard />, { authUser: mockStudent });
      
      await waitFor(() => {
        expect(screen.getByText(/new event created/i)).toBeInTheDocument();
        expect(screen.getByText(/weekly meeting scheduled/i)).toBeInTheDocument();
      });
    });
  });

  describe('Teacher Dashboard', () => {
    const mockTeacher = createMockTeacher({
      firstName: 'Jane',
      lastName: 'Smith'
    });

    it('renders teacher dashboard with management sections', async () => {
      render(<Dashboard />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/welcome back, jane/i)).toBeInTheDocument();
        expect(screen.getByText(/teacher dashboard/i)).toBeInTheDocument();
        expect(screen.getByTestId('event-management')).toBeInTheDocument();
        expect(screen.getByTestId('attendance-overview')).toBeInTheDocument();
        expect(screen.getByTestId('student-summary')).toBeInTheDocument();
      });
    });

    it('shows teacher-specific statistics', async () => {
      render(<Dashboard />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/events created/i)).toBeInTheDocument();
        expect(screen.getByText(/total students/i)).toBeInTheDocument();
        expect(screen.getByText(/average attendance/i)).toBeInTheDocument();
        expect(screen.getByText(/pending approvals/i)).toBeInTheDocument();
      });
    });

    it('displays event management quick actions', async () => {
      render(<Dashboard />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new event/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /manage attendance/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
      });
    });

    it('navigates to event creation when create button is clicked', async () => {
      const mockNavigate = jest.fn();
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate
      }));

      render(<Dashboard />, { authUser: mockTeacher });
      
      const createButton = await screen.findByRole('button', { name: /create new event/i });
      await user.click(createButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/events/create');
    });

    it('shows recent events created by teacher', async () => {
      const teacherEvents = [
        createMockEvent({ name: 'Physics Lab', createdBy: mockTeacher.id }),
        createMockEvent({ name: 'Chemistry Workshop', createdBy: mockTeacher.id })
      ];

      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          const url = new URL(req.url);
          const createdBy = url.searchParams.get('createdBy');
          
          if (createdBy === mockTeacher.id.toString()) {
            return res(ctx.json({ events: teacherEvents }));
          }
          return res(ctx.json({ events: [] }));
        })
      );

      render(<Dashboard />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/physics lab/i)).toBeInTheDocument();
        expect(screen.getByText(/chemistry workshop/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admin Dashboard', () => {
    const mockAdmin = createMockAdmin({
      firstName: 'Admin',
      lastName: 'User'
    });

    it('renders admin dashboard with system overview', async () => {
      render(<Dashboard />, { authUser: mockAdmin });
      
      await waitFor(() => {
        expect(screen.getByText(/welcome back, admin/i)).toBeInTheDocument();
        expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
        expect(screen.getByTestId('system-overview')).toBeInTheDocument();
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
        expect(screen.getByTestId('system-health')).toBeInTheDocument();
      });
    });

    it('displays system-wide statistics', async () => {
      server.use(
        rest.get('/api/admin/stats', (req, res, ctx) => {
          return res(
            ctx.json({
              totalUsers: 245,
              totalEvents: 56,
              activeStudents: 198,
              systemHealth: 'good'
            })
          );
        })
      );

      render(<Dashboard />, { authUser: mockAdmin });
      
      await waitFor(() => {
        expect(screen.getByText(/245/)).toBeInTheDocument();
        expect(screen.getByText(/56/)).toBeInTheDocument();
        expect(screen.getByText(/198/)).toBeInTheDocument();
      });
    });

    it('shows admin quick actions', async () => {
      render(<Dashboard />, { authUser: mockAdmin });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage users/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /system reports/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /backup data/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /system settings/i })).toBeInTheDocument();
      });
    });

    it('displays system health indicators', async () => {
      server.use(
        rest.get('/api/admin/health', (req, res, ctx) => {
          return res(
            ctx.json({
              database: 'healthy',
              api: 'healthy',
              storage: 'warning',
              memory: 'healthy'
            })
          );
        })
      );

      render(<Dashboard />, { authUser: mockAdmin });
      
      await waitFor(() => {
        const healthSection = screen.getByTestId('system-health');
        expect(within(healthSection).getByText(/database/i)).toBeInTheDocument();
        expect(within(healthSection).getByText(/api/i)).toBeInTheDocument();
        expect(within(healthSection).getByText(/storage/i)).toBeInTheDocument();
        expect(within(healthSection).getByText(/memory/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading spinners for each dashboard section initially', () => {
      render(<Dashboard />, { authUser: createMockStudent() });
      
      expect(screen.getAllByTestId('section-loading')).toHaveLength(4); // 4 main sections
    });

    it('removes loading states after data loads', async () => {
      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.queryAllByTestId('section-loading')).toHaveLength(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when dashboard data fails to load', async () => {
      server.use(
        rest.get('/api/*', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading dashboard data/i)).toBeInTheDocument();
      });
    });

    it('shows retry button when data loading fails', async () => {
      server.use(
        rest.get('/api/*', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries loading data when retry button is clicked', async () => {
      let failCount = 0;
      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          failCount++;
          if (failCount === 1) {
            return res(
              ctx.status(500),
              ctx.json({ message: 'Server error' })
            );
          }
          return res(
            ctx.json({
              events: [createMockEvent({ name: 'Retry Success' })],
              totalEvents: 1
            })
          );
        })
      );

      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading dashboard data/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText(/retry success/i)).toBeInTheDocument();
        expect(screen.queryByText(/error loading dashboard data/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates dashboard data when new notifications arrive', async () => {
      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByTestId('notifications')).toBeInTheDocument();
      });

      // Simulate new notification arriving via WebSocket
      const mockWebSocket = {
        addEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      };
      
      global.WebSocket = jest.fn(() => mockWebSocket);
      
      // Simulate notification update
      const notificationUpdate = {
        type: 'notification',
        data: {
          id: 2,
          title: 'New Assignment',
          message: 'New homework assigned',
          type: 'info',
          read: false
        }
      };

      // Trigger the WebSocket message event
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        messageHandler({ data: JSON.stringify(notificationUpdate) });
        
        await waitFor(() => {
          expect(screen.getByText(/new assignment/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', async () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // Mobile width
      });

      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const dashboard = screen.getByTestId('dashboard-container');
        expect(dashboard).toHaveClass('mobile-layout');
      });
    });

    it('shows full layout on desktop screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200, // Desktop width
      });

      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const dashboard = screen.getByTestId('dashboard-container');
        expect(dashboard).toHaveClass('desktop-layout');
      });
    });
  });

  describe('Performance', () => {
    it('renders efficiently with large amounts of data', async () => {
      const largeEventList = Array.from({ length: 100 }, (_, i) =>
        createMockEvent({ name: `Event ${i + 1}`, id: i + 1 })
      );

      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          return res(
            ctx.json({
              events: largeEventList,
              totalEvents: largeEventList.length
            })
          );
        })
      );

      const startTime = performance.now();
      render(<Dashboard />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByTestId('upcoming-events')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Ensure rendering takes less than 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });
});