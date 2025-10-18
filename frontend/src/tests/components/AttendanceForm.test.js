import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { server } from '../mocks/server';
import AttendanceForm from '../../components/AttendanceForm';
import { render, createMockStudent, createMockTeacher, createMockEvent, createMockAttendance } from '../utils/testUtils';

describe('AttendanceForm Component', () => {
  let user;

  const mockEvent = createMockEvent({
    id: 1,
    name: 'Weekly Meeting',
    date: '2024-01-15',
    time: '14:00'
  });

  const mockStudents = [
    createMockStudent({ id: 1, firstName: 'John', lastName: 'Doe', rollNumber: 'CS21001' }),
    createMockStudent({ id: 2, firstName: 'Jane', lastName: 'Smith', rollNumber: 'CS21002' }),
    createMockStudent({ id: 3, firstName: 'Bob', lastName: 'Johnson', rollNumber: 'CS21003' })
  ];

  const mockTeacher = createMockTeacher({ id: 4, firstName: 'Prof', lastName: 'Wilson' });

  beforeEach(() => {
    user = userEvent.setup();
    
    // Setup default mock responses
    server.use(
      rest.get('/api/events/1', (req, res, ctx) => {
        return res(ctx.json({ event: mockEvent }));
      }),
      rest.get('/api/users', (req, res, ctx) => {
        const url = new URL(req.url);
        const role = url.searchParams.get('role');
        
        if (role === 'Student') {
          return res(ctx.json({
            users: mockStudents,
            totalUsers: mockStudents.length
          }));
        }
        return res(ctx.json({ users: [], totalUsers: 0 }));
      }),
      rest.get('/api/attendance', (req, res, ctx) => {
        return res(ctx.json({ attendance: [] }));
      }),
      rest.post('/api/attendance', (req, res, ctx) => {
        const attendanceData = req.body;
        const newAttendance = createMockAttendance({
          id: Date.now(),
          ...attendanceData
        });
        return res(ctx.json({
          attendance: newAttendance,
          message: 'Attendance marked successfully'
        }));
      })
    );
  });

  describe('Component Rendering', () => {
    it('renders attendance form with event information', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/mark attendance/i)).toBeInTheDocument();
        expect(screen.getByText(/weekly meeting/i)).toBeInTheDocument();
        expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/14:00/i)).toBeInTheDocument();
      });
    });

    it('renders student list with attendance options', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
        expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
        
        // Check roll numbers are displayed
        expect(screen.getByText(/cs21001/i)).toBeInTheDocument();
        expect(screen.getByText(/cs21002/i)).toBeInTheDocument();
        expect(screen.getByText(/cs21003/i)).toBeInTheDocument();
      });
    });

    it('renders attendance status options for each student', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        expect(within(johnRow).getByRole('radio', { name: /present/i })).toBeInTheDocument();
        expect(within(johnRow).getByRole('radio', { name: /absent/i })).toBeInTheDocument();
        expect(within(johnRow).getByRole('radio', { name: /excused/i })).toBeInTheDocument();
      });
    });

    it('shows duty eligibility checkbox for eligible students', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const dutyEligibleStudent = screen.getByTestId('student-1'); // John is duty eligible
        expect(within(dutyEligibleStudent).getByRole('checkbox', { name: /duty eligible/i })).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('updates attendance status when radio button is clicked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        const absentRadio = within(johnRow).getByRole('radio', { name: /absent/i });
        
        expect(presentRadio).not.toBeChecked();
        expect(absentRadio).not.toBeChecked();
      });

      const johnRow = screen.getByTestId('student-1');
      const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
      
      await user.click(presentRadio);
      
      expect(presentRadio).toBeChecked();
    });

    it('toggles duty eligibility when checkbox is clicked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const dutyCheckbox = within(johnRow).getByRole('checkbox', { name: /duty eligible/i });
        
        expect(dutyCheckbox).not.toBeChecked();
      });

      const johnRow = screen.getByTestId('student-1');
      const dutyCheckbox = within(johnRow).getByRole('checkbox', { name: /duty eligible/i });
      
      await user.click(dutyCheckbox);
      
      expect(dutyCheckbox).toBeChecked();
    });

    it('adds notes for individual students', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const notesInput = within(johnRow).getByLabelText(/notes/i);
        
        expect(notesInput).toHaveValue('');
      });

      const johnRow = screen.getByTestId('student-1');
      const notesInput = within(johnRow).getByLabelText(/notes/i);
      
      await user.type(notesInput, 'Late arrival due to traffic');
      
      expect(notesInput).toHaveValue('Late arrival due to traffic');
    });
  });

  describe('Bulk Actions', () => {
    it('renders bulk action controls', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all present/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /mark all absent/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });
    });

    it('marks all students present when bulk present button is clicked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all present/i })).toBeInTheDocument();
      });

      const markAllPresentButton = screen.getByRole('button', { name: /mark all present/i });
      await user.click(markAllPresentButton);
      
      await waitFor(() => {
        mockStudents.forEach((student) => {
          const studentRow = screen.getByTestId(`student-${student.id}`);
          const presentRadio = within(studentRow).getByRole('radio', { name: /present/i });
          expect(presentRadio).toBeChecked();
        });
      });
    });

    it('marks all students absent when bulk absent button is clicked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all absent/i })).toBeInTheDocument();
      });

      const markAllAbsentButton = screen.getByRole('button', { name: /mark all absent/i });
      await user.click(markAllAbsentButton);
      
      await waitFor(() => {
        mockStudents.forEach((student) => {
          const studentRow = screen.getByTestId(`student-${student.id}`);
          const absentRadio = within(studentRow).getByRole('radio', { name: /absent/i });
          expect(absentRadio).toBeChecked();
        });
      });
    });

    it('clears all selections when clear all button is clicked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      // First mark some students present
      await waitFor(() => {
        const markAllPresentButton = screen.getByRole('button', { name: /mark all present/i });
        return user.click(markAllPresentButton);
      });

      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        expect(presentRadio).toBeChecked();
      });

      // Then clear all
      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllButton);
      
      await waitFor(() => {
        mockStudents.forEach((student) => {
          const studentRow = screen.getByTestId(`student-${student.id}`);
          const presentRadio = within(studentRow).getByRole('radio', { name: /present/i });
          const absentRadio = within(studentRow).getByRole('radio', { name: /absent/i });
          const excusedRadio = within(studentRow).getByRole('radio', { name: /excused/i });
          
          expect(presentRadio).not.toBeChecked();
          expect(absentRadio).not.toBeChecked();
          expect(excusedRadio).not.toBeChecked();
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('submits attendance successfully when form is valid', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        return user.click(presentRadio);
      });

      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/attendance submitted successfully/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        return user.click(presentRadio);
      });

      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      await user.click(submitButton);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/submitting attendance/i)).toBeInTheDocument();
    });

    it('disables submit button when no attendance is marked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit attendance/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it('enables submit button when at least one attendance is marked', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit attendance/i });
        expect(submitButton).toBeDisabled();
      });

      const johnRow = screen.getByTestId('student-1');
      const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
      await user.click(presentRadio);
      
      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      expect(submitButton).toBeEnabled();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when submission fails', async () => {
      server.use(
        rest.post('/api/attendance', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        return user.click(presentRadio);
      });

      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error submitting attendance/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('shows error when event data fails to load', async () => {
      server.use(
        rest.get('/api/events/1', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({ message: 'Event not found' })
          );
        })
      );

      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading event/i)).toBeInTheDocument();
      });
    });

    it('shows error when student list fails to load', async () => {
      server.use(
        rest.get('/api/users', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading students/i)).toBeInTheDocument();
      });
    });
  });

  describe('Existing Attendance', () => {
    const existingAttendance = [
      createMockAttendance({ id: 1, eventId: 1, userId: 1, status: 'Present' }),
      createMockAttendance({ id: 2, eventId: 1, userId: 2, status: 'Absent' })
    ];

    beforeEach(() => {
      server.use(
        rest.get('/api/attendance', (req, res, ctx) => {
          const url = new URL(req.url);
          const eventId = url.searchParams.get('eventId');
          
          if (eventId === '1') {
            return res(ctx.json({ attendance: existingAttendance }));
          }
          return res(ctx.json({ attendance: [] }));
        })
      );
    });

    it('pre-fills form with existing attendance data', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const janeRow = screen.getByTestId('student-2');
        
        const johnPresentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        const janeAbsentRadio = within(janeRow).getByRole('radio', { name: /absent/i });
        
        expect(johnPresentRadio).toBeChecked();
        expect(janeAbsentRadio).toBeChecked();
      });
    });

    it('shows update button instead of submit for existing attendance', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update attendance/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /submit attendance/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('renders search input for finding students', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/search students/i)).toBeInTheDocument();
      });
    });

    it('filters students based on search term', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
        expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search students/i);
      await user.type(searchInput, 'john');
      
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.queryByText(/jane smith/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/bob johnson/i)).not.toBeInTheDocument();
      });
    });

    it('shows filter options for attendance status', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation between attendance options', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        
        presentRadio.focus();
        expect(presentRadio).toHaveFocus();
      });

      await user.keyboard('{Tab}');
      
      const johnRow = screen.getByTestId('student-1');
      const absentRadio = within(johnRow).getByRole('radio', { name: /absent/i });
      expect(absentRadio).toHaveFocus();
    });

    it('allows form submission with Enter key', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const johnRow = screen.getByTestId('student-1');
        const presentRadio = within(johnRow).getByRole('radio', { name: /present/i });
        return user.click(presentRadio);
      });

      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      submitButton.focus();
      
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/attendance submitted successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getAllByRole('radiogroup')).toHaveLength(mockStudents.length);
      });
    });

    it('associates form labels with inputs correctly', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search students/i);
        expect(searchInput).toHaveAttribute('id');
        
        const label = document.querySelector('label[for="' + searchInput.id + '"]');
        expect(label).toBeInTheDocument();
      });
    });

    it('announces form validation errors', async () => {
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      // Try to submit without marking any attendance
      const submitButton = screen.getByRole('button', { name: /submit attendance/i });
      
      // Since button should be disabled, we'll check the validation message
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/please mark attendance for at least one student/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large student lists efficiently', async () => {
      const largeStudentList = Array.from({ length: 200 }, (_, i) =>
        createMockStudent({
          id: i + 1,
          firstName: `Student${i + 1}`,
          lastName: 'Test',
          rollNumber: `CS210${String(i + 1).padStart(2, '0')}`
        })
      );

      server.use(
        rest.get('/api/users', (req, res, ctx) => {
          return res(ctx.json({
            users: largeStudentList,
            totalUsers: largeStudentList.length
          }));
        })
      );

      const startTime = performance.now();
      render(<AttendanceForm eventId={1} />, { authUser: mockTeacher });
      
      await waitFor(() => {
        expect(screen.getByText(/student1 test/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render large lists efficiently (under 2 seconds)
      expect(renderTime).toBeLessThan(2000);
    });
  });
});