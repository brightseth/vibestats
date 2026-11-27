export const PUBLIC_PROFILE_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600';
export const PRIVATE_PROFILE_CACHE = 'private, no-store';

export function profileShareCacheControl(user) {
  return user?.privacy === 'public'
    ? PUBLIC_PROFILE_CACHE
    : PRIVATE_PROFILE_CACHE;
}

export function sendPrivateNotFound(res, body = 'Not found') {
  res.setHeader('Cache-Control', PRIVATE_PROFILE_CACHE);
  return res.status(404).send(body);
}

export function sendPrivateMethodNotAllowed(res, allowed = ['GET'], body = 'Method not allowed') {
  res.setHeader('Allow', allowed.join(', '));
  res.setHeader('Cache-Control', PRIVATE_PROFILE_CACHE);
  return res.status(405).send(body);
}
