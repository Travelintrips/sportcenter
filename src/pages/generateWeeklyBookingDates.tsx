export function generateWeeklyBookingDates(
  startDate: Date,
  occurrences = 4
): Date[] {
  const dates: Date[] = [];

  for (let i = 0; i < occurrences; i++) {
    const bookingDate = new Date(startDate);
    bookingDate.setDate(startDate.getDate() + i * 7); // Add 7 days per week
    dates.push(bookingDate);
  }

  return dates;
}