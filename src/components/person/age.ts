type CalendarDate = { year: number; month: number; day: number };

// TMDB dates are calendar dates ("YYYY-MM-DD"). They are compared as plain
// year/month/day values so the server's time zone can never shift a birthday.
function parseDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  // Rejects impossible dates such as 1990-02-30 (Date.UTC would roll them over).
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function yearsBetween(from: CalendarDate, to: CalendarDate): number {
  const beforeAnniversary =
    to.month < from.month || (to.month === from.month && to.day < from.day);
  return to.year - from.year - (beforeAnniversary ? 1 : 0);
}

/**
 * Age in full years today, or at death when `deathday` is set. `now` is read
 * as a UTC calendar date. Returns null for invalid input or an end date
 * before the birthday.
 */
export function calcAge(
  birthday: string,
  deathday: string | null,
  now: Date = new Date()
): number | null {
  const birth = parseDate(birthday);
  if (!birth) return null;

  let end: CalendarDate | null;
  if (deathday !== null) {
    end = parseDate(deathday);
  } else {
    end = Number.isNaN(now.getTime())
      ? null
      : {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
          day: now.getUTCDate(),
        };
  }
  if (!end) return null;

  const age = yearsBetween(birth, end);
  return age >= 0 ? age : null;
}
