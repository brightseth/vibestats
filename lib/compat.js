(function attachVibeCompat(global) {
  const PAIRINGS = {
    'architect:architect': { name: 'Analysis Paralysis', dynamic: 'The plans are immaculate. The diagrams are beautiful. The code? Still pending review.', chemistry: 2, vibe: 'Overthinking in stereo' },
    'builder:builder': { name: 'Makers Gonna Make', dynamic: 'Pure creation energy. Everything is a greenfield project. The world gains two new repos before lunch.', chemistry: 5, vibe: 'Double the output' },
    'debugger:debugger': { name: 'Crime Scene Unit', dynamic: 'No bug survives this pairing. The codebase has never been more investigated. New features might have to wait.', chemistry: 4, vibe: 'Nothing escapes' },
    'deepdiver:deepdiver': { name: 'The Abyss', dynamic: 'They went deep on Monday. It\'s Thursday. Someone should check on them. The code, however, is pristine.', chemistry: 4, vibe: 'Profound understanding' },
    'orchestrator:orchestrator': { name: 'Mission Control', dynamic: 'Two conductors, one orchestra. Parallel sessions everywhere. Just make sure someone actually writes the code.', chemistry: 3, vibe: 'Maximum coordination' },
    'polyglot:polyglot': { name: 'Tower of Babel', dynamic: 'Name a language. They both know it. Name another. Same. The stack is infinite and the type systems are arguing.', chemistry: 4, vibe: 'Every language covered' },
    'shipper:shipper': { name: 'Launch Party', dynamic: 'Nothing stays in draft. Git log is a blur. Production deploys happen before the PR description is written.', chemistry: 4, vibe: 'Relentless velocity' },
    'sprinter:sprinter': { name: 'Chaos Engines', dynamic: 'Fast. Faster. Fastest. The CI pipeline can\'t keep up. Hope the tests pass because nobody\'s slowing down.', chemistry: 3, vibe: 'Pure adrenaline' },
    'architect:builder': { name: 'Blueprints & Bricks', dynamic: 'One designs the system. The other builds it. Everything gets built right the first time. The rarest and most productive pairing.', chemistry: 5, vibe: 'Perfect complement' },
    'architect:debugger': { name: 'The Investigators', dynamic: 'One reads the code carefully. The other interrogates it. Bugs and bad architecture don\'t survive this pair.', chemistry: 4, vibe: 'Thorough analysis' },
    'architect:deepdiver': { name: 'The Scholars', dynamic: 'They don\'t just read code - they understand it. Deep thinking meets systematic planning. Slow but unbreakable.', chemistry: 4, vibe: 'Deep understanding' },
    'architect:orchestrator': { name: 'Grand Design', dynamic: 'Plans at scale. Every agent has a mission. Every session has a purpose. The architect designs, the orchestrator deploys.', chemistry: 4, vibe: 'Strategic execution' },
    'architect:polyglot': { name: 'System Polymath', dynamic: 'Architecture blueprints in every language. Beautiful system design that spans the entire tech stack.', chemistry: 3, vibe: 'Broad + deep' },
    'architect:shipper': { name: 'Plan vs Ship', dynamic: 'The eternal productive tension. "Is it ready?" "I already pushed." One ensures quality. The other ensures delivery.', chemistry: 3, vibe: 'Healthy tension' },
    'architect:sprinter': { name: 'Speed & Strategy', dynamic: 'Move fast with a map. Plans execute at lightspeed. The architect prevents the sprinter from running off a cliff.', chemistry: 4, vibe: 'Guided velocity' },
    'builder:debugger': { name: 'Create & Break', dynamic: 'Build, break, fix, repeat. The eternal cycle of all software. One makes things, the other makes sure they work.', chemistry: 3, vibe: 'The software cycle' },
    'builder:deepdiver': { name: 'The Craftsman', dynamic: 'Deep, deliberate creation. Things get built to last. No shortcuts, no hacks. Just solid, beautiful work.', chemistry: 5, vibe: 'Quality craftsmanship' },
    'builder:orchestrator': { name: 'The Forge', dynamic: 'Parallel creation streams at full capacity. One coordinates, the other creates. Maximum output, minimum waste.', chemistry: 4, vibe: 'Scaled creation' },
    'builder:polyglot': { name: 'Universal Creator', dynamic: 'Building things in every language imaginable. No tool is off-limits. The repo has more file extensions than most companies.', chemistry: 4, vibe: 'Boundless creation' },
    'builder:shipper': { name: 'Feature Factory', dynamic: 'One creates, both ship. The backlog doesn\'t stand a chance. Features go from idea to production at an alarming rate.', chemistry: 5, vibe: 'Pure production' },
    'builder:sprinter': { name: 'Rapid Prototyper', dynamic: 'Ideas become code before the coffee cools. Speed meets creation. The prototype is done before the meeting ends.', chemistry: 4, vibe: 'Instant creation' },
    'debugger:deepdiver': { name: 'Forensic Analysis', dynamic: 'When they investigate, they find EVERYTHING. Deep focus meets systematic search. The root cause doesn\'t stand a chance.', chemistry: 5, vibe: 'Total investigation' },
    'debugger:orchestrator': { name: 'Bug Command', dynamic: 'Bugs don\'t hide when you have eyes everywhere. Parallel debugging sessions, coordinated investigation. Systematic elimination.', chemistry: 4, vibe: 'Coordinated debugging' },
    'debugger:polyglot': { name: 'Bug Hunters International', dynamic: 'Bugs have nowhere to hide, in any language. Cross-stack debugging with polyglot precision. Nothing is safe.', chemistry: 4, vibe: 'Universal debugging' },
    'debugger:shipper': { name: 'Unstoppable', dynamic: 'One investigates, one ships. Problems get found and fixed at production speed. The most dangerous duo in software.', chemistry: 5, vibe: 'Find it, fix it, ship it' },
    'debugger:sprinter': { name: 'Rapid Response', dynamic: 'Fast debugging. Fix it before the user notices. The incident response team that every company wishes they had.', chemistry: 3, vibe: 'Quick fixes' },
    'deepdiver:orchestrator': { name: 'Wide & Deep', dynamic: 'One sees the whole board. The other sees through it. Coverage from every angle. Nothing is overlooked or oversimplified.', chemistry: 5, vibe: 'Complete coverage' },
    'deepdiver:polyglot': { name: 'Language Scholar', dynamic: 'Deep expertise across many domains. Not just knowing languages - truly understanding them. The senior devs\' senior dev.', chemistry: 4, vibe: 'Polymath depth' },
    'deepdiver:shipper': { name: 'Quality Shipping', dynamic: 'Deep work that actually ships. Rare and powerful. The code is thoughtful AND it\'s in production. Best of both worlds.', chemistry: 4, vibe: 'Depth + delivery' },
    'deepdiver:sprinter': { name: 'Opposite Poles', dynamic: 'One goes fast. The other goes deep. Productive if they find rhythm - explosive if they don\'t. A high-ceiling, low-floor pairing.', chemistry: 2, vibe: 'Creative tension' },
    'orchestrator:polyglot': { name: 'Universal Command', dynamic: 'Every language, every session, every terminal. The polyglot\'s breadth meets the orchestrator\'s scale. Multilingual parallelism.', chemistry: 3, vibe: 'Polyglot at scale' },
    'orchestrator:shipper': { name: 'Traffic Control', dynamic: 'One directs, one delivers. A well-oiled deployment machine. Shipping at scale with orchestrated precision.', chemistry: 4, vibe: 'Scaled shipping' },
    'orchestrator:sprinter': { name: 'Blitz Commander', dynamic: 'Fast and coordinated. The speed run of software development. Every parallel stream is a sprint.', chemistry: 4, vibe: 'Parallel sprints' },
    'polyglot:shipper': { name: 'World Tour', dynamic: 'Shipping across every language and framework. Global domination, one deploy at a time. The monorepo\'s dream team.', chemistry: 4, vibe: 'Ship everywhere' },
    'polyglot:sprinter': { name: 'World Sprint', dynamic: 'Fast in every language. Dangerously versatile. The hackathon team that wins every time, in every category.', chemistry: 3, vibe: 'Speed + breadth' },
    'shipper:sprinter': { name: 'Sonic Boom', dynamic: 'Pure velocity. Everything ships yesterday. The git log is measured in commits per minute. CI/CD was made for this pair.', chemistry: 4, vibe: 'Maximum velocity' },
  };

  const SHORT_NAMES = {
    orchestrator: 'Orchestrator',
    shipper: 'Shipper',
    architect: 'Architect',
    debugger: 'Debugger',
    polyglot: 'Polyglot',
    sprinter: 'Sprinter',
    deepdiver: 'Deep Diver',
    builder: 'Builder',
  };

  const STRENGTHS = {
    orchestrator: 'parallel execution',
    shipper: 'shipping velocity',
    architect: 'system design',
    debugger: 'investigation',
    polyglot: 'stack range',
    sprinter: 'raw speed',
    deepdiver: 'deep focus',
    builder: 'creation energy',
  };

  const FACET_DEFS = [
    { id: 'shipping_velocity', label: 'Shipping velocity', weights: { shipper: 0.55, sprinter: 0.3, builder: 0.15 } },
    { id: 'system_design', label: 'System design', weights: { architect: 0.5, orchestrator: 0.3, builder: 0.2 } },
    { id: 'debug_patience', label: 'Debug patience', weights: { debugger: 0.65, deepdiver: 0.25, architect: 0.1 } },
    { id: 'tool_orchestration', label: 'Tool orchestration', weights: { orchestrator: 0.65, polyglot: 0.2, shipper: 0.15 } },
    { id: 'stack_breadth', label: 'Stack breadth', weights: { polyglot: 0.65, builder: 0.2, architect: 0.15 } },
    { id: 'deep_focus', label: 'Deep focus', weights: { deepdiver: 0.65, architect: 0.2, debugger: 0.15 } },
    { id: 'build_energy', label: 'Build energy', weights: { builder: 0.5, shipper: 0.3, sprinter: 0.2 } },
  ];

  const FACET_COMPLEMENTS = {
    shipping_velocity: ['system_design', 'debug_patience'],
    system_design: ['shipping_velocity', 'build_energy'],
    debug_patience: ['shipping_velocity', 'build_energy'],
    tool_orchestration: ['deep_focus', 'stack_breadth'],
    stack_breadth: ['system_design', 'tool_orchestration'],
    deep_focus: ['tool_orchestration', 'shipping_velocity'],
    build_energy: ['system_design', 'debug_patience'],
  };

  function key(a, b) {
    return [a, b].sort().join(':');
  }

  function getPairing(a, b) {
    return PAIRINGS[key(a, b)] || {
      name: 'Unknown Pairing',
      dynamic: 'An unexplored combination.',
      chemistry: 3,
      vibe: 'Mysterious',
    };
  }

  function scoreFor(pairing, sameType) {
    if (sameType) return 76;
    if (pairing.chemistry >= 5) return 94;
    if (pairing.chemistry === 4) return 88;
    if (pairing.chemistry === 3) return 78;
    return 64;
  }

  function clampFacet(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function facetBaselineForArchetype(type) {
    if (!SHORT_NAMES[type]) return [];
    return FACET_DEFS.map((def) => ({
      id: def.id,
      label: def.label,
      value: clampFacet((def.weights[type] || 0) * 100),
    }));
  }

  function normalizedFacets(subject) {
    const explicit = Array.isArray(subject?.facets) ? subject.facets : [];
    const source = explicit.length ? explicit : facetBaselineForArchetype(subject?.type);
    const byId = new Map();
    for (const facet of source) {
      if (!facet?.id) continue;
      const def = FACET_DEFS.find((item) => item.id === facet.id);
      if (!def) continue;
      byId.set(def.id, {
        id: def.id,
        label: def.label,
        value: clampFacet(facet.value),
      });
    }
    return FACET_DEFS.map((def) => byId.get(def.id) || { id: def.id, label: def.label, value: 0 });
  }

  function topFacet(subject) {
    return normalizedFacets(subject)
      .sort((a, b) => b.value - a.value)[0] || null;
  }

  function hasExplicitFacets(subject) {
    return Array.isArray(subject?.facets) && subject.facets.length >= 3;
  }

  function facetComplement(topA, topB) {
    if (!topA?.id || !topB?.id) return false;
    return Boolean(
      FACET_COMPLEMENTS[topA.id]?.includes(topB.id)
      || FACET_COMPLEMENTS[topB.id]?.includes(topA.id),
    );
  }

  function facetCompatibility(aSubject = {}, bSubject = {}) {
    const aFacets = normalizedFacets(aSubject);
    const bFacets = normalizedFacets(bSubject);
    if (!aFacets.length || !bFacets.length) return null;

    const topA = topFacet(aSubject);
    const topB = topFacet(bSubject);
    const avgGap = aFacets.reduce((sum, facet, index) => sum + Math.abs(facet.value - bFacets[index].value), 0) / aFacets.length;
    const similarity = Math.max(0, Math.min(100, Math.round(100 - avgGap)));
    const complementary = facetComplement(topA, topB);
    const complement = topA?.id === topB?.id ? 70 : complementary ? 94 : 82;
    const score = Math.max(55, Math.min(99, Math.round(similarity * 0.38 + complement * 0.62)));
    const aLabel = topA?.label || 'profile shape';
    const bLabel = topB?.label || 'profile shape';
    const line = topA?.id === topB?.id
      ? `Facet read: both profiles lead with ${aLabel.toLowerCase()}, so the fit is high-alignment more than complementary.`
      : complementary
        ? `Facet read: ${aLabel} pairs cleanly with ${bLabel.toLowerCase()}, giving this match a practical push-pull.`
        : `Facet read: ${aLabel} meets ${bLabel.toLowerCase()}, so the pairing has a distinct working-style shape.`;

    return {
      score,
      similarity,
      complement,
      top_a: topA,
      top_b: topB,
      line,
    };
  }

  function profileCompatibility(visitorType, hostType, hostHandle, visitorSubject = null, hostSubject = null) {
    const pairing = getPairing(visitorType, hostType);
    const baseScore = scoreFor(pairing, visitorType === hostType);
    const facet = hasExplicitFacets(visitorSubject) || hasExplicitFacets(hostSubject)
      ? facetCompatibility({ type: visitorType, ...(visitorSubject || {}) }, { type: hostType, ...(hostSubject || {}) })
      : null;
    const score = facet ? Math.max(55, Math.min(99, Math.round(baseScore * 0.58 + facet.score * 0.42))) : baseScore;

    if (visitorType === hostType) {
      const short = SHORT_NAMES[hostType] || hostType;
      return {
        score,
        line: `You are both ${short}s. Expect strong shared instincts, plus a need to divide roles clearly.${facet ? ` ${facet.line}` : ''}`,
        facet,
      };
    }

    if (pairing.name !== 'Unknown Pairing') {
      return {
        score,
        line: `${pairing.dynamic}${facet ? ` ${facet.line}` : ''}`,
        facet,
      };
    }

    const visitorStrength = STRENGTHS[visitorType] || 'momentum';
    const hostStrength = STRENGTHS[hostType] || 'judgment';
    return {
      score,
      line: `You bring ${visitorStrength}; @${hostHandle} brings ${hostStrength}. This is a complementary Claude Code pair.${facet ? ` ${facet.line}` : ''}`,
      facet,
    };
  }

  global.VibeCompat = {
    key,
    getPairing,
    facetCompatibility,
    profileCompatibility,
    pairings: PAIRINGS,
  };
})(window);
