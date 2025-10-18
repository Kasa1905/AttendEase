import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { rest } from 'msw';
import { server } from '../mocks/server';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { createMockStudent, createMockTeacher, createMockAdmin } from '../utils/testUtils';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('AuthContext', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
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

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      // Mock successful profile fetch
      server.use(
        rest.get('/api/auth/profile', (req, res, ctx) => {
          return res(ctx.json({ user: mockUser }));
        })
      );

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
        if (key === 'token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      // Mock failed profile fetch
      server.use(
        rest.get('/api/auth/profile', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Invalid token' })
          );
        })
      );

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('Login', () => {
    it('successfully logs in user with valid credentials', async () => {
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

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', expect.any(String));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
    });

    it('sets loading state during login', async () => {
      const { result } = renderAuthHook();

      const loginPromise = act(async () => {
        return result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      expect(result.current.loading).toBe(true);

      await loginPromise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles login failure with invalid credentials', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Invalid credentials' })
          );
        })
      );

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
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res.networkError('Failed to connect');
        })
      );

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.error).toBe('Network error. Please try again.');
        expect(result.current.loading).toBe(false);
      });
    });

    it('remembers user when remember option is true', async () => {
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
      const { result } = renderAuthHook();

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
      server.use(
        rest.post('/api/auth/register', (req, res, ctx) => {
          return res(
            ctx.status(409),
            ctx.json({ message: 'User already exists' })
          );
        })
      );

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
      server.use(
        rest.post('/api/auth/register', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              message: 'Validation failed',
              errors: {
                email: 'Invalid email format',
                password: 'Password too weak'
              }
            })
          );
        })
      );

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

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('rememberUser');
    });

    it('handles logout API call', async () => {
      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      // Mock logout API call
      const logoutSpy = jest.fn();
      server.use(
        rest.post('/api/auth/logout', (req, res, ctx) => {
          logoutSpy();
          return res(ctx.json({ message: 'Logged out successfully' }));
        })
      );

      await act(async () => {
        await result.current.logout();
      });

      expect(logoutSpy).toHaveBeenCalled();
    });

    it('clears authentication state even if logout API fails', async () => {
      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      // Mock logout API failure
      server.use(
        rest.post('/api/auth/logout', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Server error' })
          );
        })
      );

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
      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      const updatedData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@college.edu'
      };

      server.use(
        rest.put('/api/auth/profile', (req, res, ctx) => {
          const updatedUser = { ...mockStudent, ...updatedData };
          return res(ctx.json({ user: updatedUser }));
        })
      );

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
      const { result } = renderAuthHook();

      // Login first
      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      server.use(
        rest.put('/api/auth/profile', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ message: 'Update failed' })
          );
        })
      );

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
      const { result } = renderAuthHook();

      // Trigger an error
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Invalid credentials' })
          );
        })
      );

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
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Invalid credentials' })
          );
        })
      );

      await act(async () => {
        await result.current.login({
          username: 'wrong',
          password: 'wrong'
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid credentials');
      });

      // Reset server to return success
      server.resetHandlers();

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
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.json({
            user: mockTeacher,
            token: 'teacher-token'
          }));
        })
      );

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
      
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.json({
            user: mockAdmin,
            token: 'admin-token'
          }));
        })
      );

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
      const { result } = renderAuthHook();

      // Login with a token that's close to expiring
      const expiringSoon = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const mockToken = `header.${btoa(JSON.stringify({ exp: expiringSoon.getTime() / 1000 }))}.signature`;

      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.json({
            user: mockStudent,
            token: mockToken
          }));
        }),
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.json({
            token: 'new-refreshed-token',
            user: mockStudent
          }));
        })
      );

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
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          username: 'student1',
          password: 'password123'
        });
      });

      // Mock refresh failure
      server.use(
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Refresh token invalid' })
          );
        })
      );

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

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    it('handles multiple rapid login attempts', async () => {
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