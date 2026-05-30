export function profileLinks(user, archetype) {
  const handle = encodeURIComponent(user?.gh_handle || '');
  const type = encodeURIComponent(archetype || '');
  return {
    profile_url: `/u/${handle}`,
    compare_url: `/?compareTo=${handle}&compareArchetype=${type}`,
    recap_url: `/u/${handle}/recap`,
    badge_url: `/u/${handle}/badge.svg`,
    embed_url: `/u/${handle}/embed`,
    settings_url: '/settings',
    privacy_url: '/settings#privacy-settings',
    match_settings_url: '/settings#match-settings',
    weekly_digest_url: '/settings#weekly-digest-row',
    leaderboard_url: `/leaderboard/${type}`,
    match_url: `/match?goal=pair-coding&archetype=${type}`,
  };
}
