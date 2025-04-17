import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Building2, Calendar, Clock, DollarSign, ArrowLeft, CheckCircle, AlertCircle, X, ArrowRight, User, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { sendBookingConfirmationEmail } from '../lib/email';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

interface LocationState {
  facilityId: string;
  facilityName: string;
  dates?: { startTime: string; endTime: string }[];
  startTime?: string;
  endTime?: string;
  totalPrice: number;
  userId?: string;
  isGuestBooking: boolean;
  guestInfo?: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
  pricingType?: 'per_hour' | 'per_visit';
  bookingType?: 'per_hour' | 'per_day';
  isMember?: boolean;
  membershipDuration?: number;
  duration?: number;
  pricePerMonth?: number;
  gymVisitType?: '1_day' | '1_month';
}

export function PaymentBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

const [processingBooking, setProcessingBooking] = useState(false);
  
  // Get booking data from location state and validate it
  const bookingData = location.state as LocationState;

  // Normalize booking data to always use dates array format
  const normalizedBookingData = {
    ...bookingData,
    dates: bookingData.dates || (bookingData.startTime && bookingData.endTime 
      ? [{ startTime: bookingData.startTime, endTime: bookingData.endTime }] 
      : [])
  };

  useEffect(() => {
    // Validate booking data on component mount
    if (!normalizedBookingData?.facilityId || !normalizedBookingData?.dates || normalizedBookingData.dates.length === 0) {
      console.error('Invalid or missing booking data:', bookingData);
      setError('Invalid booking data. Please try creating your booking again.');
      // Navigate back to create booking after a short delay
      setTimeout(() => {
        navigate('/create-booking');
      }, 3000);
      return;
    }
    
    loadBankAccounts();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('is_receiver', true)
        .order('bank_name');

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Error loading bank accounts:', err);
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedBankId) {
      setError('Please select a payment method');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmPayment = async () => {
  setShowConfirmation(false);
  setProcessingBooking(true);
  setSubmitting(true);
  setError(null);

  try {
    // ✅ Tambahkan ini
    const bookingReference = `MBR-${Date.now()}`;
    console.log("Booking reference:", bookingReference);

    // 💡 Validasi
    if (!normalizedBookingData?.facilityId || !normalizedBookingData?.dates || normalizedBookingData.dates.length === 0) {
      throw new Error('Invalid booking data. Please try creating your booking again.');
    }

    // ✅ Sisipkan ke setiap sesi
    
    const bookingPayload = normalizedBookingData.dates.map(({ startTime, endTime }) => ({
      facility_id: normalizedBookingData.facilityId,
      user_id: normalizedBookingData.userId || null,
      start_time: startTime,
      end_time: endTime,
      total_price: normalizedBookingData.totalPrice / normalizedBookingData.dates.length,
      payment_method_id: selectedBankId,
      customer_name: normalizedBookingData.guestInfo?.customerName || null,
      customer_phone: normalizedBookingData.guestInfo?.customerPhone || null,
      customer_email: normalizedBookingData.guestInfo?.customerEmail || null,
      is_guest_booking: normalizedBookingData.isGuestBooking,
      booking_reference: bookingReference // ✅ disisipkan di sini
    }));
console.log("Payload yang dikirim ke Supabase:", bookingPayload);

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingPayload)
        .select();

      if (error) throw error;

      console.log("Booking insertion successful:", data);
      setSuccess(true);
      
      // Short delay before navigation to show success message
      setTimeout(() => {
        navigate('/dashboard');
        setProcessingBooking(false);

      }, 2000);

    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/create-booking');
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const dateLabel = startDate.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (normalizedBookingData.pricingType === 'per_visit' || normalizedBookingData.bookingType === 'per_day') {
      return `${dateLabel}, ${startTime}`;
    }

    const endDate = new Date(end);
    const endTime = endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return `${dateLabel}, ${startTime} - ${endTime}`;
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

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return "Duration not available";
    }

    // For gym memberships
    if (normalizedBookingData.facilityName.toLowerCase() === 'gym') {
  if (normalizedBookingData.gymVisitType === '1_month') return '1 Month';
  return '1 Day Visit';
}

    // For regular bookings
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Duration in hours

    if (Number.isInteger(duration)) {
      return `${duration} hour${duration > 1 ? 's' : ''}`;
    }

    return `${duration.toFixed(1)} hours`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Early return if booking data is invalid
  if (!normalizedBookingData?.facilityId || !normalizedBookingData?.dates) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Invalid booking data. Redirecting to booking page...
          </div>
        </div>
      </div>
    );
  }

  const selectedBank = bankAccounts.find(bank => bank.id === selectedBankId);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-8">
          <button
            onClick={handleBack}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <CreditCard className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Payment Details</h1>
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
            Payment details submitted successfully! Redirecting to your bookings...
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Facility</p>
                  <p className="font-medium text-gray-900">{normalizedBookingData.facilityName}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  {normalizedBookingData.dates.map((dateObj, index) => (
                    <p key={index} className="font-medium text-gray-900">
                      {formatDateRange(dateObj.startTime, dateObj.endTime)}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  {normalizedBookingData.dates.map((dateObj, index) => (
                    <p key={index} className="font-medium text-gray-900">
                      {calculateDuration(dateObj.startTime, dateObj.endTime)}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <DollarSign className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-indigo-600">{formatIDR(normalizedBookingData.totalPrice)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {normalizedBookingData.guestInfo && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Guest Information</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium">{normalizedBookingData.guestInfo.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="font-medium">{normalizedBookingData.guestInfo.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{normalizedBookingData.guestInfo.customerEmail}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Payment Method
              </label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-gray-500">No payment methods available</p>
              ) : (
                <div className="space-y-4">
                  {bankAccounts.map((bank) => (
                    <label
                      key={bank.id}
                      className={`block relative rounded-lg border p-4 cursor-pointer focus:outline-none ${
                        selectedBankId === bank.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500'
                          : 'border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={bank.id}
                        checked={selectedBankId === bank.id}
                        onChange={(e) => setSelectedBankId(e.target.value)}
                        className="sr-only"
                        required
                      />
                      <div className="flex items-center">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{bank.bank_name}</p>
                          <p className="text-gray-500">{bank.account_number}</p>
                          <p className="text-gray-500">{bank.account_holder}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || bankAccounts.length === 0}
                className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
                  submitting || bankAccounts.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Processing...
                  </span>
                ) : (
                  'Review Payment Details'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

{processingBooking && (
  <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      <p className="text-lg font-semibold text-gray-800">Processing Booking...</p>
    </div>
  </div>
)}

      
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Payment Details</h3>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Booking Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Facility</p>
                    <p className="font-medium">{normalizedBookingData.facilityName}</p>
                  </div>
                  {normalizedBookingData.dates.map(({ startTime, endTime }, index) => (
                    <div key={index}>
                      <p>Date & Time: {formatDateRange(startTime, endTime)}</p>
                      <p>
                        Duration:{' '}
                        {calculateDuration(startTime, endTime)}
                      </p>
                    </div>
                  ))}

                  <div>
                    <p className="text-gray-500">Total Amount</p>
                    <p className="font-medium text-indigo-600">
                      {formatIDR(normalizedBookingData.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              {normalizedBookingData.guestInfo && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-sm">
                        <span className="text-gray-500">Name:</span>{' '}
                        <span className="font-medium">{normalizedBookingData.guestInfo.customerName}</span>
                      </p>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-sm">
                        <span className="text-gray-500">Phone:</span>{' '}
                        <span className="font-medium">{normalizedBookingData.guestInfo.customerPhone}</span>
                      </p>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-sm">
                        <span className="text-gray-500">Email:</span>{' '}
                        <span className="font-medium">{normalizedBookingData.guestInfo.customerEmail}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedBank && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Payment Method</h4>
                  <div className="text-sm">
                    <p className="font-medium">{selectedBank.bank_name}</p>
                    <p className="text-gray-500">{selectedBank.account_number}</p>
                    <p className="text-gray-500">{selectedBank.account_holder}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
  onClick={confirmPayment}
  disabled={submitting}
  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
>
  {submitting ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
      Processing Booking...
    </>
  ) : (
    <>
      Confirm Payment
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  )}
</button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}