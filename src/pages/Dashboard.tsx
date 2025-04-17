import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';

import {
  LayoutDashboard,
  Building2,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  Tag,
  CreditCard,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  FileText,
  ChevronDown,
  CalendarRange,
  BookOpen,
  Plus,
  Trash2,
  AlertCircle,
  Edit
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface DateFilter {
  type: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
}

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
  is_main_booking?: boolean;
  related_bookings?: Booking[];
  expanded?: boolean;
  duration_type?: 'daily' | 'monthly';
  facility: {
    name: string;
    booking_type?: 'per_hour' | 'per_day';
    price_per_hour?: number;
    price_per_day?: number;
    price_per_month?: number;
  };
  user?: {
    full_name: string;
    email: string;
    role?: {
      name: string;
    };
  };
  payment_method?: {
    bank_name: string;
    account_number: string;
    account_holder: string;
  };
}

interface Facility {
  id: string;
  name: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    facility: 'all',
    status: 'all',
    date: 'all'
  });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: 'all',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [error, setError] = useState<string | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAccess();
    loadBookings();
    loadFacilities();

    window.addEventListener('bookingStatusChanged', handleBookingStatusChange);
    return () => {
      window.removeEventListener('bookingStatusChanged', handleBookingStatusChange);
    };
  }, [profile]);

  const checkAccess = async () => {
  if (!profile?.role_id) {
    navigate('/dashboard');
    return;
  }

  const { data: roleData } = await supabase
    .from('roles')
    .select('name')
    .eq('id', profile.role_id)
    .single();

  if (!roleData || !['super_admin', 'admin', 'staff'].includes(roleData.name)) {
    navigate('/dashboard');
  }
};


  const handleBookingStatusChange = (event: any) => {
    const { booking_id, status } = event.detail;
    setBookings(prevBookings => 
      prevBookings.map(booking => 
        booking.id === booking_id ? { ...booking, status } : booking
      )
    );
  };

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
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
            phone_number,
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process bookings
      const processedBookings = data?.map(booking => {
        const isGymBooking = booking.facility.name.toLowerCase() === 'gym';
        const isMember = booking.user?.role?.name === 'members';

        // For gym bookings
        if (isGymBooking) {
          const endDate = new Date(booking.end_time);
          const startDate = new Date(booking.start_time);
          const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            ...booking,
            is_main_booking: true, // Always show gym bookings
            duration_type: daysDiff >= 28 ? 'monthly' : 'daily'
          };
        }

        // For regular member bookings
        if (isMember && !isGymBooking) {
          // Find related bookings with same time pattern
          const relatedBookings = data.filter(b => 
            b.id !== booking.id &&
            b.user_id === booking.user_id &&
            b.facility_id === booking.facility_id &&
            new Date(b.start_time).getHours() === new Date(booking.start_time).getHours() &&
            new Date(b.start_time).getMinutes() === new Date(booking.start_time).getMinutes()
          );

          if (relatedBookings.length > 0) {
            // Mark this as main booking if it's the earliest
            const isMainBooking = !data.some(b => 
              b.user_id === booking.user_id &&
              b.facility_id === booking.facility_id &&
              new Date(b.start_time) < new Date(booking.start_time) &&
              new Date(b.start_time).getHours() === new Date(booking.start_time).getHours() &&
              new Date(b.start_time).getMinutes() === new Date(booking.start_time).getMinutes()
            );

            return {
              ...booking,
              is_main_booking: isMainBooking,
              related_bookings: isMainBooking ? relatedBookings : undefined
            };
          }
        }

        return {
          ...booking,
          is_main_booking: true // Show non-member bookings
        };
      });

      setBookings(processedBookings || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const loadFacilities = async () => {
    try {
      const { data, error } = await supabase
        .from('sports_facilities')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setFacilities(data || []);
    } catch (err) {
      console.error('Error loading facilities:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const { error } = await supabase
        .rpc('update_booking_group_status', {
          booking_id: bookingId,
          new_status: status
        });

      if (error) throw error;

      loadBookings();
    } catch (err: any) {
      console.error('Error updating booking status:', err);
      setError(err.message);
    }
  };

  const deleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadBookings();
    } catch (err) {
      console.error('Error deleting booking:', err);
      setError('Failed to delete booking');
    }
  };
  
  const exportToExcel = (data: Booking[], fileName = 'bookings.xlsx') => {
  const exportData: any[] = [];

  data.forEach(booking => {
    // Booking utama
    exportData.push({
      'Booking ID': booking.id,
      'Facility': booking.facility.name,
      'Customer': booking.is_guest_booking ? booking.customer_name : booking.user?.full_name,
      'Email': booking.is_guest_booking ? booking.customer_email : booking.user?.email,
      'Phone': booking.is_guest_booking 
        ? booking.customer_phone || 'N/A' 
        : booking.user?.phone_number || 'N/A',
      'Start Time': formatCustomDate(booking.start_time),
      'End Time': formatCustomDate(booking.end_time),
      'Duration': calculateDuration(booking.start_time, booking.end_time, booking.facility),
      'Total Price': formatIDR(booking.total_price),
      'Status': booking.status.charAt(0).toUpperCase() + booking.status.slice(1),
      'Type': booking.is_guest_booking 
        ? 'Guest'
        : (booking.user?.role?.name === 'members' ? 'Member' : 'Regular'),
      'Reference': booking.guest_reference || booking.id.slice(0, 8).toUpperCase()
    });

    // Related sessions jika ada
    if (booking.related_bookings && booking.related_bookings.length > 0) {
      booking.related_bookings.forEach((session, index) => {
        exportData.push({
          'Booking ID': `${booking.id} - Session ${index + 1}`,
          'Facility': session.facility.name,
          'Customer': booking.user?.full_name,
          'Email': booking.user?.email,
          'Phone': booking.user?.phone_number || 'N/A',
          'Start Time': formatCustomDate(session.start_time),
          'End Time': formatCustomDate(session.end_time),
          'Duration': calculateDuration(session.start_time, session.end_time, session.facility),
          'Total Price': formatIDR(session.total_price),
          'Status': session.status.charAt(0).toUpperCase() + session.status.slice(1),
          'Type': 'Member Session',
          'Reference': booking.guest_reference || booking.id.slice(0, 8).toUpperCase()
        });
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  XLSX.writeFile(wb, fileName);
};



  const handleExportFiltered = () => {
  exportToExcel(filteredBookings, 'filtered_bookings.xlsx');
};

const handleExportAll = () => {
  exportToExcel(bookings, 'all_bookings.xlsx');
};

  const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const formattedDate = date.toLocaleDateString('en-US', options);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formattedDate} at ${hours}:${minutes}`;
};


  const calculateDuration = (startTime: string, endTime: string, facility: Booking['facility']) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // For gym bookings
    if (facility.name.toLowerCase() === 'gym') {
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 28 ? '1 Month' : '1 Day';
    }
    
    // For regular bookings
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const formatIDR = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatCustomDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
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

  const printInvoice = async (booking: Booking) => {
    try {
      const [{ data: logoData }, { data: settingsData }] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'invoice_logo').single(),
        supabase.from('settings').select('value').eq('key', 'invoice_logo_settings').single()
      ]);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Add logo
      if (logoData?.value) {
        const img = new Image();
        img.src = logoData.value;

        const logoSettings = settingsData?.value
          ? JSON.parse(settingsData.value)
          : { x: 20, y: 10, width: 40, height: 20 };

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        doc.addImage(img, 'PNG', logoSettings.x, logoSettings.y, logoSettings.width, logoSettings.height);
      }

      // Title
      doc.setFontSize(16);
      doc.text('INVOICE', pageWidth / 2, 32, { align: 'center' });

      // Booking Ref
      const bookingRef = booking.is_guest_booking
        ? booking.guest_reference
        : booking.user?.role?.name === 'members'
          ? `M-${booking.id.slice(0, 8).toUpperCase()}`
          : `R-${booking.id.slice(0, 8).toUpperCase()}`;

      // Company & Invoice Details
      doc.setFontSize(10);
      const leftX = 20;
      const rightX = 130;
      const topY = 40;
      let line = 0;

      // Left: Invoice Details
      doc.text('Invoice Details:', leftX, topY + (line * 5));
      doc.text(`Date: ${new Date().toLocaleDateString()}`, leftX, topY + (++line * 5));
      doc.text(`Invoice #: ${booking.id.slice(0, 8).toUpperCase()}`, leftX, topY + (++line * 5));
      doc.text(`Booking Ref: ${bookingRef}`, leftX, topY + (++line * 5));

      // Right: Company Info
      line = 0;
      doc.text('Company Information:', rightX, topY + (line * 5));
      doc.text('Sports Center', rightX, topY + (++line * 5));
      doc.text('123 Sports Street', rightX, topY + (++line * 5));
      doc.text('Phone: (123) 456-7890', rightX, topY + (++line * 5));
      doc.text('Email: info@sportscenter.com', rightX, topY + (++line * 5));

      // Continue with dynamic Y
      let currentY = topY + 5 * 5 + 10;

      // Customer Info
      doc.setFont(undefined, 'bold');
      doc.text('Customer Information:', leftX, currentY);
      doc.setFont(undefined, 'normal');
      currentY += 5;
      doc.text(`Name: ${booking.is_guest_booking ? booking.customer_name : booking.user?.full_name}`, leftX, currentY);
      currentY += 5;
      doc.text(`Email: ${booking.is_guest_booking ? booking.customer_email : booking.user?.email}`, leftX, currentY);
      currentY += 5;
      if (booking.is_guest_booking && booking.customer_phone) {
        doc.text(`Phone: ${booking.customer_phone}`, leftX, currentY);
        currentY += 5;
      }

      // Facility Info
      currentY += 5;
      doc.setFont(undefined, 'bold');
      doc.text('Facility Information:', leftX, currentY);
      doc.setFont(undefined, 'normal');
      currentY += 5;
      doc.text(`Facility: ${booking.facility.name}`, leftX, currentY);
      currentY += 5;
      doc.text(`Type: ${booking.facility.booking_type === 'per_day' ? 'Daily Booking' : 'Hourly Booking'}`, leftX, currentY);

      currentY += 10;

      // Related bookings
      const relatedBookings = bookings.filter(b =>
        b.user_id === booking.user_id &&
        b.facility_id === booking.facility_id &&
        new Date(b.start_time).getHours() === new Date(booking.start_time).getHours()
      ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const isMember = booking.user?.role?.name === 'members';
      const sessionPrice = booking.total_price;
      const totalPrice = isMember ? sessionPrice * 4 : sessionPrice;

      const tableHead = [['Session', 'Date & Time', 'Duration', 'Amount']];
      const tableBody = [];

      if (isMember && relatedBookings.length > 0) {
        relatedBookings.forEach((session, index) => {
          tableBody.push([
            `Session ${index + 1}`,
            formatDateTime(session.start_time),
            calculateDuration(session.start_time, session.end_time, session.facility),
            formatIDR(sessionPrice)
          ]);
        });
      } else {
        tableBody.push([
          'Single Session',
          formatDateTime(booking.start_time),
          calculateDuration(booking.start_time, booking.end_time, booking.facility),
          formatIDR(sessionPrice)
        ]);
      }

      doc.autoTable({
        startY: currentY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [66, 139, 202], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 60 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || currentY + 10;

      // Summary
      let summaryY = finalY + 10;
      doc.setFontSize(10);

      if (isMember) {
        doc.setFontSize(9);
        doc.text('Summary:', leftX, summaryY);
        doc.text(`Price per Session: ${formatIDR(sessionPrice)}`, leftX, summaryY + 7);
        doc.text(`Number of Sessions: 4`, leftX, summaryY + 14);
        doc.setFontSize(10);
        doc.text('Total Amount:', rightX, summaryY + 14);
        doc.text(formatIDR(totalPrice), rightX + 40, summaryY + 14);
        summaryY += 22;
      } else {
        doc.text('Total Amount:', rightX, summaryY);
        doc.text(formatIDR(totalPrice), rightX + 40, summaryY);
        summaryY += 10;
      }

      // Payment Info
      if (booking.payment_method) {
        doc.setFontSize(9);
        doc.text('Payment Information:', leftX, summaryY + 10);
        doc.text(`Bank: ${booking.payment_method.bank_name}`, leftX, summaryY + 17);
        doc.text(`Account: ${booking.payment_method.account_number}`, leftX, summaryY + 24);
        doc.text(`Account Holder: ${booking.payment_method.account_holder}`, leftX, summaryY + 31);
      }

      // Footer
      doc.setFontSize(9);
      doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });

      doc.save(`invoice-${booking.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const toggleBookingExpand = (bookingId: string) => {
    setExpandedBookings(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

  const filteredBookings = bookings.filter((booking) => {
  // 1. Booking utama atau GYM
  if (!booking.is_main_booking && booking.facility.name.toLowerCase() !== 'gym') {
    return false;
  }

  // 2. Filter pencarian
  const searchTerm = filters.search.toLowerCase();
  const matchesSearch =
    (booking.is_guest_booking
      ? booking.customer_name?.toLowerCase()
      : booking.user?.full_name?.toLowerCase()
    )?.includes(searchTerm) ||
    booking.facility.name.toLowerCase().includes(searchTerm) ||
    (booking.guest_reference || '').toLowerCase().includes(searchTerm);

  // 3. Filter fasilitas & status
  const matchesFacility = filters.facility === 'all' || booking.facility_id === filters.facility;
  const matchesStatus = filters.status === 'all' || booking.status === filters.status;

  // 4. Filter tanggal (berdasarkan dateFilter)
  let matchesDate = true;
  const bookingDate = new Date(booking.start_time);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (dateFilter.type) {
    case 'today': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      matchesDate = bookingDate >= today && bookingDate < tomorrow;
      break;
    }
    case 'week': {
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      matchesDate = bookingDate >= today && bookingDate < weekFromNow;
      break;
    }
    case 'month': {
      const monthFromNow = new Date(today);
      monthFromNow.setMonth(monthFromNow.getMonth() + 1);
      matchesDate = bookingDate >= today && bookingDate < monthFromNow;
      break;
    }
    case 'custom': {
      const start = new Date(dateFilter.startDate);
      const end = new Date(dateFilter.endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = bookingDate >= start && bookingDate <= end;
      break;
    }
  }

  return matchesSearch && matchesFacility && matchesStatus && matchesDate;
});
  
const handleDateFilterChange = (
  type: 'today' | 'week' | 'month' | 'custom' | 'all',
  startDate?: string,
  endDate?: string
) => {
  const todayStr = new Date().toISOString().split('T')[0];
  setDateFilter({
    type,
    startDate: startDate || todayStr,
    endDate: endDate || todayStr
  });
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
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <LayoutDashboard className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-2xl font-bold text-gray-900">
  {`${profile?.full_name || ''} ${profile?.role?.name?.replace('_', ' ') || ''}`.replace(/\b\w/g, c => c.toUpperCase())}

</span>

              </div>
            </div>
            

            <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
  <button
    onClick={() => navigate('/')}
    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-100"
  >
    Home Page
  </button>

  <button
    onClick={() => navigate('/create-booking')}
    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
  >
    <Plus className="h-5 w-5 mr-2" />
    Create Booking
  </button>

              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <SettingsIcon className="h-6 w-6" />
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
              >
                {showMenu ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {showMenu && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate('/create-booking');
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Create Booking
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate('/settings');
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowLogoutConfirm(true);
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filters.facility}
                onChange={(e) => setFilters({ ...filters, facility: e.target.value })}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">All Facilities</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              
  <select
    value={dateFilter.type}
    onChange={(e) => handleDateFilterChange(e.target.value as DateFilter['type'])}
    className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
  >
    <option value="all">All Dates</option>
    <option value="today">Today</option>
    <option value="week">This Week</option>
    <option value="month">This Month</option>
    <option value="custom">Custom Range</option>
  </select>

  {dateFilter.type === 'custom' && (
    <div className="flex items-center space-x-2">
      <input
        type="date"
        value={dateFilter.startDate}
        onChange={(e) =>
          handleDateFilterChange('custom', e.target.value, dateFilter.endDate)
        }
        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <span className="text-gray-500">to</span>
      <input
        type="date"
        value={dateFilter.endDate}
        onChange={(e) =>
          handleDateFilterChange('custom', dateFilter.startDate, e.target.value)
        }
        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>
  )}
            <div className="flex gap-2">
  <button
    onClick={handleExportFiltered}
    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
  >
    <Download className="h-5 w-5 mr-2" />
    Export Filtered
  </button>

  <button
    onClick={handleExportAll}
    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
  >
    <Download className="h-5 w-5 mr-2" />
    Export All
  </button>
</div>

            </div>
          </div>
        </div>

        {/* Bookings List */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-500">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Facility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference / Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <React.Fragment key={booking.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {booking.is_guest_booking ? booking.customer_name : booking.user?.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {booking.is_guest_booking ? booking.customer_email : booking.user?.email}
                              </div>
                              {booking.customer_phone && (
                                <div className="text-sm text-gray-500">
                                  {booking.customer_phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.facility.name}</div>
                          <div className="text-sm text-gray-500">
                            {booking.facility.booking_type === 'per_day' ? 'Daily Booking' : 'Hourly Booking'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-gray-900">
                              {formatDateTime(booking.start_time)}
                            </div>
                            {booking.user?.role?.name === 'members' && booking.related_bookings && booking.related_bookings.length > 0 && (
                              <button
                                onClick={() => toggleBookingExpand(booking.id)}
                                className="ml-2 inline-flex items-center text-xs text-indigo-600 hover:text-indigo-900"
                              >
                                <ChevronDown 
                                  className={`h-4 w-4 transform transition-transform ${
                                    expandedBookings.has(booking.id) ? 'rotate-180' : ''
                                  }`}
                                />
                                <span className="ml-1">
                                  {expandedBookings.has(booking.id) ? 'Hide' : `Show ${booking.related_bookings.length} sessions`}
                                </span>
                              </button>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Duration: {calculateDuration(booking.start_time, booking.end_time, booking.facility)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-indigo-600">
                            {formatIDR(booking.total_price)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {booking.payment_method?.bank_name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {booking.is_guest_booking 
                              ? booking.guest_reference 
                              : booking.id.slice(0, 8).toUpperCase()}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              booking.is_guest_booking 
                                ? 'bg-purple-100 text-purple-800'
                                : booking.user?.role?.name === 'members'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}>
                              {booking.is_guest_booking 
                                ? 'Guest'
                                : booking.user?.role?.name === 'members'
                                  ? 'Member'
                                  : 'Regular'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button
  onClick={() => printInvoice(booking)}
  className="text-indigo-600 hover:text-indigo-900"
  title="Print Invoice"
>
  <Printer className="h-5 w-5" />
</button>

                            {(booking.status === 'pending' || booking.status === 'cancelled') && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                className="text-green-600 hover:text-green-900"
                                title="Confirm"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                            )}
                            {booking.status !== 'cancelled' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            )}
                            {['super_admin', 'admin', 'staff'].includes(profile?.role?.name || '') && (
  <button
    onClick={() => navigate(`/edit-booking/${booking.id}`)}
    className="text-blue-600 hover:text-blue-900"
    title="Edit"
  >
    <Edit className="h-5 w-5" />
  </button>
)}

                            {['super_admin', 'admin'].includes(profile?.role?.name || '') && (
  <button
    onClick={() => deleteBooking(booking.id)}
    className="text-red-600 hover:text-red-900"
  >
    <Trash2 className="h-5 w-5" />
  </button>
)}

                          </div>
                        </td>
                      </tr>
                      {/* Show related bookings if expanded */}
                      {booking.user?.role?.name === 'members' && 
                       booking.related_bookings && 
                       expandedBookings.has(booking.id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-4">
                              <div className="border-l-4 border-indigo-500 pl-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Related Sessions</h4>
                                <div className="space-y-3">
                                  {[...booking.related_bookings]
  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  .map(relatedBooking => (

                                    <div key={relatedBooking.id} className="flex items-center justify-between text-sm">
                                      <div className="flex items-center space-x-4">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600">
                                          {formatDateTime(relatedBooking.start_time)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-4">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600">
                                          {calculateDuration(relatedBooking.start_time, relatedBooking.end_time, relatedBooking.facility)}
                                        </span>
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(relatedBooking.status)}`}>
                                          {relatedBooking.status.charAt(0).toUpperCase() + relatedBooking.status.slice(1)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Sign Out</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to sign out? You will need to sign in again to access your account.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}