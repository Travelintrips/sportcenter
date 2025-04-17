import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BookOpen, 
  ArrowLeft, 
  AlertCircle,
  Calendar,
  Clock,
  Tag,
  User,
  Phone,
  Mail,
  X,
  CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Booking {
  id: string;
  user_id: string | null;
  facility_id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  guest_reference: string | null;
  is_guest_booking: boolean;
  facility: {
    name: string;
    booking_type?: 'per_hour' | 'per_day';
    price_per_hour: number;
    price_per_day?: number;
    price_per_month?: number;
  };
  user: {
    full_name: string;
    email: string;
    role: {
      name: string;
    };
  } | null;
  payment_method: {
    bank_name: string;
    account_number: string;
    account_holder: string;
  } | null;
}

interface OperatingHours {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface ExistingBooking {
  start_time: string;
  end_time: string;
}

export function EditBooking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [availableDurations, setAvailableDurations] = useState<number[]>([]);
  const [guestInfo, setGuestInfo] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  });
  const [relatedBookings, setRelatedBookings] = useState<Booking[]>([]);

  useEffect(() => {
  if (profile?.role_id) {
    checkAccess();
    loadBooking();
  }
}, [profile]);


  useEffect(() => {
    if (booking) {
      const bookingDate = new Date(booking.start_time);
      setSelectedDate(bookingDate);
      setSelectedTime(bookingDate.getHours().toString().padStart(2, '0') + ':00');
      
      // Calculate duration based on facility type
      if (booking.facility.name.toLowerCase() === 'gym') {
        const startDate = new Date(booking.start_time);
        const endDate = new Date(booking.end_time);
        const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        setDuration(days >= 28 ? 30 : 1); // 30 for monthly membership, 1 for daily visit
      } else {
        const durationHours = calculateDuration(booking.start_time, booking.end_time);
        setDuration(durationHours);
      }

      if (booking.is_guest_booking) {
        setGuestInfo({
          customerName: booking.customer_name || '',
          customerEmail: booking.customer_email || '',
          customerPhone: booking.customer_phone || ''
        });
      }

      // Load related bookings for the same user and facility
      loadRelatedBookings(booking);
    }
  }, [booking]);

  const loadRelatedBookings = async (currentBooking: Booking) => {
    try {
      const startOfDay = new Date(currentBooking.start_time);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(currentBooking.start_time);
      endOfDay.setDate(endOfDay.getDate() + 30); // Look for bookings up to 30 days ahead
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('facility_id', currentBooking.facility_id)
        .eq('user_id', currentBooking.user_id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('id', currentBooking.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setRelatedBookings(data || []);
    } catch (err) {
      console.error('Error loading related bookings:', err);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      loadOperatingHours();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime) {
      calculateAvailableDurations();
    }
  }, [selectedTime, existingBookings, operatingHours]);

  const checkAccess = async () => {
  try {
    if (!profile?.role_id) {
      console.warn('Role ID belum tersedia');
      console.log('PROFILE ROLE:', profile?.role_id);
      return; // Tunggu sampai profile lengkap
    }

    const { data: roleData } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .single();

    // ✅ Pindahkan log-nya ke sini, setelah roleData tersedia
    console.log('PROFILE ROLE ID:', profile.role_id);
    console.log('ROLE DATA NAME:', roleData?.name);

    if (!roleData || !['super_admin', 'admin', 'staff'].includes(roleData.name)) {
      navigate('/dashboard');
    }
  } catch (error) {
    console.error('Error checking access:', error);
    navigate('/dashboard');
  }
};

  const loadBooking = async () => {
    try {
      const { data, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          facility:sports_facilities (
            id,
            name,
            booking_type,
            price_per_hour,
            price_per_day,
            price_per_month
          ),
          user:profiles (
            full_name,
            email,
            role:roles (
              name
            )
          ),
          payment_method:bank_accounts (
            bank_name,
            account_number,
            account_holder
          )
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;
      if (!data) throw new Error('Booking not found');

      setBooking(data);
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError('Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const loadOperatingHours = async () => {
    if (!booking) return;

    try {
      const dayOfWeek = selectedDate.getDay();
      
      const { data: hoursData, error: hoursError } = await supabase
        .from('operating_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .limit(1);

      if (hoursError) throw hoursError;

      if (hoursData && hoursData.length > 0) {
        setOperatingHours(hoursData[0]);
        
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('start_time, end_time')
          .eq('facility_id', booking.facility_id)
          .neq('id', booking.id)
          .gte('start_time', startOfDay.toISOString())
          .lte('end_time', endOfDay.toISOString())
          .neq('status', 'cancelled');

        if (bookingsError) throw bookingsError;

        setExistingBookings(bookingsData || []);
        generateTimeSlots(hoursData[0], bookingsData || []);
      } else {
        setOperatingHours(null);
        setTimeSlots([]);
        setError('No operating hours found for this day');
      }
    } catch (err: any) {
      console.error('Error loading operating hours:', err);
      setError('Failed to load operating hours');
    }
  };

  const generateTimeSlots = (hours: OperatingHours, bookings: ExistingBooking[]) => {
    if (!hours.is_open) {
      setTimeSlots([]);
      setSelectedTime('');
      return;
    }

    const slots: TimeSlot[] = [];
    const [openHour] = hours.open_time.split(':');
    const [closeHour] = hours.close_time.split(':');
    const startHour = parseInt(openHour);
    const endHour = parseInt(closeHour);

    const bookedRanges = bookings.map(booking => ({
      start: new Date(booking.start_time),
      end: new Date(booking.end_time)
    }));

    for (let hour = startHour; hour < endHour; hour++) {
      const slotTime = `${hour.toString().padStart(2, '0')}:00`;
      const slotDate = new Date(selectedDate);
      slotDate.setHours(hour, 0, 0, 0);

      const isGym = booking?.facility.name.toLowerCase() === 'gym';
      const isAvailable = isGym || !bookedRanges.some(range => {
        return slotDate >= range.start && slotDate < range.end;
      });

      slots.push({
        time: slotTime,
        available: isAvailable
      });
    }

    setTimeSlots(slots);

    if (selectedTime) {
      const isCurrentTimeAvailable = slots.find(
        slot => slot.time === selectedTime && slot.available
      );
      if (!isCurrentTimeAvailable) {
        setSelectedTime('');
      }
    }
  };

  const calculateAvailableDurations = () => {
    if (!selectedTime || !operatingHours || !booking) return;

    const isGym = booking.facility.name.toLowerCase() === 'gym';
    const isMember = booking.user?.role?.name === 'members';

    if (isGym) {
      if (isMember) {
        setAvailableDurations([30]); // 30 days for monthly membership
      } else {
        setAvailableDurations([1]); // 1 day for regular visit
      }
      return;
    }

    const [selectedHour] = selectedTime.split(':');
    const startHour = parseInt(selectedHour);
    const [closeHour] = operatingHours.close_time.split(':');
    const endHour = parseInt(closeHour);

    const maxPossibleDuration = endHour - startHour;

    const selectedDateTime = new Date(selectedDate);
    selectedDateTime.setHours(startHour, 0, 0, 0);

    const availableDurs: number[] = [];
    for (let dur = 1; dur <= Math.min(5, maxPossibleDuration); dur++) {
      const endDateTime = new Date(selectedDateTime);
      endDateTime.setHours(endDateTime.getHours() + dur);

      const hasOverlap = existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return (
          (selectedDateTime < bookingEnd && endDateTime > bookingStart) ||
          endDateTime > new Date(selectedDate.setHours(parseInt(closeHour), 0, 0, 0))
        );
      });

      if (!hasOverlap) {
        availableDurs.push(dur);
      }
    }

    setAvailableDurations(availableDurs);
    
    if (!availableDurs.includes(duration)) {
      setDuration(availableDurs[0] || 1);
    }
  };

  const handleSubmit = async () => {
    if (!booking || !selectedTime || !operatingHours) return;

    try {
      const startDateTime = new Date(selectedDate);
      const [hours] = selectedTime.split(':');
      startDateTime.setHours(parseInt(hours), 0, 0, 0);

      const endDateTime = new Date(startDateTime);
      const isGym = booking.facility.name.toLowerCase() === 'gym';
      const isMember = booking.user?.role?.name === 'members';

      if (isGym && isMember) {
        endDateTime.setDate(endDateTime.getDate() + 30); // Add 30 days for monthly membership
      } else if (isGym) {
        endDateTime.setHours(23, 59, 59, 999); // End of day for regular gym visit
      } else {
        endDateTime.setHours(endDateTime.getHours() + duration);
      }

      // Calculate total price based on booking type
      let totalPrice = 0;
      if (isGym) {
        if (isMember) {
          totalPrice = booking.facility.price_per_month || 0;
        } else {
          totalPrice = booking.facility.price_per_day || 0;
        }
      } else {
        totalPrice = booking.facility.price_per_hour * duration;
      }

      const updateData = {
        facility_id: booking.facility_id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        total_price: totalPrice
      };

      if (booking.is_guest_booking) {
        Object.assign(updateData, {
          customer_name: guestInfo.customerName,
          customer_email: guestInfo.customerEmail,
          customer_phone: guestInfo.customerPhone
        });
      }

      // Update the current booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (updateError) throw updateError;

      // Update related bookings if they exist
      if (relatedBookings.length > 0) {
        const updates = relatedBookings.map(relatedBooking => {
          const relatedStartTime = new Date(relatedBooking.start_time);
          const relatedEndTime = new Date(relatedStartTime);
          
          if (isGym && isMember) {
            relatedEndTime.setDate(relatedEndTime.getDate() + 30);
          } else {
            relatedEndTime.setHours(relatedStartTime.getHours() + duration);
          }

          return {
            id: relatedBooking.id,
            facility_id: booking.facility_id,
            start_time: relatedStartTime.toISOString(),
            end_time: relatedEndTime.toISOString(),
            total_price: totalPrice
          };
        });

        const { error: batchUpdateError } = await supabase
          .from('bookings')
          .upsert(updates);

        if (batchUpdateError) throw batchUpdateError;
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error updating booking:', err);
      setError(err.message);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    
    // For gym bookings
    if (booking?.facility.name.toLowerCase() === 'gym') {
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 28 ? '1 Month' : '1 Day Visit';
    }
    
    // For regular bookings
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  };

  const formatTimeRange = (startTime: string, durationHours: number) => {
    if (booking?.facility.name.toLowerCase() === 'gym') {
      return durationHours === 30 ? '1 Month Membership' : '1 Day Visit';
    }

    const [hour] = startTime.split(':');
    const start = parseInt(hour);
    const end = start + durationHours;
    return `${startTime} - ${end.toString().padStart(2, '0')}:00`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Not Found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Edit Booking</h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Facility Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Facility Name</label>
                <p className="mt-1 text-sm text-gray-900">{booking.facility.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <p className="mt-1 text-sm text-gray-900">
                  {booking.facility.name.toLowerCase() === 'gym'
                    ? booking.user?.role?.name === 'members'
                      ? `${formatIDR(booking.facility.price_per_month || 0)}/month`
                      : `${formatIDR(booking.facility.price_per_day || 0)}/day`
                    : `${formatIDR(booking.facility.price_per_hour)}/hour`}
                </p>
              </div>
            </div>
          </div>

          {/* Date and Time Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Schedule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setSelectedDate(newDate);
                    setSelectedTime('');
                  }}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              {operatingHours?.is_open ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    {timeSlots.length > 0 ? (
                      <select
                        value={selectedTime}
                        onChange={(e) => {
                          setSelectedTime(e.target.value);
                          setDuration(1);
                        }}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="">Select a time</option>
                        {timeSlots
                          .filter(slot => slot.available)
                          .map((slot) => (
                            <option key={slot.time} value={slot.time}>
                              {slot.time}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-500">No available time slots for this date</p>
                    )}
                  </div>

                  {selectedTime && availableDurations.length > 0 && !booking.facility.name.toLowerCase().includes('gym') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duration
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        {availableDurations.map((hours) => (
                          <option key={hours} value={hours}>
                            {formatTimeRange(selectedTime, hours)} ({hours} hour{hours > 1 ? 's' : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700">
                    The facility is closed on this day. Please select a different date.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Guest Information */}
          {booking.is_guest_booking && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Guest Information</h2>
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
            </div>
          )}

          {/* Price Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Price Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>
                  {booking.facility.name.toLowerCase() === 'gym'
                    ? booking.user?.role?.name === 'members'
                      ? 'Price per month'
                      : 'Price per day'
                    : 'Price per hour'}
                </span>
                <span>
                  {booking.facility.name.toLowerCase() === 'gym'
                    ? booking.user?.role?.name === 'members'
                      ? formatIDR(booking.facility.price_per_month || 0)
                      : formatIDR(booking.facility.price_per_day || 0)
                    : formatIDR(booking.facility.price_per_hour)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Duration</span>
                <span>
                  {booking.facility.name.toLowerCase() === 'gym'
                    ? booking.user?.role?.name === 'members'
                      ? '1 Month'
                      : '1 Day'
                    : `${duration} hour${duration > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Total Price</span>
                  <span>
                    {booking.facility.name.toLowerCase() === 'gym'
                      ? booking.user?.role?.name === 'members'
                        ? formatIDR(booking.facility.price_per_month || 0)
                        : formatIDR(booking.facility.price_per_day || 0)
                      : formatIDR(booking.facility.price_per_hour * duration)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedTime || !operatingHours?.is_open || (!booking.facility.name.toLowerCase().includes('gym') && availableDurations.length === 0)}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
              !selectedTime || !operatingHours?.is_open || (!booking.facility.name.toLowerCase().includes('gym') && availableDurations.length === 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}