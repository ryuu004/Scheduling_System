import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Schedule } from './types';
import { CurrentActivity } from './components/CurrentActivity';
import { Timeline } from './components/Timeline';
import { ScheduleForm } from './components/ScheduleForm';
import { DatePicker } from './components/DatePicker';

function App() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('date', selectedDate)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Failed to fetch schedules:', error);
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSave = async (formData: Omit<Schedule, 'id' | 'created_at'>) => {
    if (editingSchedule) {
      const { error } = await supabase
        .from('schedules')
        .update(formData)
        .eq('id', editingSchedule.id);

      if (!error) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === editingSchedule.id ? { ...s, ...formData } : s))
        );
      }
    } else {
      const { data, error } = await supabase
        .from('schedules')
        .insert([formData])
        .select()
        .single();

      if (!error && data) {
        setSchedules((prev) => [...prev, data].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        ));
      }
    }
    setShowForm(false);
    setEditingSchedule(null);
  };

  const handleDelete = async () => {
    if (!editingSchedule) return;
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', editingSchedule.id);

    if (!error) {
      setSchedules((prev) => prev.filter((s) => s.id !== editingSchedule.id));
    }
    setShowForm(false);
    setEditingSchedule(null);
  };

  const handleSelectSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <DatePicker selectedDate={selectedDate} onChange={setSelectedDate} />
          <button
            className="dark-toggle"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        <CurrentActivity schedules={schedules} currentTime={currentTime} />

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <Timeline
            schedules={schedules}
            currentTime={currentTime}
            onSelect={handleSelectSchedule}
          />
        )}
      </main>

      <button
        className="fab"
        onClick={() => {
          setEditingSchedule(null);
          setShowForm(true);
        }}
      >
        + Add Schedule
      </button>

      {showForm && (
        <ScheduleForm
          schedule={editingSchedule}
          selectedDate={selectedDate}
          onSave={handleSave}
          onDelete={editingSchedule ? handleDelete : undefined}
          onClose={() => {
            setShowForm(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
