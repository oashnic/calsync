import { CalendarClient } from "./calendar-client";
import { CalDavDescriptor, LOG_DETAIL } from "../config";
import { CalendarEvent } from "./calendar-event";

export async function listEvents(
  calDesc: CalDavDescriptor,
  start: Date,
  end: Date
): Promise<CalendarEvent[]> {
  const calendarClient = new CalendarClient(
    calDesc.url,
    calDesc.username,
    calDesc.password
  );
  const calendarEvents = await calendarClient.getEvents(start, end);
  
  // Fix escape
  for (let i = 0; i < calendarEvents.length; i++){
    calendarEvents[i].summary = calendarEvents[i].summary.replace(/\\/g, '');
  }

  return calendarEvents;
}
