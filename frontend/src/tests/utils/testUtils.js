import React from 'react';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Custom render function that includes providers
function render(ui, {
  initialEntries = ['/'],
  authUser = null,
  theme = 'light',
  ...renderOptions
} = {}) {
  
  // Mock AuthContext value
  const mockAuthValue = {
    user: authUser,
    isAuthenticated: !!authUser,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    updateProfile: jest.fn(),
    loading: false,
    error: null
  };

  // Mock ThemeContext value
  const mockThemeValue = {
    theme,
    toggleTheme: jest.fn(),
    isDark: theme === 'dark'
  };

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <ThemeProvider value={mockThemeValue}>
          <AuthProvider value={mockAuthValue}>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );
  }

  const result = rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
  
  return {
    ...result,
    // Add additional utility methods
    rerender: (newUi) => result.rerender(
      <Wrapper>{newUi}</Wrapper>
    ),
    mockAuthValue,
    mockThemeValue
  };
}

// Custom render for components with memory router for testing navigation
function renderWithRouter(ui, {
  initialEntries = ['/'],
  authUser = null,
  ...renderOptions
} = {}) {
  
  const mockAuthValue = {
    user: authUser,
    isAuthenticated: !!authUser,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    updateProfile: jest.fn(),
    loading: false,
    error: null
  };

  function Wrapper({ children }) {
    return (
      <BrowserRouter initialEntries={initialEntries}>
        <AuthProvider value={mockAuthValue}>
          {children}
        </AuthProvider>
      </BrowserRouter>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock user factories
export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Student',
  year: 2,
  branch: 'CSE',
  rollNumber: 'CS21001',
  isActive: true,
  dutyEligible: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockStudent = (overrides = {}) =>
  createMockUser({
    role: 'Student',
    year: 2,
    branch: 'CSE',
    rollNumber: 'CS21001',
    dutyEligible: true,
    ...overrides
  });

export const createMockTeacher = (overrides = {}) =>
  createMockUser({
    role: 'Teacher',
    year: null,
    branch: null,
    rollNumber: null,
    dutyEligible: false,
    ...overrides
  });

export const createMockAdmin = (overrides = {}) =>
  createMockUser({
    role: 'Admin',
    year: null,
    branch: null,
    rollNumber: null,
    dutyEligible: false,
    ...overrides
  });

// Mock event factories
export const createMockEvent = (overrides = {}) => ({
  id: 1,
  name: 'Test Event',
  description: 'A test event',
  date: '2024-01-15',
  time: '14:00',
  location: 'Room 101',
  type: 'Meeting',
  isActive: true,
  createdBy: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// Mock attendance factories
export const createMockAttendance = (overrides = {}) => ({
  id: 1,
  eventId: 1,
  userId: 1,
  status: 'Present',
  dutyEligible: true,
  checkInTime: new Date().toISOString(),
  checkOutTime: null,
  markedBy: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// Utility functions for common test scenarios
export const waitForLoadingToFinish = async () => {
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
};

export const waitForElementToBeRemoved = async (element) => {
  await waitFor(() => {
    expect(element).not.toBeInTheDocument();
  });
};

// Form testing utilities
export const fillAndSubmitForm = async (formData, user) => {
  Object.entries(formData).forEach(([fieldName, value]) => {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
    user.clear(field);
    user.type(field, value);
  });
  
  const submitButton = screen.getByRole('button', { name: /submit/i });
  await user.click(submitButton);
};

// API response utilities
export const mockApiResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data))
});

export const mockApiError = (message = 'API Error', status = 500) => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue({ message }),
  text: jest.fn().mockResolvedValue(JSON.stringify({ message }))
});

// Local storage utilities
export const mockLocalStorage = () => {
  const store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    })
  };
};

// Date utilities for testing
export const mockDate = (dateString) => {
  const mockDate = new Date(dateString);
  const spy = jest.spyOn(global, 'Date');
  spy.mockImplementation((date) => date ? new Date(date) : mockDate);
  return spy;
};

// Window utilities
export const mockWindowLocation = (url = 'http://localhost:3000') => {
  delete window.location;
  window.location = new URL(url);
};

// Custom matchers
export const customMatchers = {
  toHaveFormError: (received, expectedError) => {
    const errorElement = received.querySelector('.error-message, .text-red-500, [role="alert"]');
    const hasError = errorElement && errorElement.textContent.includes(expectedError);
    
    return {
      pass: hasError,
      message: () => hasError
        ? `Expected form not to have error "${expectedError}"`
        : `Expected form to have error "${expectedError}"`
    };
  },
  
  toBeLoading: (received) => {
    const isLoading = received.querySelector('[data-testid="loading-spinner"], .loading, .spinner');
    
    return {
      pass: !!isLoading,
      message: () => isLoading
        ? 'Expected element not to be loading'
        : 'Expected element to be loading'
    };
  }
};

// Setup function to be called in test files
export const setupTests = () => {
  // Add custom matchers
  expect.extend(customMatchers);
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });
};

// Export utilities
export * from '@testing-library/react';
export { render, renderWithRouter };

// Export commonly used testing utilities
export {
  screen,
  waitFor,
  waitForElementToDisappear
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';