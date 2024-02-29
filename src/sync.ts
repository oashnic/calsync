import {
  CalendarEvent,
  CalendarEventData,
  compareEventsData,
  extractEventData,
  extractGCalEventData,
  GCalEvent,
  isCalDAVEvent,
  isGCalEvent,
} from "./events";
import { NewSummary, ShouldCopy } from "./rules";
import { calsyncFingerprint } from "./config"
import moment from "moment-timezone";

export type SyncToGCalInstructions = {
  insert: CalendarEventData[];
  update: { eventId: string; eventData: CalendarEventData }[];
  delete: string[];
};

/**
 * Returns instructions to perform a synchronisation between
 * sources' events and target's ones.
 *
 * Algorithm:
 *   - Makes a map of both sourcesEvents and targetEvents on UID key
 *   - Returns a `SyncInstructions` object where the events in
 *     insert/update/delete array properties are objects in `sourcesEvents`.
 *
 * @param sourcesEvents
 * @param targetEvents
 */
export function toGCal(
  sourcesEvents: { event: CalendarEvent; prefixSummary: string; redactedSummary: string }[],
  targetEvents: GCalEvent[],
  replaceSummary: boolean,
  addPrefix: boolean,
): SyncToGCalInstructions {
  const eventsInsert: CalendarEventData[] = [];
  const eventsUpdate: { eventId: string; eventData: CalendarEventData }[] = [];
  const eventsDelete: string[] = [];

  const markedTargetEventIds: string[] = []; // ids of target events matched with sources events (missing are deleted)

  for (const srcEvt of sourcesEvents) {
    const srcEvtData = extractEventData(srcEvt.event);
    const matchingId = (() => {
      if (isGCalEvent(srcEvt.event)){
        if (srcEvt.event.start.date) {
          return `${srcEvt.event.id}-${srcEvt.event.start.date}`
        } else if (srcEvt.event.start.dateTime){
          return `${srcEvt.event.id}-${srcEvt.event.start.dateTime}`
        } else {
          return `${srcEvt.event.id}`
        }
      }
      if (isCalDAVEvent(srcEvt.event)) {
        if (srcEvt.event.uid.includes(`${srcEvt.event.startDate.getTime()}`)) {
          return srcEvt.event.uid
        } else {
          return `${srcEvt.event.uid}-${srcEvt.event.startDate.getTime()}`;
        }
      } 
    })();

    // Search matching event in targetEvents
    const matchingTargetEvt = (() => {
      for (const targetEvt of targetEvents) {
        if (targetEvt.description && targetEvt.description.includes(`${matchingId}-${srcEvtData.start.dateTime}-${srcEvtData.start.date}END`))
          return targetEvt;
      }
      return undefined;
    })();

    srcEvtData.description = `Original ID: ${matchingId}-${srcEvtData.start.dateTime}-${srcEvtData.start.date}END\n${calsyncFingerprint}` //(srcEvtData.description || '') + `\nOriginal ID: ${matchingId}\n${calsyncFingerprint}`;

    // Ignoring events not to be copied
    if (
      !ShouldCopy(
        srcEvtData.summary,
        !!srcEvtData.transparency && srcEvtData.transparency === "transparent"
      )
    )
      continue;
    
    if (addPrefix) {
      srcEvtData.summary = NewSummary(srcEvtData.summary, `${srcEvt.prefixSummary}${srcEvtData.summary}`)
    }

    if (replaceSummary) {
      srcEvtData.summary = NewSummary(srcEvtData.summary, srcEvt.redactedSummary);
    }

    if (!matchingTargetEvt) {
      // No match on ID -> insert
      const now = new Date()
      now.setDate(now.getDate() - 1)
      let endDate = new Date()

      if (srcEvtData.end.date) {
        if (srcEvtData.end.timeZone) {
          endDate = new Date(moment.tz(moment(srcEvtData.end.date).format(`YYYY-MM-DD HH:mm`), srcEvtData.end.timeZone).format())
        } else {
          endDate = new Date(moment.tz(srcEvtData.end.date).format())
        }
      } else if (srcEvtData.end.dateTime) {
        endDate = new Date(moment.tz(moment(srcEvtData.end.dateTime).format(`YYYY-MM-DD HH:mm`), srcEvtData.end.timeZone).format())
      }


      if (endDate > now) {
        eventsInsert.push(srcEvtData);
      }

    } else {
      // Match on ID -> update or do nothing
      markedTargetEventIds.push(matchingTargetEvt.id);

      if (
        !compareEventsData(extractGCalEventData(matchingTargetEvt), srcEvtData)
      ) {
        const d = extractEventData(matchingTargetEvt)
        // Not matching on content -> update
        eventsUpdate.push({
          eventId: matchingTargetEvt.id,
          eventData: srcEvtData,
        });
      }
    }
  }

  for (const targetEvt of targetEvents) {
    if (
      targetEvt.description &&
      targetEvt.description.includes(calsyncFingerprint) &&
      !markedTargetEventIds.includes(targetEvt.id)
    ) {
      // Deleting events which have the calsync fingerprint and have
      // not been marked (not matched with a source event).
      eventsDelete.push(targetEvt.id);
    }
  }

  return {
    insert: eventsInsert,
    update: eventsUpdate,
    delete: eventsDelete,
  };
}
