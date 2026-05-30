export function profileLinks(user, archetype) {
  const handle = encodeURIComponent(user?.gh_handle || '');
  const type = encodeURIComponent(archetype || '');
  return {
    profile_url: `/u/${handle}`,
    compare_url: `/?compareTo=${handle}&compareArchetype=${type}`,
    recap_url: `/u/${handle}/recap`,
    badge_url: `/u/${handle}/badge.svg`,
    embed_url: `/u/${handle}/embed`,
  };
}
