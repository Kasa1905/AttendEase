import { rest } from 'msw';
import { API_BASE } from '../../config/env';
// Use plain path base so test-specific server.use("/api/…") handlers override predictably
const BASE_RAW = API_BASE || '/api';
const BASE = BASE_RAW.startsWith('/') ? BASE_RAW : `/${BASE_RAW}`;

// Mock user data
const mockUsers = [
  {
    id: 1,
    username: 'student1',
    email: 'student1@college.edu',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Student',
    year: 2,
    branch: 'CSE',
    rollNumber: 'CS21001',
    isActive: true,
    dutyEligible: true
  },
  {
    id: 2,
    username: 'teacher1',
    email: 'teacher1@college.edu',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'Teacher',
    isActive: true
  },
  {
    id: 3,
    username: 'admin1',
    email: 'admin1@college.edu',
    firstName: 'Admin',
    lastName: 'User',
    role: 'Admin',
    isActive: true
  }
];

// Default mock students list for endpoints that request role=Student
// Keep separate from mockUsers to avoid role/name conflicts used in tests
const mockStudentsList = [
  {
    id: 1,
    username: 'student1',
    email: 'student1@college.edu',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Student',
    year: 2,
    branch: 'CSE',
    rollNumber: 'CS21001',
    isActive: true,
    dutyEligible: true
  },
  {
    id: 2,
    username: 'student2',
    email: 'student2@college.edu',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'Student',
    year: 2,
    branch: 'CSE',
    rollNumber: 'CS21002',
    isActive: true,
    dutyEligible: false
  },
  {
    id: 3,
    username: 'student3',
    email: 'student3@college.edu',
    firstName: 'Bob',
    lastName: 'Johnson',
    role: 'Student',
    year: 2,
    branch: 'CSE',
    rollNumber: 'CS21003',
    isActive: true,
    dutyEligible: false
  }
];

// Mock events data
const mockEvents = [
  {
    id: 1,
    name: 'Weekly Meeting',
    description: 'Regular club meeting',
    date: '2024-01-15',
    time: '14:00',
    location: 'Room 101',
    type: 'Meeting',
    isActive: true,
    createdBy: 2
  },
  {
    id: 2,
    name: 'Annual Fest',
    description: 'College annual festival',
    date: '2024-02-20',
    time: '10:00',
    location: 'Main Auditorium',
    type: 'Event',
    isActive: true,
    createdBy: 2
  }
];

// Mock attendance records (empty by default; tests may override per-suite)
const mockAttendance = [];

// Authentication token for mocked sessions
let mockAuthToken = null;
let currentUser = null;

export const handlers = [
  // Authentication endpoints
  rest.post(`${BASE}/auth/login`, (req, res, ctx) => {
    const { username, password } = req.body;
    
    const user = mockUsers.find(u => u.username === username);
    
    if (!user) {
      return res(
        ctx.status(401),
        ctx.json({ message: 'Invalid credentials' })
      );
    }
    
    // Mock password validation (in real app this would be hashed)
    if (password !== 'password123') {
      return res(
        ctx.status(401),
        ctx.json({ message: 'Invalid credentials' })
      );
    }
    
    mockAuthToken = `mock-token-${user.id}-${Date.now()}`;
    currentUser = user;
    
    return res(
      ctx.status(200),
      ctx.json({
        user,
        token: mockAuthToken,
        message: 'Login successful'
      })
    );
  }),

  rest.post(`${BASE}/auth/register`, (req, res, ctx) => {
    const userData = req.body;
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => 
      u.email === userData.email || u.username === userData.username
    );
    
    if (existingUser) {
      return res(
        ctx.status(409),
        ctx.json({ message: 'User already exists' })
      );
    }
    
    const newUser = {
      id: mockUsers.length + 1,
      ...userData,
      isActive: true,
      dutyEligible: userData.role === 'Student'
    };
    
    mockUsers.push(newUser);
    
    return res(
      ctx.status(201),
      ctx.json({
        user: newUser,
        message: 'Registration successful'
      })
    );
  }),

  rest.get(`${BASE}/auth/profile`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || !mockAuthToken) {
      return res(
        ctx.status(401),
        ctx.json({ message: 'Unauthorized' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({ user: currentUser })
    );
  }),

  rest.post(`${BASE}/auth/logout`, (req, res, ctx) => {
    mockAuthToken = null;
    currentUser = null;
    
    return res(
      ctx.status(200),
      ctx.json({ message: 'Logged out successfully' })
    );
  }),

  // Default User endpoints (tests may override using server.use)
  rest.get(`${BASE}/users`, (req, res, ctx) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const role = url.searchParams.get('role');

    if (role === 'Student') {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginated = mockStudentsList.slice(startIndex, endIndex);
      return res(
        ctx.status(200),
        ctx.json({
          users: paginated,
          totalUsers: mockStudentsList.length,
          totalPages: Math.ceil(mockStudentsList.length / limit),
          currentPage: page
        })
      );
    }

    let filteredUsers = [...mockUsers];
    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return res(
      ctx.status(200),
      ctx.json({
        users: paginatedUsers,
        totalUsers: filteredUsers.length,
        totalPages: Math.ceil(filteredUsers.length / limit),
        currentPage: page
      })
    );
  }),

  rest.get(`${BASE}/users/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const user = mockUsers.find(u => u.id === parseInt(id));
    
    if (!user) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'User not found' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({ user })
    );
  }),

  rest.put(`${BASE}/users/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body;
    const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
    
    if (userIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'User not found' })
      );
    }
    
    mockUsers[userIndex] = { ...mockUsers[userIndex], ...updates };
    
    return res(
      ctx.status(200),
      ctx.json({
        user: mockUsers[userIndex],
        message: 'User updated successfully'
      })
    );
  }),

  // Event endpoints
  rest.get(`${BASE}/events`, (req, res, ctx) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const type = url.searchParams.get('type');
    
    let filteredEvents = [...mockEvents];
    
    if (type) {
      filteredEvents = filteredEvents.filter(e => e.type === type);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex);
    
    return res(
      ctx.status(200),
      ctx.json({
        events: paginatedEvents,
        totalEvents: filteredEvents.length,
        totalPages: Math.ceil(filteredEvents.length / limit),
        currentPage: page
      })
    );
  }),

  rest.post(`${BASE}/events`, (req, res, ctx) => {
    const eventData = req.body;
    
    const newEvent = {
      id: mockEvents.length + 1,
      ...eventData,
      isActive: true,
      createdBy: currentUser?.id || 2
    };
    
    mockEvents.push(newEvent);
    
    return res(
      ctx.status(201),
      ctx.json({
        event: newEvent,
        message: 'Event created successfully'
      })
    );
  }),

  // Default: GET /events/:id (tests may override per-case using server.use)
  rest.get(`${BASE}/events/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const event = mockEvents.find(e => e.id === parseInt(id));

    if (!event) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Event not found' })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({ event })
    );
  }),

  rest.put(`${BASE}/events/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body;
    const eventIndex = mockEvents.findIndex(e => e.id === parseInt(id));
    
    if (eventIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Event not found' })
      );
    }
    
    mockEvents[eventIndex] = { ...mockEvents[eventIndex], ...updates };
    
    return res(
      ctx.status(200),
      ctx.json({
        event: mockEvents[eventIndex],
        message: 'Event updated successfully'
      })
    );
  }),

  rest.delete(`${BASE}/events/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const eventIndex = mockEvents.findIndex(e => e.id === parseInt(id));
    
    if (eventIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Event not found' })
      );
    }
    
    mockEvents.splice(eventIndex, 1);
    
    return res(
      ctx.status(200),
      ctx.json({ message: 'Event deleted successfully' })
    );
  }),

  // Attendance endpoints
  rest.get(`${BASE}/attendance`, (req, res, ctx) => {
    const url = new URL(req.url);
    const eventId = url.searchParams.get('eventId');
    const userId = url.searchParams.get('userId');

    let filtered = [...mockAttendance];
    if (eventId) filtered = filtered.filter(a => a.eventId === parseInt(eventId));
    if (userId) filtered = filtered.filter(a => a.userId === parseInt(userId));

    return res(ctx.status(200), ctx.json({ attendance: filtered }));
  }),

  rest.post(`${BASE}/attendance`, (req, res, ctx) => {
    const attendanceData = req.body;
    
    const newAttendance = {
      id: mockAttendance.length + 1,
      ...attendanceData,
      checkInTime: new Date().toISOString(),
      markedBy: currentUser?.id || 2
    };
    
    mockAttendance.push(newAttendance);
    
    return res(
      ctx.status(201),
      ctx.json({
        attendance: newAttendance,
        message: 'Attendance marked successfully'
      })
    );
  }),

  rest.put(`${BASE}/attendance/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body;
    const attendanceIndex = mockAttendance.findIndex(a => a.id === parseInt(id));
    
    if (attendanceIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Attendance record not found' })
      );
    }
    
    mockAttendance[attendanceIndex] = { ...mockAttendance[attendanceIndex], ...updates };
    
    return res(
      ctx.status(200),
      ctx.json({
        attendance: mockAttendance[attendanceIndex],
        message: 'Attendance updated successfully'
      })
    );
  }),

  // Reports endpoints
  rest.get(`${BASE}/reports/attendance`, (req, res, ctx) => {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const eventId = url.searchParams.get('eventId');
    
    // Mock attendance report data
    const mockReport = {
      summary: {
        totalEvents: mockEvents.length,
        totalAttendance: mockAttendance.length,
        averageAttendance: 85.5,
        topAttendees: [
          { userId: 1, name: 'John Doe', attendanceCount: 12, percentage: 92.3 },
          { userId: 2, name: 'Jane Smith', attendanceCount: 10, percentage: 83.3 }
        ]
      },
      details: mockAttendance.map(a => {
        const user = mockUsers.find(u => u.id === a.userId);
        const event = mockEvents.find(e => e.id === a.eventId);
        return {
          ...a,
          userName: `${user?.firstName} ${user?.lastName}`,
          eventName: event?.name
        };
      })
    };
    
    return res(
      ctx.status(200),
      ctx.json(mockReport)
    );
  }),

  // Error simulation endpoints for testing
  rest.get(`${BASE}/error/500`, (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ message: 'Internal server error' })
    );
  }),

  rest.get(`${BASE}/error/404`, (req, res, ctx) => {
    return res(
      ctx.status(404),
      ctx.json({ message: 'Resource not found' })
    );
  }),

  rest.get(`${BASE}/error/timeout`, (req, res, ctx) => {
    return res(ctx.delay(30000));
  }),

  // Note: No wildcard fallback handler here to allow test-specific overrides to take precedence
];