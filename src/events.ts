/**
 * This module maps events from gCal's format to iCal's 
 * and vice-versa.
 */

import { calendar_v3 } from "googleapis";
import { CalendarEvent as CalDAVCalendarEvent } from "./caldav/calendar-event";

export type CalDAVEvent = CalDAVCalendarEvent;
export type GCalEvent = calendar_v3.Schema$Event;
export type CalendarEvent = GCalEvent | CalDAVEvent;
export type CalendarEventData = {
  summary: string,
  description?: string,
  start: { date?: string, dateTime?: string },
  end: { date?: string, dateTime?: string },
  transparency?: string
}

export const isCalDAVEvent = (e: any): e is CalDAVEvent => !!e.iCalendarData;
export const isGCalEvent = (e: any): e is GCalEvent => !!e.iCalUID;

function formatDate(date: Date): string {
  function pad(n: number): string {
    return (n <= 9 ? `0${n}` : `${n}`);
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const str = `${year}-${pad(month)}-${pad(day)}`;
  return str;
}

export function extractGCalEventData(evt: GCalEvent): CalendarEventData {
  return {
    summary: evt.summary,
    start: { date: evt.start.date, dateTime: evt.start.dateTime },
    end: { date: evt.end.date, dateTime: evt.end.dateTime },
    transparency: evt.transparency
  };
}

export function extractCalDAVEventData(evt: CalDAVEvent): CalendarEventData {
  return {
    summary: evt.summary,
    start: (evt.allDayEvent ?
      { date: formatDate(evt.startDate) } : // yyyy-mm-dd format
      { dateTime: evt.startDate.toISOString() }),
    end: (evt.allDayEvent ?
      { date: formatDate(evt.endDate) } : // yyyy-mm-dd format
      { dateTime: evt.endDate.toISOString() }),
    transparency: evt.iCalendarData.includes('TRANSP:TRANSPARENT') ? 'transparent' : undefined
  };
}

export function extractEventData(evt: CalendarEvent): CalendarEventData {
  if (isGCalEvent(evt)) return extractGCalEventData(evt);
  if (isCalDAVEvent(evt)) return extractCalDAVEventData(evt);
}

export function eventDataToGCalEvent(d: CalendarEventData): GCalEvent {
  const newEvt: GCalEvent = {
    summary: d.summary,
    start: d.start,
    end: d.end,
    transparency: d.transparency
  };
  return newEvt;
}

export function compareEventsData(evtA: CalendarEventData, evtB: CalendarEventData): boolean {
  if (evtA.summary !== evtB.summary) return false;
  if (evtA.start.date && (!evtB.start.date || evtA.start.date !== evtB.start.date)) return false;
  if (evtA.start.dateTime && (!evtB.start.dateTime || evtA.start.dateTime !== evtB.start.dateTime)) return false;
  if (evtA.transparency !== evtB.transparency) return false;
  return true;
}