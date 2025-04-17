import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  ArrowLeft, 
  Search, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Tag, 
  CreditCard, 
  User,
  Phone,
  Mail,
  Filter,
  CheckCircle,
  XCircle,
  X,
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { generateWeeklyBookingDates } from './generateWeeklyBookingDates';
import { checkSlotsAvailability } from './checkSlotsAvailability';

interface Facility {
  id: string;
  name: string;
  description: string;
  price_per_hour: number;
  image_url: string;
  pricing_type?: 'per_hour' | 'per_visit';
  price_per_day?: number;
  price_per_month?: number;
  booking_type?: 'per_hour' | 'per_day';
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

interface User {
  id: string;
  full_name: string;
  email: string;
  role_name: string;
}

const isPerVisit = (facility: Facility | null): boolean => {
  return facility?.pricing_type === 'per_visit' || facility?.name.toLowerCase() === 'gym';
};

export function CreateBooking() {
  const [membershipDuration, setMembershipDuration] = useState(1); // default 1 bulan
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [availableDurations, setAvailableDurations] = useState<number[]>([]);
  const [bookingType, setBookingType] = useState<'user' | 'guest' | 'member'>('user');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [guestInfo, setGuestInfo] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  });
  const [showUserSearch, setShowUserSearch] = useState(false);

  useEffect(() => {
    checkAccess();
    loadFacilities();
  }, [profile]);

  useEffect(() => {
    if (selectedFacility && isPerVisit(selectedFacility)) {
      if (timeSlots.length > 0 && !selectedTime) {
        setSelectedTime(timeSlots[0].time);
      }
    }
  }, [selectedFacility, timeSlots]);

  useEffect(() => {
    if (selectedFacility && selectedDate) {
      loadOperatingHours();
    }
  }, [selectedFacility, selectedDate]);

  useEffect(() => {
    if (selectedTime) {
      calculateAvailableDurations();
    }
  }, [selectedTime, existingBookings, operatingHours]);

  useEffect(() => {
    if (searchTerm) {
      searchUsers();
    }
  }, [searchTerm, bookingType]);

  const checkAccess = async () => {
    try {
      if (!profile?.role_id) {
        navigate('/dashboard');
        return;
      }

      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (!roleData || !['super_admin', 'admin','staff'].includes(roleData.name)) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/dashboard');
    }
  };

  const loadFacilities = async () => {
    try {
      const { data, error } = await supabase
        .from('sports_facilities')
        .select('*')
        .order('name');

      if (error) throw error;
      setFacilities(data || []);
    } catch (err: any) {
      console.error('Error loading facilities:', err);
      setError('Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  const loadOperatingHours = async () => {
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
          .eq('facility_id', selectedFacility?.id)
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

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateNoTime = new Date(selectedDate);
    selectedDateNoTime.setHours(0, 0, 0, 0);
    const isToday = selectedDateNoTime.getTime() === today.getTime();

    const nowRounded = new Date();
    nowRounded.setMinutes(0, 0, 0);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slotTime = `${hour.toString().padStart(2, '0')}:00`;
      const slotDate = new Date(selectedDate);
      slotDate.setHours(hour, 0, 0, 0);
      
      if (isToday && slotDate < new Date(nowRounded.getTime() + 60 * 60 * 1000)) {
        continue;
      }

      const isGym = selectedFacility?.name.toLowerCase() === 'gym';

      const isAvailable = isGym
        ? true
        : !bookedRanges.some(range => {
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
    if (!selectedTime || !operatingHours) return;

    const isGym = selectedFacility?.name.toLowerCase() === 'gym';
    const isMember = bookingType === 'member';

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

  const searchUsers = async () => {
    if (!searchTerm) {
      setFilteredUsers([]);
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .rpc('list_users');

      if (error) throw error;

      const filtered = (userData || []).filter(user => {
        const matchesSearch = 
          (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        if (bookingType === 'member') {
          return matchesSearch && user.role_name === 'members';
        }
        
        if (bookingType === 'user') {
          return matchesSearch && user.role_name === 'user';
        }

        return matchesSearch;
      });

      setFilteredUsers(filtered);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!selectedFacility || !selectedTime) {
      setError('Please select facility and time.');
      return;
    }

    const startHour = parseInt(selectedTime.split(':')[0], 10);
    const startMinute = parseInt(selectedTime.split(':')[1], 10) || 0;

    let dates: Date[];
    if (bookingType === 'member' && selectedFacility.booking_type === 'per_hour') {
      dates = generateWeeklyBookingDates(selectedDate);
    } else {
      dates = [selectedDate];
    }

    const isGym = selectedFacility?.name.toLowerCase() === 'gym';
const isMonthlyMembership = isGym && bookingType === 'member' && gymVisitType === '1_month';
const isDailyGym = isGym && gymVisitType === '1_day';

    try {
      if (!isGym) {
        const isAvailable = await checkSlotsAvailability(
          selectedFacility.id,
          dates.map(date => {
            const startDateTime = new Date(date);
            startDateTime.setHours(startHour, startMinute, 0, 0);

            const endDateTime = new Date(startDateTime);
            endDateTime.setHours(startDateTime.getHours() + duration);

            return {
              start: startDateTime,
              end: endDateTime
            };
          })
        );

        if (!isAvailable) {
          setError('One or more dates are not available.');
          return;
        }
      }

      const formattedDates = dates.map(date => {
        const startDateTime = new Date(date);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(startDateTime);
        if (isMonthlyMembership) {
          endDateTime.setDate(endDateTime.getDate() + 30); // Add 30 days for monthly membership
        } else {
          endDateTime.setHours(startDateTime.getHours() + duration);
        }

        return {
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        };
      });

      // Calculate total price based on booking type
      let totalPrice = 0;

if (isMonthlyMembership) {
  totalPrice = selectedFacility.price_per_month || 0;
} else if (isDailyGym) {
  totalPrice = selectedFacility.price_per_day || 0;
} else if (bookingType === 'member') {
  totalPrice = selectedFacility.price_per_hour * duration * 4 * membershipDuration;
} else {
  totalPrice = selectedFacility.price_per_hour * duration;
}


      const bookingReference = `MBR-${Date.now()}`;

      navigate('/payment', {
        state: {
          facilityId: selectedFacility.id,
          facilityName: selectedFacility.name,
          dates: formattedDates,
          totalPrice,
          pricePerSession: isMonthlyMembership 
            ? selectedFacility.price_per_month 
            : isGym 
              ? selectedFacility.price_per_day 
              : selectedFacility.price_per_hour * duration,
          userId: bookingType === 'user' || bookingType === 'member' ? selectedUser?.id : null,
          isGuestBooking: bookingType === 'guest',
          guestInfo: bookingType === 'guest' ? guestInfo : undefined,
          isMember: bookingType === 'member',
          membershipDuration: membershipDuration,
          bookingReference,
          gymVisitType,
        }
      });
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message);
    }
  };

  const validateForm = () => {
    if (!selectedFacility) return false;

    const isPerVisitFacility = isPerVisit(selectedFacility);

    if (!isPerVisitFacility && (!selectedTime || !duration)) {
      return false;
    }

    if (isPerVisitFacility && !selectedTime) {
      return false;
    }

    if ((bookingType === 'user' || bookingType === 'member') && !selectedUser) {
      return false;
    }

    if (bookingType === 'guest' && (
      !guestInfo.customerName ||
      !guestInfo.customerEmail ||
      !guestInfo.customerPhone
    )) {
      return false;
    }

    return true;
  };

  const formatTimeRange = (startTime: string, durationHours: number) => {
    const [hour] = startTime.split(':');
    const start = parseInt(hour);
    const end = start + durationHours;
    return `${startTime} - ${end.toString().padStart(2, '0')}:00`;
  };

  const formatIDR = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const [gymVisitType, setGymVisitType] = useState<'1_day' | '1_month'>('1_month');


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
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Create New Booking</h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Booking Type Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Booking Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  setBookingType('user');
                  setSelectedUser(null);
                  setSearchTerm('');
                }}
                className={`p-4 rounded-lg border-2 text-left ${
                  bookingType === 'user'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className={`h-6 w-6 mb-2 ${
                  bookingType === 'user' ? 'text-indigo-500' : 'text-gray-400'
                }`} />
                <div className="font-medium text-gray-900">Regular User</div>
                <div className="text-sm text-gray-500">Book for regular user</div>
              </button>

              <button
                onClick={() => {
                  setBookingType('member');
                  setSelectedUser(null);
                  setSearchTerm('');
                }}
                className={`p-4 rounded-lg border-2 text-left ${
                  bookingType === 'member'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className={`h-6 w-6 mb-2 ${
                  bookingType === 'member' ? 'text-indigo-500' : 'text-gray-400'
                }`} />
                <div className="font-medium text-gray-900">Member</div>
                <div className="text-sm text-gray-500">Book for member user</div>
              </button>

              <button
                onClick={() => {
                  setBookingType('guest');
                  setSelectedUser(null);
                  setSearchTerm('');
                }}
                className={`p-4 rounded-lg border-2 text-left ${
                  bookingType === 'guest'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className={`h-6 w-6 mb-2 ${
                  bookingType === 'guest' ? 'text-indigo-500' : 'text-gray-400'
                }`} />
                <div className="font-medium text-gray-900">Guest</div>
                <div className="text-sm text-gray-500">Book for non-registered user</div>
              </button>
            </div>
          </div>

          {/* User Selection or Guest Info */}
          {(bookingType === 'user' || bookingType === 'member') && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Select {bookingType === 'member' ? 'Member' : 'User'}
              </h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Search ${bookingType === 'member' ? 'members' : 'users'} by name or email...`}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowUserSearch(true);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              {showUserSearch && filteredUsers.length > 0 && (
                <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchTerm(user.full_name);
                        setShowUserSearch(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      {user.role_name === 'members' && (
                        <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                          Member
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{selectedUser.full_name}</div>
                      <div className="text-sm text-gray-500">{selectedUser.email}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchTerm('');
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {bookingType === 'guest' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Guest Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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

          {/* Facility Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select Facility</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {facilities.map((facility) => (
                <button
                  key={facility.id}
                  onClick={() => setSelectedFacility(facility)}
                  className={`p-4 rounded-lg border-2 text-left ${
                    selectedFacility?.id === facility.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Building2 className={`h-6 w-6 mb-2 ${
                    selectedFacility?.id === facility.id ? 'text-indigo-500' : 'text-gray-400'
                  }`} />
                  <div className="font-medium text-gray-900">{facility.name}</div>
                  <div className="text-sm text-gray-500">{formatIDR(facility.price_per_hour)}/hour</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time Selection */}
          {selectedFacility && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select Date & Time</h2>
              
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
                     
                      if (isPerVisit(selectedFacility)) {
                        setSelectedTime('08:00');
                      } else {
                        setSelectedTime('');
                      }
                    }}
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                {bookingType === 'member' && selectedFacility.name.toLowerCase() !== 'gym' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Durasi Membership (bulan)
                    </label>
                    <select
                      value={membershipDuration}
                      onChange={(e) => setMembershipDuration(Number(e.target.value))}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {[1, 2, 3].map((month) => (
                        <option key={month} value={month}>
                          {month} Bulan
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {operatingHours?.is_open ? (
  <>
    {/* TIME SELECT */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
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
        <p className="text-sm text-gray-500">No available time slots</p>
      )}
    </div>

    {/* BOOKING DURATION SELECT UNTUK GYM + MEMBER */}
    {bookingType === 'member' && selectedFacility?.name.toLowerCase() === 'gym' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Booking Duration
        </label>
        <select
          value={gymVisitType}
          onChange={(e) => setGymVisitType(e.target.value as '1_day' | '1_month')}
          className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="1_day">1 Day</option>
          <option value="1_month">1 Month</option>
        </select>
      </div>
    )}

    {/* DURASI JAM (untuk non-GYM) */}
    {selectedTime && !isPerVisit(selectedFacility) && selectedFacility?.name.toLowerCase() !== 'gym' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duration (hours)
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
        >
          {availableDurations.map((dur) => (
            <option key={dur} value={dur}>
              {dur} hour{dur > 1 ? 's' : ''} ({formatTimeRange(selectedTime, dur)})
            </option>
          ))}
        </select>
      </div>
    )}
  </>
) : (
  <p className="text-sm text-red-500">This facility is closed on the selected date</p>
)}

              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!validateForm()}
              className={`px-6 py-2 rounded-lg font-medium ${
                validateForm()
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue to Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}