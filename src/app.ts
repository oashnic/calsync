import * as fs from "fs";
import * as config from "./config";
import * as caldav from "./caldav/caldav";
import * as gcal from "./gcal/gcal";
import * as sync from "./sync";
import { log, logWithEventData, logWithGCalEvent } from "./log";
import { CalendarEvent, isCalDAVEvent, CalDAVEvent } from "./events";
import ICalParser from 'ical-js-parser';
import * as ical from "ical2json";

const WRITE_TO_FILE = process.env["WRITE_TO_FILE"] === "true" ?? false;
const CLEAN_TARGET = false;

async function main() {
  const start: Date = new Date();
  start.setDate(start.getDate() - 1)
  const end: Date = new Date();
  end.setFullYear(end.getFullYear() + 1);

  for (const user of config.users) {
    const sourcesEvents: {
      event: CalendarEvent;
      redactedSummary: string | undefined;
      prefixSummary: string | undefined;
    }[] = [];
    for (const source of user.sources) {
      const fetchedEvents =
        source.kind === "CalDav"
          ? await caldav.listEvents(source, start, end).catch((e) => {const err = new Error(`user ${user.name} : ${e}`); throw err})
          : await gcal.listEvents(source, start, end).catch((e) => {const err = new Error(`Error ${user.name} : ${e}`); throw err});
      log(`Fetched ${fetchedEvents.length} events for ${source.label}`);

      fetchedEvents.forEach((event: CalendarEvent) => {
        // Handling CalDAV recurrent events

        if (isCalDAVEvent(event) && event.isRecurring) {
          // Handling recurring CalDAV events
          // Iterate using the recurrenceIterator and create
          // events when in the timespan.
          if (event.startDate >= start && event.startDate <= end) {
            // `event` is within the period
            sourcesEvents.push({
              event: event,
              redactedSummary: source.redactedSummary,
              prefixSummary: source.prefixSummary
            });
          }
          const it = event.recurrenceIterator;
          let nextOccurrence: any;
          while ((nextOccurrence = it.next())) {
            const nextOccurrenceStartDate = nextOccurrence.toJSDate();

            // Ignoring occurrences which are before the range and
            // stopping the loop once the end of the range has been reached
            if (nextOccurrenceStartDate < start) continue;
            if (nextOccurrenceStartDate > end) break;

            const eventDuration =
              event.endDate.getTime() - event.startDate.getTime();
            const nextOccurrenceEndDate = new Date();
            nextOccurrenceEndDate.setTime(
              nextOccurrenceStartDate.getTime() + eventDuration
            );
            const nextOccurrenceEvent: CalDAVEvent = {
              ...event,
              uid: `${event.uid}-${nextOccurrenceStartDate.getTime()}`,
              startDate: nextOccurrenceStartDate,
              endDate: nextOccurrenceEndDate,
            };

            // const exist = false;

            // for (const srcEvt of sourcesEvents) {
            //   const tmp = srcEvt.event as CalDAVEvent
            //   if (tmp.summary.includes("debug")){
            //   if (tmp.uid.split("-")[0] === nextOccurrenceEvent.uid.split("-")[0]) {
            //     console.log(srcEvt)
            //   }}
            // }

            sourcesEvents.push({
              event: nextOccurrenceEvent,
              redactedSummary: source.redactedSummary,
              prefixSummary: source.prefixSummary,
            });
          }
          // We skip the push below since we only want to push
          // the instances within the selected period for CalDAV
          // recurrent events. The CalDAV API returns the initial
          // event (which may be before the fetched period) if
          // some instances are within the fetched period.
          return;
        }

        const tmp = event as CalDAVEvent
        if (tmp.recurrenceId){
          for (let i = 0; i < sourcesEvents.length; i++) {
            const srcEvent = sourcesEvents[i]
            const tmp2 = srcEvent.event as CalDAVEvent;
            
            const d = new Date(tmp.recurrenceId)
            if (tmp2.uid.includes(tmp.uid) && tmp2.startDate.getTime() === d.getTime()){
              sourcesEvents[i].event = tmp
            }
          }
        }

        sourcesEvents.push({
          event,
          redactedSummary: source.redactedSummary,
          prefixSummary: source.prefixSummary,
        });
      });
    }
    if (WRITE_TO_FILE)
      fs.writeFileSync(
        "./data/sourcesEvents.json",
        JSON.stringify(sourcesEvents)
      );

    if (user.target.kind === "GCal") {
      const targetEvents = await gcal.listEvents(user.target, start, end);
      if (WRITE_TO_FILE)
        fs.writeFileSync(
          "./data/targetEvents.json",
          JSON.stringify(targetEvents)
        );
      const instructions: sync.SyncToGCalInstructions = sync.toGCal(
        sourcesEvents,
        targetEvents,
        user.replaceSummary,
        user.addPrefix
      );

      log(
        `Sync: ${instructions.insert.length} inserts, ${instructions.update.length} updates, ${instructions.delete.length} deletions`
      );
      if (!config.dryMode) {
        await gcal.insertEvents(user.target, instructions.insert);
        await gcal.updateEvents(user.target, instructions.update);
        await gcal.deleteEventsByIds(user.target, instructions.delete);
      } else {
        log(`Insert:`);
        instructions.insert.forEach((eventData) => {
          console.log(eventData);
          logWithEventData(" - ", eventData);
        });
        log(`Update:`);
        instructions.update.forEach((instruction) => {
          logWithEventData(" - ", instruction.eventData);
        });
        log(`Delete:`);
        instructions.delete.forEach((eventId) => {
          log(` - ${eventId}`);
        });
      }
    } else throw new Error("NOT IMPLEMENTED YET");
  }
}

async function cleanTarget() {
  for (const user of config.users) {
    const target = user.target as config.GCalDescriptor;
    let start: Date = new Date(2021, 0, 17);
    let end: Date = new Date(2021, 0, 19);
    await gcal.deleteEvents(target, start, end);
    start = new Date(2020, 10, 18);
    end = new Date(2020, 10, 20);
    await gcal.deleteEvents(target, start, end);
  }
}

try {
  main();
  if (CLEAN_TARGET) {
    cleanTarget();
  }
} catch (err) {
  log("Error: " + err);
}
