export const FACET_DEFS = [
  {
    id: 'shipping_velocity',
    label: 'Shipping velocity',
    detail: 'Bias toward finishing and fast iteration',
    weights: { shipper: 0.55, sprinter: 0.3, builder: 0.15 },
  },
  {
    id: 'system_design',
    label: 'System design',
    detail: 'Architecture, planning, and structural taste',
    weights: { architect: 0.5, orchestrator: 0.3, builder: 0.2 },
  },
  {
    id: 'debug_patience',
    label: 'Debug patience',
    detail: 'Willingness to investigate before guessing',
    weights: { debugger: 0.65, deepdiver: 0.25, architect: 0.1 },
  },
  {
    id: 'tool_orchestration',
    label: 'Tool orchestration',
    detail: 'Comfort coordinating agents, commands, and workflows',
    weights: { orchestrator: 0.65, polyglot: 0.2, shipper: 0.15 },
  },
  {
    id: 'stack_breadth',
    label: 'Stack breadth',
    detail: 'Range across languages and implementation surfaces',
    weights: { polyglot: 0.65, builder: 0.2, architect: 0.15 },
  },
  {
    id: 'deep_focus',
    label: 'Deep focus',
    detail: 'Long-session depth and careful exploration',
    weights: { deepdiver: 0.65, architect: 0.2, debugger: 0.15 },
  },
  {
    id: 'build_energy',
    label: 'Build energy',
    detail: 'Tendency to create, wire, and move product forward',
    weights: { builder: 0.5, shipper: 0.3, sprinter: 0.2 },
  },
];

function boundedScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n), 0), 100);
}

export function publicFacetRadar(scores = {}) {
  return FACET_DEFS.map((def) => {
    const value = Object.entries(def.weights).reduce((sum, [key, weight]) => (
      sum + boundedScore(scores?.[key]) * weight
    ), 0);
    return {
      id: def.id,
      label: def.label,
      value: Math.min(Math.max(Math.round(value), 0), 100),
      detail: def.detail,
    };
  });
}
