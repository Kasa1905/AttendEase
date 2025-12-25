import { http, HttpResponse } from 'msw';
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
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { username, password } = await request.json();
    
    const user = mockUsers.find(u => u.username === username);
    
    if (!user) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
    // Mock password validation (in real app this would be hashed)
    if (password !== 'password123') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
    mockAuthToken = `mock-token-${user.id}-${Date.now()}`;
    currentUser = user;
    
    return HttpResponse.json({
      user,
      token: mockAuthToken,
      message: 'Login successful'
    });
  }),

  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const userData = await request.json();
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => 
      u.email === userData.email || u.username === userData.username
    );
    
    if (existingUser) {
      return HttpResponse.json({ message: 'User already exists' }, { status: 409 });
    }
    
    const newUser = {
      id: mockUsers.length + 1,
      ...userData,
      isActive: true,
      dutyEligible: userData.role === 'Student'
    };
    
    mockUsers.push(newUser);
    
    return HttpResponse.json({
      user: newUser,
      message: 'Registration successful'
    }, { status: 201 });
  }),

  http.get(`${BASE}/auth/profile`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || !mockAuthToken) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    return HttpResponse.json({ user: currentUser });
  }),

  http.post(`${BASE}/auth/logout`, () => {
    mockAuthToken = null;
    currentUser = null;
    
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  // Default User endpoints (tests may override using server.use)
  http.get(`${BASE}/users`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const role = url.searchParams.get('role');

    if (role === 'Student') {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginated = mockStudentsList.slice(startIndex, endIndex);
      return HttpResponse.json({
        users: paginated,
        totalUsers: mockStudentsList.length,
        totalPages: Math.ceil(mockStudentsList.length / limit),
        currentPage: page
      });
    }

    let filteredUsers = [...mockUsers];
    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return HttpResponse.json({
      users: paginatedUsers,
      totalUsers: filteredUsers.length,
      totalPages: Math.ceil(filteredUsers.length / limit),
      currentPage: page
    });
  }),

  http.get(`${BASE}/users/:id`, ({ params }) => {
    const { id } = params;
    const user = mockUsers.find(u => u.id === parseInt(id));
    
    if (!user) {
      return HttpResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    return HttpResponse.json({ user });
  }),

  http.put(`${BASE}/users/:id`, async ({ params, request }) => {
    const { id } = params;
    const updates = await request.json();
    const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
    
    if (userIndex === -1) {
      return HttpResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    mockUsers[userIndex] = { ...mockUsers[userIndex], ...updates };
    
    return HttpResponse.json({
      user: mockUsers[userIndex],
      message: 'User updated successfully'
    });
  }),

  // Event endpoints
  http.get(`${BASE}/events`, ({ request }) => {
    const url = new URL(request.url);
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
    
    return HttpResponse.json({
      events: paginatedEvents,
      totalEvents: filteredEvents.length,
      totalPages: Math.ceil(filteredEvents.length / limit),
      currentPage: page
    });
  }),

  http.post(`${BASE}/events`, async ({ request }) => {
    const eventData = await request.json();
    
    const newEvent = {
      id: mockEvents.length + 1,
      ...eventData,
      isActive: true,
      createdBy: currentUser?.id || 2
    };
    
    mockEvents.push(newEvent);
    
    return HttpResponse.json({
      event: newEvent,
      message: 'Event created successfully'
    }, { status: 201 });
  }),

  // Default: GET /events/:id (tests may override per-case using server.use)
  http.get(`${BASE}/events/:id`, ({ params }) => {
    const { id } = params;
    const event = mockEvents.find(e => e.id === parseInt(id));

    if (!event) {
      return HttpResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return HttpResponse.json({ event });
  }),

  http.put(`${BASE}/events/:id`, async ({ params, request }) => {
    const { id } = params;
    const updates = await request.json();
    const eventIndex = mockEvents.findIndex(e => e.id === parseInt(id));
    
    if (eventIndex === -1) {
      return HttpResponse.json({ message: 'Event not found' }, { status: 404 });
    }
    
    mockEvents[eventIndex] = { ...mockEvents[eventIndex], ...updates };
    
    return HttpResponse.json({
      event: mockEvents[eventIndex],
      message: 'Event updated successfully'
    });
  }),

  http.delete(`${BASE}/events/:id`, ({ params }) => {
    const { id } = params;
    const eventIndex = mockEvents.findIndex(e => e.id === parseInt(id));
    
    if (eventIndex === -1) {
      return HttpResponse.json({ message: 'Event not found' }, { status: 404 });
    }
    
    mockEvents.splice(eventIndex, 1);
    
    return HttpResponse.json({ message: 'Event deleted successfully' });
  }),

  // Attendance endpoints
  http.get(`${BASE}/attendance`, ({ request }) => {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const userId = url.searchParams.get('userId');

    let filtered = [...mockAttendance];
    if (eventId) filtered = filtered.filter(a => a.eventId === parseInt(eventId));
    if (userId) filtered = filtered.filter(a => a.userId === parseInt(userId));

    return HttpResponse.json({ attendance: filtered });
  }),

  http.post(`${BASE}/attendance`, async ({ request }) => {
    const attendanceData = await request.json();
    
    const newAttendance = {
      id: mockAttendance.length + 1,
      ...attendanceData,
      checkInTime: new Date().toISOString(),
      markedBy: currentUser?.id || 2
    };
    
    mockAttendance.push(newAttendance);
    
    return HttpResponse.json({
      attendance: newAttendance,
      message: 'Attendance marked successfully'
    }, { status: 201 });
  }),

  http.put(`${BASE}/attendance/:id`, async ({ params, request }) => {
    const { id } = params;
    const updates = await request.json();
    const attendanceIndex = mockAttendance.findIndex(a => a.id === parseInt(id));
    
    if (attendanceIndex === -1) {
      return HttpResponse.json({ message: 'Attendance record not found' }, { status: 404 });
    }
    
    mockAttendance[attendanceIndex] = { ...mockAttendance[attendanceIndex], ...updates };
    
    return HttpResponse.json({
      attendance: mockAttendance[attendanceIndex],
      message: 'Attendance updated successfully'
    });
  }),

  // Reports endpoints
  http.get(`${BASE}/reports/attendance`, ({ request }) => {
    const url = new URL(request.url);
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
    
    return HttpResponse.json(mockReport);
  }),

  // Error simulation endpoints for testing
  http.get(`${BASE}/error/500`, () => {
    return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
  }),

  http.get(`${BASE}/error/404`, () => {
    return HttpResponse.json({ message: 'Resource not found' }, { status: 404 });
  }),

  http.get(`${BASE}/error/timeout`, () => {
    return HttpResponse.text('delayed', { delay: 30000 });
  }),

  // Note: No wildcard fallback handler here to allow test-specific overrides to take precedence
];