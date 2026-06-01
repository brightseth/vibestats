export function profileLinks(user, archetype) {
  const handle = encodeURIComponent(user?.gh_handle || '');
  const type = encodeURIComponent(archetype || '');
  const ref = encodeURIComponent(`u:${user?.gh_handle || ''}`);
  return {
    profile_url: `/u/${handle}?ref=${ref}`,
    compare_url: `/?compareTo=${handle}&compareArchetype=${type}&ref=${ref}`,
    recap_url: `/u/${handle}/recap`,
    credential_url: `/u/${handle}/credential.json`,
    badge_url: `/u/${handle}/badge.svg`,
    embed_url: `/u/${handle}/embed`,
    settings_url: '/settings',
    privacy_url: '/settings#privacy-settings',
    match_settings_url: '/settings#match-settings',
    weekly_digest_url: '/settings#weekly-digest-row',
    weekly_digest_preview_url: '/api/digest/preview',
    leaderboard_url: `/leaderboard/${type}`,
    match_url: `/match?goal=pair-coding&archetype=${type}`,
  };
}
