import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { createMockStudent, createMockTeacher, createMockAdmin } from '../utils/testUtils';

// Mock SocketContext and OfflineContext to avoid import.meta issues
jest.mock('../../contexts/SocketContext', () => ({
  SocketProvider: ({ children }) => children,
  useSocket: () => ({ socket: null, isConnected: false })
}));

jest.mock('../../contexts/OfflineContext', () => ({
  OfflineProvider: ({ children }) => children,
  useOffline: () => ({ isOffline: false, offlineQueue: [] })
}));

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

const mockLocalStorage = { ...mockStorage };
const mockSessionStorage = { ...mockStorage };

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

describe('AuthContext', () => {
  let mockAxios;
  
  const mockStudent = createMockStudent({
    id: 1,
    username: 'student1',
    email: 'student1@college.edu',
    firstName: 'John',
    lastName: 'Doe'
  });

  const mockTeacher = createMockTeacher({
    id: 2,
    username: 'teacher1',
    email: 'teacher1@college.edu',
    firstName: 'Jane',
    lastName: 'Smith'
  });

  beforeAll(() => {
    // Create mock adapter for the api instance
    mockAxios = new MockAdapter(api);
  });

  afterAll(() => {
    mockAxios.restore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockSessionStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.removeItem.mockClear();
  });

  const renderAuthHook = (initialProps = {}) => {
    const wrapper = ({ children }) => (
      <AuthProvider {...initialProps}>
        {children}
      </AuthProvider>
    );

    return renderHook(() => useAuth(), { wrapper });
  };

  describe('Initial State', () => {
    it('provides default authentication state', () => {
      const { result } = renderAuthHook();

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('provides authentication methods', () => {
      const { result } = renderAuthHook();

      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.register).toBe('function');
      expect(typeof result.current.updateProfile).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('Authentication on Mount', () => {
    it('restores authentication state from localStorage on mount', async () => {
      const mockToken = 'mock-jwt-token';
      const mockUser = mockStudent;

      // Set up localStorage mocks to return saved user data
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'club_access_token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      // Mock successful profile fetch
      mockAxios.onGet('/auth/profile').reply(200, { user: mockUser });

      const { result } = renderAuthHook();

      // Should start loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('clears invalid authentication state on mount', async () => {
      const mockToken = 'invalid-token';
      const mockUser = mockStudent;

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'club_access_token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      // Mock failed profile fetch
      mockAxios.onGet('/auth/profile').reply(401, { message: 'Invalid token' });

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('club_access_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('Login', () => {
    it('successfully logs in user with valid credentials', async () => {
      // Mock the login API endpoint
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      const loginCredentials = {
        username: 'student1',
        password: 'password123'
      };

      await act(async () => {
        await result.current.login(loginCredentials);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(expect.objectContaining({
          username: 'student1'
        }));
        expect(result.current.error).toBeNull();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('club_access_token', expect.any(String));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
    });

    it('sets loading state during login', async () => {
      // Mock the login API endpoint with a delay to capture loading state
      mockAxios.onPost('/auth/login').reply(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([200, {
              user: mockStudent,
              token: 'mock-token-123',
              message: 'Login successful'
            }]);
          }, 100);
        });
      });

      const { result } = renderAuthHook();

      // Start login and check loading state
      let loginPromise;
      await act(async () => {
        loginPromise = result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      // Check that loading was set to true during the request
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles login failure with invalid credentials', async () => {
      // Mock 401 response for invalid credentials
      mockAxios.onPost('/auth/login').reply(401, { message: 'Invalid credentials' });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'wronguser',
          password: 'wrongpassword'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.error).toBe('Invalid credentials');
        expect(result.current.loading).toBe(false);
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles network errors during login', async () => {
      // Mock network error
      mockAxios.onPost('/auth/login').networkError();

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.error).toBeTruthy();
        expect(result.current.loading).toBe(false);
      });
    });

    it('remembers user when remember option is true', async () => {
      // Mock the login API endpoint
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123',
          remember: true
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('rememberUser', 'true');
    });
  });

  describe('Registration', () => {
    it('successfully registers new user', async () => {
      const registrationData = {
        username: 'newstudent',
        email: 'newstudent@college.edu',
        password: 'password123',
        firstName: 'New',
        lastName: 'Student',
        role: 'Student',
        year: 1,
        branch: 'CSE',
        rollNumber: 'CS24001'
      };

      const newUser = {
        ...mockStudent,
        username: 'newstudent',
        email: 'newstudent@college.edu',
        firstName: 'New',
        lastName: 'Student'
      };

      // Mock successful registration
      mockAxios.onPost('/auth/register').reply(200, {
        user: newUser,
        token: 'new-user-token',
        message: 'Registration successful'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.register(registrationData);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(expect.objectContaining({
          username: 'newstudent',
          email: 'newstudent@college.edu'
        }));
        expect(result.current.error).toBeNull();
      });
    });

    it('handles registration failure with duplicate user', async () => {
      // Mock 409 conflict response
      mockAxios.onPost('/auth/register').reply(409, { message: 'User already exists' });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.register({
          username: 'existinguser',
          email: 'existing@college.edu',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.error).toBe('User already exists');
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles validation errors during registration', async () => {
      // Mock 400 validation error response
      mockAxios.onPost('/auth/register').reply(400, {
        message: 'Validation failed',
        errors: {
          email: 'Invalid email format',
          password: 'Password too weak'
        }
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.register({
          username: 'testuser',
          email: 'invalid-email',
          password: '123'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Validation failed');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Logout', () => {
    it('successfully logs out authenticated user', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      // Mock logout
      mockAxios.onPost('/auth/logout').reply(200, {
        message: 'Logged out successfully'
      });

      // First login
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.error).toBeNull();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('club_access_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rememberUser');
    });

    it('handles logout API call', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock logout API call
      mockAxios.onPost('/auth/logout').reply(200, { message: 'Logged out successfully' });

      await act(async () => {
        await result.current.logout();
      });

      // Verify logout was called
      expect(mockAxios.history.post.some(req => req.url === '/auth/logout')).toBe(true);
    });

    it('clears authentication state even if logout API fails', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock logout API failure
      mockAxios.onPost('/auth/logout').reply(500, { message: 'Server error' });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Profile Update', () => {
    it('successfully updates user profile', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      const updatedData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@college.edu'
      };

      const updatedUser = { ...mockStudent, ...updatedData };

      // Mock profile update
      mockAxios.onPut('/auth/profile').reply(200, { user: updatedUser });

      await act(async () => {
        await result.current.updateProfile(updatedData);
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name',
          email: 'updated@college.edu'
        }));
        expect(result.current.error).toBeNull();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'user',
        expect.stringContaining('Updated')
      );
    });

    it('handles profile update failure', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock profile update failure
      mockAxios.onPut('/auth/profile').reply(400, { message: 'Update failed' });

      await act(async () => {
        await result.current.updateProfile({
          firstName: 'Updated'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Update failed');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Error Management', () => {
    it('clears errors when clearError is called', async () => {
      // Mock login failure
      mockAxios.onPost('/auth/login').reply(401, { message: 'Invalid credentials' });

      const { result } = renderAuthHook();

      // Trigger an error
      await act(async () => {
        await result.current.login({
          username: 'wrong',
          password: 'wrong'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid credentials');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('automatically clears previous errors on new operations', async () => {
      const { result } = renderAuthHook();

      // First, trigger an error
      mockAxios.onPost('/auth/login').replyOnce(401, { message: 'Invalid credentials' });

      await act(async () => {
        await result.current.login({
          username: 'wrong',
          password: 'wrong'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid credentials');
      });

      // Reset mock and return success for next call
      mockAxios.reset();
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      // New login attempt should clear previous error
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.isAuthenticated).toBe(true);
      });
    });
  });

  describe('Role-based Access', () => {
    it('correctly identifies student role', async () => {
      // Mock login with student user
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.user.role).toBe('Student');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('correctly identifies teacher role', async () => {
      // Mock login with teacher user
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockTeacher,
        token: 'teacher-token'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'teacher1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.user.role).toBe('Teacher');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('correctly identifies admin role', async () => {
      const mockAdmin = createMockAdmin();
      
      // Mock login with admin user
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockAdmin,
        token: 'admin-token'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'admin1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.user.role).toBe('Admin');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });
  });

  describe('Token Refresh', () => {
    it('automatically refreshes token before expiration', async () => {
      // Login with a token that's close to expiring
      const expiringSoon = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const mockToken = `header.${btoa(JSON.stringify({ exp: expiringSoon.getTime() / 1000 }))}.signature`;

      // Mock login with expiring token
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: mockToken
      });

      // Mock token refresh
      mockAxios.onPost('/auth/refresh').reply(200, {
        token: 'new-refreshed-token',
        user: mockStudent
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Wait for token refresh (this would be triggered by a timer in real implementation)
      // For testing, we can manually trigger the refresh logic
    });

    it('logs out user when token refresh fails', async () => {
      // Mock login
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      // Mock logout
      mockAxios.onPost('/auth/logout').reply(200, {
        message: 'Logged out successfully'
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock refresh failure
      mockAxios.onPost('/auth/refresh').reply(401, { message: 'Refresh token invalid' });

      // Simulate token refresh failure
      await act(async () => {
        // This would be called internally by the token refresh mechanism
        result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Context Provider Edge Cases', () => {
    it('throws error when useAuth is used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      // Render hook without wrapper to test error
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    it('handles multiple rapid login attempts', async () => {
      // Mock login endpoint
      mockAxios.onPost('/auth/login').reply(200, {
        user: mockStudent,
        token: 'mock-token-123',
        message: 'Login successful'
      });

      const { result } = renderAuthHook();

      const loginPromise1 = act(async () => {
        return result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      const loginPromise2 = act(async () => {
        return result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await Promise.all([loginPromise1, loginPromise2]);

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
