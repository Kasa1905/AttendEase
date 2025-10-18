import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register: r, handleSubmit, watch, formState: { errors }, getValues } = useForm({ defaultValues: { role: 'student' } });
  const auth = useAuth();
  const navigate = useNavigate();

  const role = watch('role');

  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).{8,}$/;

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      // strip confirmPassword
      delete payload.confirmPassword;
      await auth.register(payload);
      toast.success('Registered — logging you in');
      // auto-login
      await auth.login(data.email, data.password, true);
      // route based on role
      if (data.role === 'core_team') navigate('/core');
      else if (data.role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Registration failed');
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Register</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3">
  <input {...r('firstName', { required: 'First name is required' })} placeholder="First name" className="w-full p-2 border rounded" />
  {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message}</p>}

  <input {...r('lastName', { required: 'Last name is required' })} placeholder="Last name" className="w-full p-2 border rounded" />
  {errors.lastName && <p className="text-sm text-red-500">{errors.lastName.message}</p>}

  <input {...r('email', { required: 'Email is required', pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Enter a valid email' } })} placeholder="Email" className="w-full p-2 border rounded" />
  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}

  <input {...r('password', { required: 'Password is required', pattern: { value: PASSWORD_REGEX, message: 'Password must be at least 8 characters and include uppercase, lowercase, a number and a special character' } })} type="password" placeholder="Password" className="w-full p-2 border rounded" />
  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}

  <input {...r('confirmPassword', { required: 'Please confirm your password', validate: value => value === getValues('password') || 'Passwords do not match' })} type="password" placeholder="Confirm Password" className="w-full p-2 border rounded" />
  {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
        <label className="block">Role
          <select {...r('role')} className="w-full p-2 border rounded">
            <option value="student">Student</option>
            <option value="core_team">Core Team</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>
        {role === 'student' && (
          <div className="flex gap-2">
            <input {...r('studentId')} placeholder="Student ID" className="flex-1 p-2 border rounded" />
            <input {...r('section')} placeholder="Section" className="w-24 p-2 border rounded" />
          </div>
        )}
        <div className="flex gap-2">
          <input {...r('department')} placeholder="Department" className="flex-1 p-2 border rounded" />
          <input {...r('year')} placeholder="Year" className="w-24 p-2 border rounded" />
        </div>
        <button type="submit" className="btn-primary">Register</button>
      </form>
      <p className="mt-4 text-sm">Already have an account? <Link to="/login" className="text-accent">Login</Link></p>
    </div>
  );
}
