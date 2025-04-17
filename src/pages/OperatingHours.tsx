import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface OperatingHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export function OperatingHours() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [hours, setHours] = useState<OperatingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkSuperAdminAccess();
    loadOperatingHours();
  }, [profile]);

  const checkSuperAdminAccess = async () => {
    if (!profile?.role_id) {
      navigate('/dashboard');
      return;
    }

    const { data: roleData } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .single();

    if (roleData?.name !== 'super_admin') {
      navigate('/dashboard');
    }
  };

  const loadOperatingHours = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('operating_hours')
        .select('*')
        .order('day_of_week');

      if (fetchError) throw fetchError;

      // Ensure we have entries for all days
      const fullHours = DAYS_OF_WEEK.map((_, index) => {
        const existingHour = data?.find(h => h.day_of_week === index);
        if (existingHour) {
          return existingHour;
        }
        return {
          id: `temp-${index}`,
          day_of_week: index,
          open_time: '08:00',
          close_time: '20:00',
          is_open: true
        };
      });

      setHours(fullHours);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateHours = (hours: OperatingHour[]) => {
    for (const hour of hours) {
      if (hour.is_open) {
        const openTime = new Date(`2000-01-01T${hour.open_time}`);
        const closeTime = new Date(`2000-01-01T${hour.close_time}`);
        
        if (closeTime <= openTime) {
          throw new Error(`Invalid hours for ${DAYS_OF_WEEK[hour.day_of_week]}: Closing time must be after opening time`);
        }
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate hours before saving
      validateHours(hours);

      // Prepare the data for upsert
      const upsertData = hours.map(hour => ({
        day_of_week: hour.day_of_week,
        open_time: hour.open_time,
        close_time: hour.close_time,
        is_open: hour.is_open
      }));

      // Delete existing records first
      const { error: deleteError } = await supabase
        .from('operating_hours')
        .delete()
        .not('id', 'is', null); // Delete all records

      if (deleteError) throw deleteError;

      // Insert new records
      const { error: insertError } = await supabase
        .from('operating_hours')
        .insert(upsertData);

      if (insertError) throw insertError;

      setSuccess(true);
      await loadOperatingHours(); // Reload to get new IDs
    } catch (error: any) {
      console.error('Error saving operating hours:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateHours = (index: number, updates: Partial<OperatingHour>) => {
    setHours(current => 
      current.map((hour, i) => 
        i === index ? { ...hour, ...updates } : hour
      )
    );
    setSuccess(false); // Reset success state when changes are made
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/settings')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <Clock className="h-8 w-8 text-indigo-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Operating Hours</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            } transition-colors duration-200`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Operating hours have been updated successfully
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {hours.map((hour, index) => (
                <div key={hour.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-32">
                    <span className="font-medium text-gray-900">{DAYS_OF_WEEK[hour.day_of_week]}</span>
                  </div>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={hour.is_open}
                      onChange={(e) => updateHours(index, { is_open: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600">Open</span>
                  </label>

                  <div className="flex items-center space-x-2 flex-1">
                    <input
                      type="time"
                      value={hour.open_time}
                      onChange={(e) => updateHours(index, { open_time: e.target.value })}
                      disabled={!hour.is_open}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={hour.close_time}
                      onChange={(e) => updateHours(index, { close_time: e.target.value })}
                      disabled={!hour.is_open}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}