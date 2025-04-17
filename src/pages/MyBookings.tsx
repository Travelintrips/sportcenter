// MyBookings.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  AlertCircle,
  CalendarDays,
  Clock,
  Tag,
  CreditCard,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Booking {
  id: string;
  booking_reference?: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  payment_method: {
    bank_name: string;
    account_number: string;
    account_holder: string;
  } | null;
  facility: {
    name: string;
    booking_type?: 'per_hour' | 'per_day';
  };
}

export function MyBookings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!user) navigate('/login');
    else loadBookings();
  }, [user]);

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          facility_id,
          start_time,
          end_time,
          status,
          total_price,
          customer_name,
          customer_phone,
          customer_email,
          payment_method:bank_accounts!bookings_payment_method_id_fkey (
            bank_name,
            account_number,
            account_holder
          ),
          facility:sports_facilities!bookings_facility_id_fkey (
            name,
            booking_type
          )
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (err: any) {
      console.error('Error loading bookings:', err);
      console.log("Loaded bookings:", data);
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const groupByReference = (bookings: Booking[]) => {
  const groups: Record<string, Booking[]> = {};

  bookings.forEach((booking) => {
    const key = booking.booking_reference
      ? booking.booking_reference.trim().toLowerCase()
      : booking.id;

    if (!groups[key]) groups[key] = [];
    groups[key].push(booking);
  });

  // pastikan setiap grup diurutkan berdasarkan start_time
  Object.values(groups).forEach(group => {
    group.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  });
console.log("Grouped keys:", Object.keys(groups));

  return groups;
};

const grouped = groupByReference(bookings);

  const calculateDuration = (start: string, end: string, facility: Booking['facility']) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (facility.name.toLowerCase() === 'gym' || facility.booking_type === 'per_day') {
      const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 28 && days <= 31) return '1 Month';
      return '1 Day Visit';
    }

    const hours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const getStatusColor = (status: string) => ({
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800'
  }[status] || 'bg-gray-100 text-gray-800');

  const formatDateTime = (date: string) => new Date(date).toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const formatIDR = (price: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(price);



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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <BookOpen className="h-6 w-6 mr-2 text-indigo-600" /> My Bookings
          </h1>
          <button
            onClick={() => navigate('/')}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" /> {error}
          </div>
        )}

        {Object.entries(grouped).map(([groupKey, bookings]) => {
  const isGroup = bookings.length > 1 && bookings[0].booking_reference !== null;

  const firstBooking = bookings[0];

  const groupDate = new Date(firstBooking.start_time).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  const title = isGroup
    ? `${firstBooking.facility.name} Group Booking (${bookings.length} sessions) - ${groupDate}`
    : `${firstBooking.facility.name} - ${groupDate}`;


  return (
    <div key={groupKey} className="mb-4 border rounded-lg bg-white">
      <button
        onClick={() => setExpandedGroup(expandedGroup === groupKey ? null : groupKey)}
        className="w-full px-4 py-3 flex justify-between items-center text-left font-semibold text-gray-800 hover:bg-gray-50"
      >
        <span>{title}</span>
        {expandedGroup === groupKey ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {expandedGroup === groupKey && (
        <div className="p-4 space-y-4 border-t">
          {bookings.map(booking => (
            <div key={booking.id} className="border rounded-md p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-lg text-gray-900">{booking.facility.name}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>{booking.status}</span>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {formatDateTime(booking.start_time)} → {formatDateTime(booking.end_time)}
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  {calculateDuration(booking.start_time, booking.end_time, booking.facility)}
                </div>
                <div className="flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  {formatIDR(booking.total_price)}
                </div>
              </div>

              {booking.payment_method && (
                <div className="bg-gray-50 rounded-md p-3 mt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" /> Payment Method
                  </h4>
                  <p className="text-sm text-gray-700">
                    Bank: <span className="font-medium">{booking.payment_method.bank_name}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    Account Holder: <span className="font-medium">{booking.payment_method.account_holder}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    Account Number: <span className="font-medium">{booking.payment_method.account_number}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
})}

      </div>
    </div>
  );
}
