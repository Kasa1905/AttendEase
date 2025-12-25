import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import EventList from '../../components/EventList';
import { render, createMockEvent, createMockStudent, createMockTeacher } from '../utils/testUtils';

describe('EventList Component', () => {
  let user;

  const mockEvents = [
    createMockEvent({
      id: 1,
      name: 'Weekly Meeting',
      description: 'Regular club meeting',
      date: '2024-01-15',
      time: '14:00',
      location: 'Room 101',
      type: 'Meeting'
    }),
    createMockEvent({
      id: 2,
      name: 'Annual Fest',
      description: 'College annual festival',
      date: '2024-02-20',
      time: '10:00',
      location: 'Main Auditorium',
      type: 'Event'
    }),
    createMockEvent({
      id: 3,
      name: 'Workshop on AI',
      description: 'Technical workshop',
      date: '2024-03-10',
      time: '15:30',
      location: 'Lab 201',
      type: 'Workshop'
    })
  ];

  beforeEach(() => {
    user = userEvent.setup();
    
    // Setup default mock response
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
  });

  describe('Component Rendering', () => {
    it('renders event list with all events', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/annual fest/i)).toBeInTheDocument();
        expect(screen.getByText(/workshop on ai/i)).toBeInTheDocument();
      });
    });

    it('displays event details correctly', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const weeklyMeeting = screen.getByTestId('event-1');
        expect(within(weeklyMeeting).getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(within(weeklyMeeting).getByText(/regular club meeting/i)).toBeInTheDocument();
        expect(within(weeklyMeeting).getByText(/room 101/i)).toBeInTheDocument();
        expect(within(weeklyMeeting).getByText(/14:00/i)).toBeInTheDocument();
        expect(within(weeklyMeeting).getByText(/meeting/i)).toBeInTheDocument();
      });
    });

    it('shows event type badges with correct styling', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const meetingBadge = screen.getByText('Meeting');
        const eventBadge = screen.getByText('Event');
        const workshopBadge = screen.getByText('Workshop');
        
        expect(meetingBadge).toHaveClass('badge-meeting');
        expect(eventBadge).toHaveClass('badge-event');
        expect(workshopBadge).toHaveClass('badge-workshop');
      });
    });

    it('displays formatted dates correctly', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/february 20, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/march 10, 2024/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner while fetching events', () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading events/i)).toBeInTheDocument();
    });

    it('hides loading spinner after events load', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
        expect(screen.queryByText(/loading events/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when events fail to load', async () => {
      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries loading events when retry button is clicked', async () => {
      let attemptCount = 0;
      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount === 1) {
            return res(
              ctx.status(500),
              ctx.json({ message: 'Server error' })
            );
          }
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

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.queryByText(/error loading events/i)).not.toBeInTheDocument();
      });
    });

    it('shows empty state when no events are found', async () => {
      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          return res(
            ctx.json({
              events: [],
              totalEvents: 0,
              totalPages: 0,
              currentPage: 1
            })
          );
        })
      );

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/no events found/i)).toBeInTheDocument();
        expect(screen.getByText(/check back later/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('renders filter controls', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/filter by type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/search events/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
      });
    });

    it('filters events by type', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/annual fest/i)).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText(/filter by type/i);
      await user.selectOptions(typeFilter, 'Meeting');
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.queryByText(/annual fest/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/workshop on ai/i)).not.toBeInTheDocument();
      });
    });

    it('filters events by search term', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/workshop on ai/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search events/i);
      await user.type(searchInput, 'workshop');
      
      await waitFor(() => {
        expect(screen.getByText(/workshop on ai/i)).toBeInTheDocument();
        expect(screen.queryByText(/weekly meeting/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/annual fest/i)).not.toBeInTheDocument();
      });
    });

    it('clears filters when clear button is clicked', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      // Apply a filter first
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText(/filter by type/i);
      await user.selectOptions(typeFilter, 'Meeting');
      
      await waitFor(() => {
        expect(screen.queryByText(/annual fest/i)).not.toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/annual fest/i)).toBeInTheDocument();
        expect(screen.getByText(/workshop on ai/i)).toBeInTheDocument();
      });
    });

    it('shows filter results count', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/showing 3 of 3 events/i)).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText(/filter by type/i);
      await user.selectOptions(typeFilter, 'Meeting');
      
      await waitFor(() => {
        expect(screen.getByText(/showing 1 of 3 events/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    const manyEvents = Array.from({ length: 25 }, (_, i) =>
      createMockEvent({
        id: i + 1,
        name: `Event ${i + 1}`,
        description: `Description for event ${i + 1}`
      })
    );

    beforeEach(() => {
      server.use(
        rest.get('/api/events', (req, res, ctx) => {
          const url = new URL(req.url);
          const page = parseInt(url.searchParams.get('page')) || 1;
          const limit = parseInt(url.searchParams.get('limit')) || 10;
          
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + limit;
          const paginatedEvents = manyEvents.slice(startIndex, endIndex);
          
          return res(
            ctx.json({
              events: paginatedEvents,
              totalEvents: manyEvents.length,
              totalPages: Math.ceil(manyEvents.length / limit),
              currentPage: page
            })
          );
        })
      );
    });

    it('displays pagination controls when there are multiple pages', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      });
    });

    it('navigates to next page when next button is clicked', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/event 1/i)).toBeInTheDocument();
        expect(screen.queryByText(/event 11/i)).not.toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/event 11/i)).toBeInTheDocument();
        expect(screen.queryByText(/event 1/i)).not.toBeInTheDocument();
      });
    });

    it('displays correct page information', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('disables previous button on first page', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const previousButton = screen.getByRole('button', { name: /previous page/i });
        expect(previousButton).toBeDisabled();
      });
    });

    it('disables next button on last page', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      // Navigate to last page
      const nextButton = screen.getByRole('button', { name: /next page/i });
      
      await waitFor(() => {
        expect(nextButton).toBeEnabled();
      });

      await user.click(nextButton); // Page 2
      await user.click(nextButton); // Page 3 (last page)
      
      await waitFor(() => {
        expect(nextButton).toBeDisabled();
      });
    });
  });

  describe('Event Actions', () => {
    const mockTeacher = createMockTeacher({ id: 2 });

    it('shows teacher-specific actions for teachers', async () => {
      render(<EventList showActions={true} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const eventCard = screen.getByTestId('event-1');
        expect(within(eventCard).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(eventCard).getByRole('button', { name: /delete/i })).toBeInTheDocument();
        expect(within(eventCard).getByRole('button', { name: /manage attendance/i })).toBeInTheDocument();
      });
    });

    it('hides action buttons for students', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      });
    });

    it('shows register button for students on future events', async () => {
      render(<EventList showActions={true} />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const futureEvent = screen.getByTestId('event-2'); // Annual Fest is in the future
        expect(within(futureEvent).getByRole('button', { name: /register/i })).toBeInTheDocument();
      });
    });

    it('navigates to event details when event title is clicked', async () => {
      const mockNavigate = jest.fn();
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate
      }));

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const eventTitle = screen.getByRole('button', { name: /weekly meeting/i });
        expect(eventTitle).toBeInTheDocument();
      });

      const eventTitle = screen.getByRole('button', { name: /weekly meeting/i });
      await user.click(eventTitle);
      
      expect(mockNavigate).toHaveBeenCalledWith('/events/1');
    });
  });

  describe('Responsive Design', () => {
    it('shows grid layout on desktop', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      });

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const eventList = screen.getByTestId('event-list');
        expect(eventList).toHaveClass('grid-layout');
      });
    });

    it('shows list layout on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const eventList = screen.getByTestId('event-list');
        expect(eventList).toHaveClass('list-layout');
      });
    });
  });

  describe('Sorting', () => {
    it('renders sort options', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
      });
    });

    it('sorts events by date', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const eventTitles = screen.getAllByTestId(/event-\d+/).map(el => 
          within(el).getByRole('heading').textContent
        );
        expect(eventTitles[0]).toContain('Weekly Meeting'); // Earliest date
      });

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'date-desc');
      
      await waitFor(() => {
        const eventTitles = screen.getAllByTestId(/event-\d+/).map(el => 
          within(el).getByRole('heading').textContent
        );
        expect(eventTitles[0]).toContain('Workshop on AI'); // Latest date
      });
    });

    it('sorts events by name', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'name');
      
      await waitFor(() => {
        const eventTitles = screen.getAllByTestId(/event-\d+/).map(el => 
          within(el).getByRole('heading').textContent
        );
        expect(eventTitles[0]).toContain('Annual Fest'); // Alphabetically first
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      });
    });

    it('announces loading state to screen readers', () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      const loadingElement = screen.getByTestId('loading-spinner');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
      expect(loadingElement).toHaveAttribute('aria-label', /loading events/i);
    });

    it('provides keyboard navigation for event cards', async () => {
      render(<EventList />, { authUser: createMockStudent() });
      
      await waitFor(() => {
        const eventCards = screen.getAllByTestId(/event-\d+/);
        eventCards.forEach(card => {
          expect(card).toHaveAttribute('tabindex', '0');
          expect(card).toHaveAttribute('role', 'button');
        });
      });
    });
  });
});