// Refactored Facilities.tsx to support booking_type (per_hour / per_day) and price_per_day
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Edit, Trash2, ArrowLeft, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Facility {
  id: string;
  name: string;
  description: string;
  price_per_hour: number;
  price_per_day?: number;
  booking_type?: 'per_hour' | 'per_day';
  price_per_month?: number;
  image_url: string;
  created_at: string;
  pricing_type?: 'per_hour' | 'per_visit';
}

export function Facilities() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_hour: '',
    price_per_day: '',
    booking_type: 'per_hour',
    image_url: ''
  });

  useEffect(() => {
    checkAccess();
    loadFacilities();
  }, [profile]);

  const checkAccess = async () => {
    if (!profile?.role_id) {
      navigate('/dashboard');
      return;
    }
    const { data: roleData } = await supabase.from('roles').select('name').eq('id', profile.role_id).single();
    if (!roleData || !['super_admin', 'admin'].includes(roleData.name)) {
      navigate('/dashboard');
    }
  };

  const loadFacilities = async () => {
    try {
      const { data, error } = await supabase.from('sports_facilities').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      console.error('Error loading facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const facilityData = {
  name: formData.name,
  description: formData.description,
  price_per_hour:
    formData.booking_type === 'per_hour'
      ? parseInt(formData.price_per_hour)
      : 0, // default aman
  price_per_day:
    formData.booking_type === 'per_day'
      ? parseInt(formData.price_per_day)
      : null,
  price_per_month: formData.price_per_month
    ? parseInt(formData.price_per_month)
    : null,
  booking_type: formData.booking_type,
  image_url: formData.image_url
};

      if (editingFacility) {
        const { error } = await supabase.from('sports_facilities').update(facilityData).eq('id', editingFacility.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sports_facilities').insert([facilityData]);
        if (error) throw error;
      }
      loadFacilities();
      setShowModal(false);
      setEditingFacility(null);
      setFormData({ name: '', description: '', price_per_hour: '', price_per_day: '', booking_type: 'per_hour', image_url: '' });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setFormData({
      name: facility.name,
      description: facility.description,
      price_per_hour: facility.price_per_hour.toString(),
      price_per_day: facility.price_per_day?.toString() || '',
      price_per_month: facility.price_per_month?.toString() || '',
      booking_type: facility.booking_type || 'per_hour',
      image_url: facility.image_url
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this facility?')) return;
    try {
      const { error } = await supabase.from('sports_facilities').delete().eq('id', id);
      if (error) throw error;
      loadFacilities();
    } catch (error) {
      console.error('Error deleting facility:', error);
    }
  };

  const formatIDR = (price: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const fileExt = file.name.split('.').pop();
  const filePath = `facility-${Date.now()}.${fileExt}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('facilities')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
  .from('facilities')
  .getPublicUrl(filePath);

setFormData((prev) => ({ ...prev, image_url: data.publicUrl }));

  } catch (error) {
    console.error('Upload error:', error);
    setError('Failed to upload image');
  }
};


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center">
            <button onClick={() => navigate('/settings')} className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200">
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <Building2 className="h-8 w-8 text-indigo-600 mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sports Facilities</h1>
          </div>
          <button onClick={() => { setEditingFacility(null); setFormData({ name: '', description: '', price_per_hour: '', price_per_day: '', booking_type: 'per_hour', image_url: '' }); setShowModal(true); }} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200">
            <Plus className="h-5 w-5 mr-2" /> Add Facility
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((facility) => (
            <div key={facility.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="relative h-48">
                {facility.image_url ? (
                  <img src={facility.image_url} alt={facility.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{facility.name}</h3>
                <p className="text-gray-600 mb-4">{facility.description}</p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-indigo-600">
                    {facility.booking_type === 'per_day'
                      ? `${formatIDR(facility.price_per_day || 0)}/day`
                      : `${formatIDR(facility.price_per_hour)}/hour`}
                  </span>
                </div>
                <div className="flex justify-end space-x-2">
                  <button onClick={() => handleEdit(facility)} className="p-2 text-indigo-600 hover:text-indigo-900" title="Edit">
                    <Edit className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleDelete(facility.id)} className="p-2 text-red-600 hover:text-red-900" title="Delete">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{editingFacility ? 'Edit Facility' : 'Add Facility'}</h2>
              <button onClick={() => { setShowModal(false); setEditingFacility(null); setError(null); }} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Booking Type</label>
                <select value={formData.booking_type} onChange={(e) => setFormData({ ...formData, booking_type: e.target.value as 'per_hour' | 'per_day' })} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  <option value="per_hour">Per Hour</option>
                  <option value="per_day">Per Day</option>
                </select>
              </div>
              {formData.booking_type === 'per_hour' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Hour (IDR)</label>
                  <input type="number" value={formData.price_per_hour} onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required min="0" />
                </div>
              )}
              {formData.booking_type === 'per_day' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Day (IDR)</label>
                  <input type="number" value={formData.price_per_day} onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required min="0" />
                </div>
              )}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Month (IDR)</label>
  <input
    type="number"
    value={formData.price_per_month || ''}
    onChange={(e) =>
      setFormData({ ...formData, price_per_month: e.target.value })
    }
    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
    placeholder="Optional: For GYM or per month pricing"
  />
</div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
/>
                {formData.image_url && (
  <img
    src={formData.image_url}
    alt="Preview"
    className="mt-2 w-full h-40 object-cover rounded"
  />
)}

              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingFacility(null); setError(null); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">{editingFacility ? 'Save Changes' : 'Add Facility'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
