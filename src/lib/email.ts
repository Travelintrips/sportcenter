import { supabase } from "./supabase";

interface SendBookingConfirmationEmailParams {
  to: string;
  customerName: string;
  facilityName: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  bookingReference?: string;
}

interface SendWelcomeEmailParams {
  to: string;
  fullName: string;
}

export async function sendBookingConfirmationEmail({
  to,
  customerName,
  facilityName,
  startTime,
  endTime,
  totalPrice,
  bookingReference,
}: SendBookingConfirmationEmailParams) {
  try {
    if (!customerName) {
      throw new Error("Customer name is required for email notification");
    }

    if (!to) {
      throw new Error("Recipient email is required");
    }

    // Send email notification through database trigger instead
    const { error } = await supabase.from("email_notifications").insert([
      {
        recipient_email: to,
        recipient_name: customerName,
        type: "booking_confirmation",
        data: {
          facilityName,
          startTime,
          endTime,
          totalPrice,
          bookingReference,
          customerName,
        },
        status: "pending",
        booking_reference: bookingReference,
      },
    ]);

    if (error) {
      console.error("Error creating email notification:", error);
      throw new Error("Failed to queue email notification");
    }
  } catch (error) {
    console.error("Error queueing email notification:", error);
    throw error;
  }
}

export async function sendWelcomeEmail({
  to,
  fullName,
}: SendWelcomeEmailParams) {
  try {
    if (!fullName) {
      throw new Error("Full name is required for welcome email");
    }

    if (!to) {
      throw new Error("Recipient email is required");
    }

    const { error } = await supabase.from("email_notifications").insert([
      {
        recipient_email: to,
        recipient_name: fullName,
        type: "welcome_email",
        data: {
          fullName,
        },
        status: "pending",
      },
    ]);

    if (error) {
      console.error("Error creating welcome email notification:", error);
      throw new Error("Failed to queue welcome email");
    }
  } catch (error) {
    console.error("Error queueing welcome email:", error);
    throw error;
  }
}
