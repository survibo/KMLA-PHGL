export const WEEK_EDIT_POLICY = {
  deadline: {
    // A week is editable until this many days after its Monday start.
    daysAfterWeekStart: 7, //7 - 월
    hour: 8,
    minute: 30,
    utcOffsetMinutes: 9 * 60,
  },
  nextWeekLimit: {
    maxWeeksAhead: 2,
  },
};

function parseISODateParts(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate));
  if (!match) return null;

  const [, y, m, d] = match;
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
  };
}

export function dateTimeInOffsetToDate({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  utcOffsetMinutes,
}) {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - utcOffsetMinutes * 60 * 1000
  );
}

export function getWeekEditDeadline(weekStartISO, policy = WEEK_EDIT_POLICY) {
  const parts = parseISODateParts(weekStartISO);
  if (!parts) return null;

  const { daysAfterWeekStart, hour, minute, utcOffsetMinutes } =
    policy.deadline;

  return dateTimeInOffsetToDate({
    ...parts,
    day: parts.day + daysAfterWeekStart,
    hour,
    minute,
    utcOffsetMinutes,
  });
}

export function isWeekEditable(
  weekStartISO,
  now = new Date(),
  policy = WEEK_EDIT_POLICY
) {
  const deadline = getWeekEditDeadline(weekStartISO, policy);
  return deadline ? now.getTime() < deadline.getTime() : false;
}
