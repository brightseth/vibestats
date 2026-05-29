export const PUBLIC_PROFILE_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600';
export const PRIVATE_PROFILE_CACHE = 'private, no-store';

export function profileShareCacheControl(user) {
  return user?.privacy === 'public'
    ? PUBLIC_PROFILE_CACHE
    : PRIVATE_PROFILE_CACHE;
}
