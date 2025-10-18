import React from 'react';
import { useForm } from 'react-hook-form';
import useApi from '../../hooks/useApi';
import Button from '../common/Button';
import { showToast, getTodayDateString, getDeadlineStatus } from '../../utils/helpers';

export default function LeaveRequestForm({ onSubmitted }) {
  const api = useApi();
  const { register, handleSubmit, reset, watch } = useForm({ defaultValues: { requestType: 'leave', requestDate: getTodayDateString(), reason: '' } });
  const watchedDate = watch('requestDate');
  const { status: deadlineStatusStatus, message: deadlineStatusMessage } = getDeadlineStatus(watchedDate) || {};

  const onSubmit = async (vals) => {
    try {
      const res = await api.post('/leave-requests', vals);
      showToast('Request submitted', 'success');
      reset();
      if (onSubmitted) onSubmitted(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to submit';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-semibold">Submit Leave / Duty Request</h4>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-3">
        <div>
          <label className="text-sm">Request Type</label>
          <div className="flex space-x-3 mt-1">
            <label className="flex items-center"><input type="radio" {...register('requestType')} value="leave" defaultChecked /> <span className="ml-2">Leave</span></label>
            <label className="flex items-center"><input type="radio" {...register('requestType')} value="club_duty" /> <span className="ml-2">Club Duty</span></label>
          </div>
        </div>
        <div>
          <label className="text-sm">Request Date</label>
          <input type="date" {...register('requestDate', { required: true })} className="w-full border rounded p-2 mt-1" />
          <div className="text-xs text-gray-500 mt-1">{deadlineStatusMessage}</div>
        </div>
        <div>
          <label className="text-sm">Reason</label>
          <textarea {...register('reason', { required: true, minLength: 10 })} className="w-full border rounded p-2 mt-1" rows={4} />
        </div>
        <div className="flex space-x-2">
          <Button type="submit" disabled={deadlineStatusStatus === 'passed'}>Submit Request</Button>
          <Button variant="secondary" onClick={() => reset()}>Reset</Button>
        </div>
      </form>
    </div>
  );
}
