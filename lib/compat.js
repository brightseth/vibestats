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

  function profileCompatibility(visitorType, hostType, hostHandle) {
    if (visitorType === hostType) {
      const short = SHORT_NAMES[hostType] || hostType;
      return {
        score: 76,
        line: `You are both ${short}s. Expect strong shared instincts, plus a need to divide roles clearly.`,
      };
    }

    const pairing = getPairing(visitorType, hostType);
    if (pairing.name !== 'Unknown Pairing') {
      return {
        score: scoreFor(pairing, false),
        line: pairing.dynamic,
      };
    }

    const visitorStrength = STRENGTHS[visitorType] || 'momentum';
    const hostStrength = STRENGTHS[hostType] || 'judgment';
    return {
      score: 78,
      line: `You bring ${visitorStrength}; @${hostHandle} brings ${hostStrength}. This is a complementary Claude Code pair.`,
    };
  }

  global.VibeCompat = {
    key,
    getPairing,
    profileCompatibility,
    pairings: PAIRINGS,
  };
})(window);
