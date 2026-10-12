/** Inclusive calendar-day span in UTC (1–30 days allowed for bookings). */
export function inclusiveDays(startDate: string, endDate: string): number {
  return (Date.parse(endDate+'T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/86_400_000+1;
}

/** A sitter may only confirm or decline a pending request. */
export function sitterCanRespond(status: string): boolean { return status==='pending'; }

/** Owner may cancel a booking up to its completion. */
export function ownerCanCancel(status: string): boolean { return status==='pending'||status==='accepted'; }
