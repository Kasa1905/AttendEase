import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Profile(){
  const { user } = useAuth();
  if (!user) return <div>Not logged in</div>;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="bg-white p-4 rounded shadow">
        <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
      </div>
    </div>
  );
}
