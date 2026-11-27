const DAY_MS = 24 * 60 * 60 * 1000;

function uploadDates(uploads = []) {
  return [...uploads]
    .map((upload) => new Date(upload?.uploaded_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);
}

function daySpan(start, end) {
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function publicPayload(payload, { isOwner = false } = {}) {
  if (isOwner) return payload;
  const { started_at, latest_uploaded_at, ...rest } = payload;
  return rest;
}

export function profileStreak(uploads = [], { now = new Date(), maxGapDays = 7, isOwner = false } = {}) {
  const dates = uploadDates(uploads);
  if (!dates.length) return null;

  const maxGapMs = Math.max(1, Number(maxGapDays) || 7) * DAY_MS;
  const streakDates = [dates[0]];
  for (let i = 1; i < dates.length; i++) {
    const gapMs = streakDates[streakDates.length - 1].getTime() - dates[i].getTime();
    if (gapMs > maxGapMs) break;
    streakDates.push(dates[i]);
  }

  const latest = streakDates[0];
  const started = streakDates[streakDates.length - 1];
  const active = now.getTime() - latest.getTime() <= maxGapMs;
  const days = daySpan(started, latest);
  const uploadCount = streakDates.length;
  const label = active ? `${days}-day streak` : `${days}-day streak paused`;

  return publicPayload({
    active,
    days,
    upload_count: uploadCount,
    cadence_window_days: Math.max(1, Number(maxGapDays) || 7),
    label,
    detail: `${uploadCount} saved result${uploadCount === 1 ? '' : 's'} in this streak`,
    started_at: started.toISOString(),
    latest_uploaded_at: latest.toISOString(),
  }, { isOwner });
}
