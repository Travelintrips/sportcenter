import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Facility {
  id: string;
  name: string;
  description: string;
  price_per_day: number;
  price_per_month?: number;
  image_url: string;
}

interface BookingModalPerDayProps {
  facility: Facility;
  onClose: () => void;
  onBook: (startTime: string, duration: number, guestInfo?: GuestInfo) => Promise<void>;
}

interface GuestInfo {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export default function BookingModalPerDay({ facility, onClose, onBook }: BookingModalPerDayProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  });
  const [isGuestBooking, setIsGuestBooking] = useState(false);
  const { user } = useAuthStore();

  const validateGuestInfo = () => {
    if (!guestInfo.customerName.trim()) throw new Error('Please enter your full name');
    if (!guestInfo.customerEmail.trim()) throw new Error('Please enter your email');
    if (!guestInfo.customerPhone.trim()) throw new Error('Please enter your phone number');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestInfo.customerEmail)) throw new Error('Invalid email format');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const bookingStart = new Date(selectedDate);
      bookingStart.setHours(8, 0, 0, 0); // Default to 8 AM start time

      if (!user && !isGuestBooking) {
        setIsGuestBooking(true);
        return;
      }

      if (isGuestBooking) {
        validateGuestInfo();
      }

      await onBook(bookingStart.toISOString(), 1, isGuestBooking ? guestInfo : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{facility.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {!user && isGuestBooking && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={guestInfo.customerName}
                  onChange={(e) => setGuestInfo({ ...guestInfo, customerName: e.target.value })}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={guestInfo.customerEmail}
                  onChange={(e) => setGuestInfo({ ...guestInfo, customerEmail: e.target.value })}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={guestInfo.customerPhone}
                  onChange={(e) => setGuestInfo({ ...guestInfo, customerPhone: e.target.value })}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Price per day</span>
              <span>{formatIDR(facility.price_per_day)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatIDR(facility.price_per_day)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Processing...' : (!user && !isGuestBooking ? 'Continue as Guest' : 'Continue to Payment')}
          </button>
        </div>
      </div>
    </div>
  );
}