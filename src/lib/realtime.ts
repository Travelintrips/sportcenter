import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface BookingStatusChange {
  booking_id: string;
  status: string;
  facility_id: string;
  user_id: string;
}

interface FacilityUpdate {
  facility_id: string;
  name: string;
  price_per_hour: number;
  updated_at: string;
}

interface UserSignup {
  user_id: string;
  full_name: string;
  created_at: string;
}

class RealtimeManager {
  private bookingChannel: RealtimeChannel | null = null;
  private facilityChannel: RealtimeChannel | null = null;
  private userChannel: RealtimeChannel | null = null;

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels() {
    // Subscribe to booking status changes
    this.bookingChannel = supabase
      .channel('booking_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: 'status=neq.cancelled'
        },
        (payload) => {
          this.handleBookingStatusChange(payload.new as BookingStatusChange);
        }
      )
      .subscribe();

    // Subscribe to facility updates
    this.facilityChannel = supabase
      .channel('facility_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sports_facilities'
        },
        (payload) => {
          this.handleFacilityUpdate(payload.new as FacilityUpdate);
        }
      )
      .subscribe();

    // Subscribe to user signups
    this.userChannel = supabase
      .channel('user_signups')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          this.handleUserSignup(payload.new as UserSignup);
        }
      )
      .subscribe();
  }

  private handleBookingStatusChange(data: BookingStatusChange) {
    // Dispatch custom event for booking status change
    const event = new CustomEvent('bookingStatusChanged', {
      detail: data
    });
    window.dispatchEvent(event);
  }

  private handleFacilityUpdate(data: FacilityUpdate) {
    // Dispatch custom event for facility update
    const event = new CustomEvent('facilityUpdated', {
      detail: data
    });
    window.dispatchEvent(event);
  }

  private handleUserSignup(data: UserSignup) {
    // Dispatch custom event for user signup
    const event = new CustomEvent('userSignedUp', {
      detail: data
    });
    window.dispatchEvent(event);
  }

  public cleanup() {
    this.bookingChannel?.unsubscribe();
    this.facilityChannel?.unsubscribe();
    this.userChannel?.unsubscribe();
  }
}

export const realtimeManager = new RealtimeManager();