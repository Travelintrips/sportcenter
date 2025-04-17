import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft, Search, AlertCircle, Calendar, Clock, Tag, CreditCard, User, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GuestBooking {
  id: string;
  facility: {
    name: string;
    booking_type?: 'per_hour' | 'per_day';
  };
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: {
    bank_name: string;
    account_number: string;
    account_holder: string;
  } | null;
  guest_reference: string;
}

export function GuestBooking() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reference, setReference] = useState(location.state?.reference || '');
  const [email, setEmail] = useState(location.state?.email || '');
  const [booking, setBooking] = useState<GuestBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.reference && location.state?.email) {
      loadBooking();
    }
  }, [location.state]);

  const loadBooking = async () => {
    if (!reference || !email) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: bookingError } = await supabase
        .from('bookings')
        .select(`
  id,
  facility:sports_facilities (
    name,
    booking_type
  ),
  start_time,
  end_time,
  status,
  total_price,
  customer_name,
  customer_email,
  customer_phone,
  payment_method:bank_accounts (
    bank_name,
    account_number,
    account_holder
  ),
  guest_reference
`)
        .eq('guest_reference', reference)
        .eq('customer_email', email)
        .eq('is_guest_booking', true)
        .single();

      if (bookingError) throw bookingError;
      if (!data) throw new Error('Booking not found');

      setBooking(data);
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError('Booking not found. Please check your reference number and email.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateLabel = (dateString: string, bookingType?: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (bookingType === 'per_day') {
      return `${datePart} (1 Day)`;
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatIDR = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
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
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Guest Booking</h1>
        </div>

        {!booking && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Find your booking
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking Reference
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="Enter your booking reference"
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={loadBooking}
                disabled={!reference || !email || loading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Loading...
                  </span>
                ) : (
                  'Find Booking'
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {booking && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {booking.facility.name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400 mt-1" />
                      <div>
                        {booking.facility.booking_type === 'per_day' ? (
                          <p className="font-medium">{formatDateLabel(booking.start_time, 'per_day')}</p>
                        ) : (
                          <>
                            <p className="font-medium">{formatDateTime(booking.start_time)}</p>
                            <p className="font-medium">{formatDateTime(booking.end_time)}</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Clock className="h-5 w-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-medium">
                          {booking.facility.booking_type === 'per_day'
                            ? '1 Day Visit'
                            : `${calculateDuration(booking.start_time, booking.end_time)} hours`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Tag className="h-5 w-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-500">Total Price</p>
                        <p className="font-medium text-indigo-600">
                          {formatIDR(booking.total_price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {booking.payment_method && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                          <CreditCard className="h-5 w-5 mr-2" />
                          Payment Method
                        </h4>
                        <div className="space-y-2">
                          <p className="text-sm">
                            <span className="text-gray-500">Bank:</span>{' '}
                            <span className="font-medium">{booking.payment_method.bank_name}</span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-500">Account:</span>{' '}
                            <span className="font-medium">{booking.payment_method.account_number}</span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-500">Account Holder:</span>{' '}
                            <span className="font-medium">{booking.payment_method.account_holder}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Customer Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <p className="text-sm">
                            <span className="text-gray-500">Name:</span>{' '}
                            <span className="font-medium">{booking.customer_name}</span>
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <p className="text-sm">
                            <span className="text-gray-500">Phone:</span>{' '}
                            <span className="font-medium">{booking.customer_phone}</span>
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 text-gray-400 mr-2" />
                          <p className="text-sm">
                            <span className="text-gray-500">Email:</span>{' '}
                            <span className="font-medium">{booking.customer_email}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2" />
                        Booking Reference
                      </h4>
                      <p className="text-lg font-mono font-medium">{booking.guest_reference}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Keep this reference number for future access to your booking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}