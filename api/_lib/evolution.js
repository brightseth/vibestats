const ARCHETYPE_LABELS = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

function labelFor(archetype) {
  return ARCHETYPE_LABELS[archetype] || archetype || 'Unknown';
}

function primaryScore(upload) {
  if (!upload?.archetype) return 0;
  const value = Number(upload.scores?.[upload.archetype]);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function topScoreKeys(upload) {
  return Object.entries(upload?.scores || {})
    .filter(([key]) => !key.startsWith('_') && ARCHETYPE_LABELS[key])
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 3)
    .map(([key]) => key);
}

function ownerOnly(value, isOwner) {
  return isOwner ? value || null : undefined;
}

function cleanEvolution(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export function profileEvolution(uploads = [], { isOwner = true } = {}) {
  const sorted = [...uploads]
    .filter((upload) => upload?.archetype)
    .sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
  const latest = sorted[0];
  const previous = sorted[1];
  if (!latest || !previous) return null;

  const latestScore = primaryScore(latest);
  const previousScore = previous.archetype === latest.archetype
    ? primaryScore(previous)
    : Number(previous.scores?.[latest.archetype] || 0);
  const delta = latestScore - Math.round(Number(previousScore) || 0);
  const previousTop = new Set(topScoreKeys(previous));
  const newTopSignal = topScoreKeys(latest).find((key) => !previousTop.has(key));

  if (latest.archetype !== previous.archetype) {
    return cleanEvolution({
      type: 'archetype-shift',
      label: `${labelFor(previous.archetype)} -> ${labelFor(latest.archetype)} shift`,
      detail: `${latestScore}% ${labelFor(latest.archetype)} signal now`,
      delta,
      previous_archetype: previous.archetype,
      current_archetype: latest.archetype,
      previous_uploaded_at: ownerOnly(previous.uploaded_at, isOwner),
    });
  }

  if (delta !== 0) {
    return cleanEvolution({
      type: delta > 0 ? 'score-gain' : 'score-drop',
      label: `${delta > 0 ? '+' : ''}${delta} ${labelFor(latest.archetype)} points`,
      detail: 'vs last upload',
      delta,
      current_archetype: latest.archetype,
      previous_uploaded_at: ownerOnly(previous.uploaded_at, isOwner),
    });
  }

  if (newTopSignal) {
    return cleanEvolution({
      type: 'new-top-signal',
      label: `new top-3 ${labelFor(newTopSignal)} signal`,
      detail: 'combo changed since last upload',
      delta: 0,
      current_archetype: latest.archetype,
      new_signal: newTopSignal,
      previous_uploaded_at: ownerOnly(previous.uploaded_at, isOwner),
    });
  }

  return cleanEvolution({
    type: 'steady',
    label: `steady ${labelFor(latest.archetype)} signal`,
    detail: `${latestScore}% across last upload`,
    delta: 0,
    current_archetype: latest.archetype,
    previous_uploaded_at: ownerOnly(previous.uploaded_at, isOwner),
  });
}
