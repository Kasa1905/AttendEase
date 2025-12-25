import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../components/auth/Login';
import { render, createMockUser } from '../utils/testUtils';
import { API_BASE } from '../../config/env.test';

// Mock the auth context
const mockLogin = jest.fn();
const mockAuthContext = {
  login: mockLogin,
  user: null,
  loading: false
};

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => mockAuthContext
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

describe('Login Component', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    mockLogin.mockClear();
    mockNavigate.mockClear();
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders login form with all required fields', () => {
      render(<Login />);
      
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByText(/no account/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
    });

    it('renders with correct initial state', () => {
      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
      expect(rememberMeCheckbox).not.toBeChecked();
      expect(loginButton).toBeEnabled();
    });
  });

  describe('Form Interactions', () => {
    it('updates input values when user types', async () => {
      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('toggles remember me checkbox when clicked', async () => {
      render(<Login />);
      
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      
      expect(rememberMeCheckbox).not.toBeChecked();
      
      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).toBeChecked();
      
      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).not.toBeChecked();
    });
  });

  describe('Form Submission', () => {
    it('successfully logs in with valid credentials and navigates to student dashboard', async () => {
      const mockUser = createMockUser({
        email: 'student@example.com',
        role: 'student'
      });

      mockLogin.mockResolvedValue(mockUser);

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'student@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('student@example.com', 'password123', false);
        expect(mockNavigate).toHaveBeenCalledWith('/student');
      });
    });

    it('navigates to core dashboard for core_team users', async () => {
      const mockUser = createMockUser({
        email: 'core@example.com',
        role: 'core_team'
      });

      mockLogin.mockResolvedValue(mockUser);

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'core@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('core@example.com', 'password123', false);
        expect(mockNavigate).toHaveBeenCalledWith('/core');
      });
    });

    it('navigates to teacher dashboard for teacher users', async () => {
      const mockUser = createMockUser({
        email: 'teacher@example.com',
        role: 'teacher'
      });

      mockLogin.mockResolvedValue(mockUser);

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'teacher@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('teacher@example.com', 'password123', false);
        expect(mockNavigate).toHaveBeenCalledWith('/teacher');
      });
    });

    it('passes remember me option when checkbox is checked', async () => {
      const mockUser = createMockUser({
        email: 'student@example.com',
        role: 'student'
      });

      mockLogin.mockResolvedValue(mockUser);

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'student@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(rememberMeCheckbox);
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('student@example.com', 'password123', true);
      });
    });

    it('navigates to redirect location if provided', async () => {
      const mockUser = createMockUser({
        email: 'student@example.com',
        role: 'student'
      });

      mockLogin.mockResolvedValue(mockUser);

      // Mock useLocation to return a redirect location
      const useLocationMock = jest.spyOn(require('react-router-dom'), 'useLocation');
      useLocationMock.mockReturnValue({
        state: { from: { pathname: '/attendance' } }
      });

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'student@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/attendance', { replace: true });
      });

      useLocationMock.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('shows error message when login fails', async () => {
      const errorMessage = 'Invalid credentials';
      mockLogin.mockRejectedValue({
        response: { data: { error: errorMessage } }
      });

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('wrong@example.com', 'wrongpassword', false);
      });

      // The component uses react-hot-toast for error display, which we've mocked
      // We can verify the toast.error was called in the mock
      const toast = require('react-hot-toast').default;
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it('shows generic error message when no specific error is provided', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
      });

      const toast = require('react-hot-toast').default;
      expect(toast.error).toHaveBeenCalledWith('Login failed');
    });
  });

  describe('Success Handling', () => {
    it('shows success message when login succeeds', async () => {
      const mockUser = createMockUser({
        email: 'student@example.com',
        role: 'student'
      });

      mockLogin.mockResolvedValue(mockUser);

      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'student@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('student@example.com', 'password123', false);
      });

      const toast = require('react-hot-toast').default;
      expect(toast.success).toHaveBeenCalledWith('Logged in');
    });
  });

  describe('Navigation Links', () => {
    it('has correct link to registration page', () => {
      render(<Login />);
      
      const registerLink = screen.getByRole('link', { name: /register/i });
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Form Validation', () => {
    it('does not submit form when email is empty', async () => {
      render(<Login />);
      
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);
      
      // Since react-hook-form handles validation, login should not be called
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('does not submit form when password is empty', async () => {
      render(<Login />);
      
      const emailInput = screen.getByPlaceholderText(/email/i);
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.click(loginButton);
      
      // Since react-hook-form handles validation, login should not be called
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('does not submit form when both fields are empty', async () => {
      render(<Login />);
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      
      await user.click(loginButton);
      
      // Since react-hook-form handles validation, login should not be called
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });
});