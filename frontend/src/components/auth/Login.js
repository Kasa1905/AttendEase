import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { register, handleSubmit } = useForm();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const onSubmit = async (data) => {
    try {
      const user = await auth.login(data.email, data.password, data.rememberMe);
      toast.success('Logged in');
      if (from) return navigate(from, { replace: true });
      if (user.role === 'core_team') navigate('/core');
      else if (user.role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Login</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input {...register('email', { required: true })} placeholder="Email" className="w-full p-2 border rounded" />
        <input {...register('password', { required: true })} type="password" placeholder="Password" className="w-full p-2 border rounded" />
        <label className="flex items-center gap-2"><input type="checkbox" {...register('rememberMe')} /> Remember me</label>
        <button type="submit" className="btn-primary w-full">Login</button>
      </form>
      <p className="mt-4 text-sm">No account? <Link to="/register" className="text-accent">Register</Link></p>
    </div>
  );
}
