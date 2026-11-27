export const SSH_SHELL_SCHEMA = 'vibestats.ssh_shell.v1';
export const DEFAULT_SSH_HOST = 'ssh.vibestats.io';

function normalizedOrigin(origin = 'https://vibestats.io') {
  return String(origin || 'https://vibestats.io').replace(/\/$/, '');
}

function sshHost() {
  return String(process.env.VIBESTATS_SSH_HOST || DEFAULT_SSH_HOST).trim() || DEFAULT_SSH_HOST;
}

export function buildSshShellManifest(origin) {
  const base = normalizedOrigin(origin);
  const host = sshHost();

  return {
    schema_version: SSH_SHELL_SCHEMA,
    purpose: 'No-install terminal social shell and claim coordinator for Claude Code users.',
    status: {
      ssh_service: process.env.VIBESTATS_SSH_SERVICE_READY === '1' ? 'ready' : 'external_tcp_service_required',
      claim_api: 'ready',
      local_helper: 'ready',
      hosted_on_vercel_functions: false,
    },
    ssh: {
      host,
      command: `ssh ${host}`,
      apex_command_supported: false,
      transport: 'dedicated TCP SSH service, separate from Vercel HTTP functions',
    },
    privacy: {
      ssh_host_reads_local_files: false,
      extraction_boundary: 'local-helper-only',
      local_helper_uploads: 'derived-only',
      raw_claude_code_sessions: 'local-only',
      forbidden_inputs: [
        'session metadata JSON',
        'facet JSON',
        'Claude Code report HTML',
        'prompts',
        'session summaries',
        'project paths',
        'session identifiers',
        'raw tool-count maps',
        'raw language-count maps',
        'credentials or API keys',
      ],
    },
    commands: [
      { name: 'help', description: 'Show the terminal menu and privacy boundary.' },
      { name: 'view HANDLE', description: 'Open a public profile and compare-first reveal CTA.' },
      { name: 'leaderboard ARCHETYPE', description: 'Browse rarity and weekly board placement.' },
      { name: 'match GOAL', description: 'Browse goal-driven coding-agent pair suggestions.' },
      { name: 'compare A B', description: 'Preview archetype compatibility without publishing.' },
      { name: 'share HANDLE', description: 'Print badge, embed, credential, and copy-ready launch kit.' },
      { name: 'claim', description: 'Create a short-lived claim code for the local helper.' },
    ],
    api: {
      profile: `${base}/api/u/{handle}`,
      credential: `${base}/u/{handle}/credential.json`,
      browse: `${base}/api/browse`,
      match: `${base}/api/match`,
      leaderboard: `${base}/api/leaderboard`,
      match_intro_events: `${base}/api/match-intros`,
      claim_start: `${base}/api/ssh/claim-start`,
      claim_status: `${base}/api/ssh/claim-status?code={code}`,
      bootstrap: `${base}/cli.sh`,
    },
    claim_flow: {
      ttl_seconds: 10 * 60,
      code_shape: 'VIBE-XXXX-XXXX',
      local_command_template: `curl -fsSL '${base}/cli.sh' | sh -s -- claim '{code}' --host '${base}'`,
      steps: [
        'Run /insights locally in Claude Code.',
        'Start claim from the SSH shell.',
        'Run the printed local helper command on the user machine.',
        'Reveal locally before publish consent.',
        'Approve GitHub identity.',
        'Post only derived metrics plus the claim code.',
        'Refresh the SSH shell with profile, credential, compare link, badge, and match intent prompts.',
      ],
    },
    viral_loops: [
      'profile_url',
      'credential_url',
      'compare_invite',
      'rarity_leaderboard',
      'goal_matchmaker',
      'readme_badge',
      'embed_card',
      'terminal_share_kit',
    ],
  };
}
