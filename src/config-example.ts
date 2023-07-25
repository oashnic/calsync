export type CalDavDescriptor = {
  kind: 'CalDav',
  label: string,
  url: string,
  username: string,
  password: string,
  redactedSummary?: string
};

export type GCalDescriptor = {
  kind: 'GCal',
  label: string,
  id: string,
  redactedSummary?: string
  credentialDir?: string
};

export const isGCalDescriptor = (d: any): d is GCalDescriptor => d.kind === 'GCal';

export type CalendarDescriptor = CalDavDescriptor | GCalDescriptor;

// A string that will be searched in event summaries to prevent
// the redacting of the summary when copying the event.
export const FORCE_SHARING_SIGN = "👀";
export const LOG_DETAIL = true;

export type user = {
  name: string,
  replaceSummary: boolean,
  sources: CalendarDescriptor[],
  target: CalendarDescriptor,
}

export const users: user[] = [
  {
    name: "example",
    replaceSummary: true,
    sources: [
      {
        kind: 'GCal',
        label: 'public',
        id: 'your-name@gmail.com',
        redactedSummary: 'Public',
      },
      {
        kind: 'GCal',
        label: 'personal',
        id: 'your-other-name@gmail.com',
        redactedSummary: 'Personal'
      },
      {
        kind: 'CalDav',
        label: 'home',
        url: 'https://dav.domain.com/calendars/123456/home/',
        username: 'your-username@domain.com',
        password: 'your-password',
        redactedSummary: 'Home'
      },
    ],
    target: {
      kind: 'GCal',
      label: 'mirror-target',
      id: 'your-calendar-id@group.calendar.google.com'
    }
  }
]

export const dryMode: boolean = true; 
export const targetMode: string = 'sync'; // 'sync' or 'mirror'
export const calsyncFingerprint: string = '[Synced with https://github.com/rchampourlier/calsync]';