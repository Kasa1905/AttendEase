import React from 'react';
import useApi from '../hooks/useApi';

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function typeBadgeClass(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'meeting') return 'badge-meeting';
  if (t === 'workshop') return 'badge-workshop';
  return 'badge-event';
}

export default function EventList({ showActions = false }) {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [events, setEvents] = React.useState([]);
  const [layout, setLayout] = React.useState('grid');

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get('events');
      setEvents(res?.data?.events || []);
    } catch (e) {
      setError('Error loading events');
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div>
        <div data-testid="loading-spinner" />
        <div>Loading events</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div>Error loading events</div>
        <button onClick={load}>Retry</button>
      </div>
    );
  }

  if (!events.length) {
    return <div>No events found</div>;
  }

  return (
    <div>
      <div className="layout-toggle">
        <button onClick={() => setLayout('grid')}>Grid</button>
        <button onClick={() => setLayout('list')}>List</button>
      </div>
      <div
        data-testid="event-list"
        className={layout === 'grid' ? 'grid-layout' : 'list-layout'}
      >
        {events.map(ev => (
          <div key={ev.id} data-testid={`event-${ev.id}`}>
            <div>{ev.name}</div>
            {ev.description && <div>{ev.description}</div>}
            {ev.location && <div>{ev.location}</div>}
            {ev.time && <div>{ev.time}</div>}
            {ev.type && <span className={typeBadgeClass(ev.type)}>{ev.type}</span>}
            {ev.date && <div>{formatDate(ev.date)}</div>}
            {showActions && <div><button>View</button></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
