import { supabase } from './supabase';

interface Booking {
  facility_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  booking_reference?: string;  // ✅ Tambahkan ini
  status?: string;
}


export async function insertMultipleBookings(bookings: Booking[]) {
  console.log("Inserting bookings: ", bookings);
  const { data, error } = await supabase
    .from('bookings')
    .insert(bookings);

  if (error) {
    throw error;
  }
console.log("Booking insertion successful: ", data);
  return data;
}
