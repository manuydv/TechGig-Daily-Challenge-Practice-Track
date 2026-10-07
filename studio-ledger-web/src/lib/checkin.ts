function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `d`, as a YYYY-MM-DD key. */
function weekKey(d: Date): string {
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return dateKey(monday);
}

export interface CheckinStats {
  /** Consecutive weeks up to and including this one with at least one visit. */
  weekStreak: number;
  /** Distinct days visited in the current (Mon-Sun) week. */
  thisWeekVisits: number;
  /** % of the last `windowWeeks` weeks (including this one) with at least one visit. */
  attendancePct: number;
  totalVisits: number;
}

const ATTENDANCE_WINDOW_WEEKS = 10;

/**
 * `recentVisits` is a list of YYYY-MM-DD dates (may contain duplicates or be
 * unsorted) covering roughly the last 10 weeks, as returned by the
 * `public_check_in` RPC. `today` anchors "this week" / "weeks ago" math.
 */
export function computeCheckinStats(recentVisits: string[], today: string): CheckinStats {
  const visitDays = new Set(recentVisits);
  const todayDate = parseLocalDate(today);
  const currentWeekKey = weekKey(todayDate);

  const weeksWithVisit = new Set<string>();
  for (const dateStr of visitDays) {
    weeksWithVisit.add(weekKey(parseLocalDate(dateStr)));
  }

  let weekStreak = 0;
  const cursor = new Date(todayDate);
  for (let i = 0; i < 52; i++) {
    const key = weekKey(cursor);
    if (weeksWithVisit.has(key)) {
      weekStreak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  const thisWeekVisits = [...visitDays].filter((d) => weekKey(parseLocalDate(d)) === currentWeekKey).length;

  let weeksInWindowWithVisit = 0;
  const windowCursor = new Date(todayDate);
  for (let i = 0; i < ATTENDANCE_WINDOW_WEEKS; i++) {
    if (weeksWithVisit.has(weekKey(windowCursor))) weeksInWindowWithVisit++;
    windowCursor.setDate(windowCursor.getDate() - 7);
  }
  const attendancePct = Math.round((weeksInWindowWithVisit / ATTENDANCE_WINDOW_WEEKS) * 100);

  return {
    weekStreak,
    thisWeekVisits,
    attendancePct,
    totalVisits: visitDays.size,
  };
}
