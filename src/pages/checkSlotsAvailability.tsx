import { supabase } from '../lib/supabase';

export async function checkSlotsAvailability(
  facilityId: string,
  bookingSlots: { start: Date; end: Date }[]
): Promise<boolean> {
  for (const slot of bookingSlots) {
    const { data, error } = await supabase
  .from('bookings')
  .select('id')
  .eq('facility_id', facilityId)
  .neq('status', 'cancelled')
  .lt('start_time', slot.end.toISOString())
  .gt('end_time', slot.start.toISOString());


    if (error) throw error;

    if (data && data.length > 0) {
      return false;
    }
  }

  return true;
}