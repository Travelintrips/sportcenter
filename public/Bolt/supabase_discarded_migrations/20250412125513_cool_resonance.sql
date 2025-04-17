/*
  # Add Booking Reference Generator

  1. Changes
    - Add booking_reference column to bookings table
    - Create function to generate booking references
    - Add trigger to automatically set booking reference
    
  2. Security
    - Function runs with security definer permissions
    - Maintains proper access control
*/

-- Add booking_reference column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'booking_reference'
  ) THEN
    ALTER TABLE bookings
    ADD COLUMN booking_reference text;
  END IF;
END $$;

-- Create index for booking reference
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference 
ON bookings(booking_reference);

-- Create function to generate booking reference
CREATE OR REPLACE FUNCTION set_booking_reference()
RETURNS TRIGGER AS $$
DECLARE
  ref_prefix text;
  timestamp_str text;
  random_str text;
BEGIN
  -- Generate timestamp string (YYYYMMDDHHmmss)
  timestamp_str := to_char(NEW.created_at, 'YYYYMMDDHH24MISS');
  
  -- Generate random string (6 characters)
  random_str := substr(md5(random()::text), 1, 6);
  
  -- Set prefix based on booking type
  IF NEW.is_guest_booking THEN
    ref_prefix := 'GST';
  ELSE
    -- Check if user is a member
    IF EXISTS (
      SELECT 1 
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = NEW.user_id
      AND r.name = 'members'
    ) THEN
      ref_prefix := 'MBR';
    ELSE
      ref_prefix := 'REG';
    END IF;
  END IF;
  
  -- Set the booking reference
  NEW.booking_reference := ref_prefix || '-' || timestamp_str || '-' || random_str;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set booking reference
DROP TRIGGER IF EXISTS tr_set_booking_reference ON bookings;
CREATE TRIGGER tr_set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_reference();