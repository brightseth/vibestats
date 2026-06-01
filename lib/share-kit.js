const RAW_LEAK_PATTERNS = ['rawJson', 'tool_usage', 'language_usage'];

function absoluteUrl(origin, path) {
  return new URL(path, `${origin}/`).toString();
}

function rawLeakProof(value) {
  const text = JSON.stringify(value || {});
  return !RAW_LEAK_PATTERNS.some((pattern) => text.includes(pattern));
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function xShareUrl(text, url) {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function latestUpload(profile) {
  return Array.isArray(profile?.uploads) ? profile.uploads[0] : null;
}

function terminalOnboarding(commands = {}) {
  return [
    commands.insights || '/insights',
    commands.status || '',
    commands.reveal || '',
    commands.claim || commands.sync || '',
    commands.install || '',
  ].filter(Boolean);
}

export function buildShareKit(profile, {
  origin = 'https://vibestats.io',
  handle = '',
  terminalCommands = {},
} = {}) {
  const ghHandle = handle || profile?.user?.gh_handle || '';
  const upload = latestUpload(profile);
  if (!ghHandle || !upload?.archetype) {
    throw new Error('Profile has no public saved upload yet.');
  }

  const signature = compact(upload.raw_meta?.signature) || upload.archetype;
  const rarity = profile?.rarity?.tier ? `${profile.rarity.tier} signature` : '';
  const sourceRef = `u:${ghHandle}`;
  const profileUrl = absoluteUrl(origin, `/u/${encodeURIComponent(ghHandle)}?ref=${encodeURIComponent(sourceRef)}`);
  const compareUrl = absoluteUrl(origin, `/?compareTo=${encodeURIComponent(ghHandle)}&compareArchetype=${encodeURIComponent(upload.archetype)}&ref=${encodeURIComponent(sourceRef)}`);
  const recapUrl = absoluteUrl(origin, `/u/${encodeURIComponent(ghHandle)}/recap`);
  const credentialUrl = absoluteUrl(origin, `/u/${encodeURIComponent(ghHandle)}/credential.json`);
  const badgeUrl = absoluteUrl(origin, `/u/${encodeURIComponent(ghHandle)}/badge.svg`);
  const embedUrl = absoluteUrl(origin, `/u/${encodeURIComponent(ghHandle)}/embed`);
  const leaderboardUrl = absoluteUrl(origin, `/leaderboard/${encodeURIComponent(upload.archetype)}`);
  const matchUrl = absoluteUrl(origin, `/match?goal=pair-coding&archetype=${encodeURIComponent(upload.archetype)}`);
  const badgeMarkdown = `[![vibestats: @${ghHandle}](${badgeUrl})](${compareUrl})`;
  const embedHtml = `<iframe src="${embedUrl}" width="600" height="320" loading="lazy" title="@${ghHandle} on vibestats" style="border:0;border-radius:8px;max-width:100%;"></iframe>`;
  const shareText = [
    `@${ghHandle} is ${signature} on vibestats`,
    rarity ? `(${rarity})` : '',
    `Raw /insights stayed local. What are you? ${compareUrl}`,
  ].filter(Boolean).join(' ');
  const xText = `@${ghHandle} is ${signature} on vibestats. Raw /insights stayed local. What are you?`;

  return {
    handle: ghHandle,
    archetype: upload.archetype,
    signature,
    rarity: profile?.rarity || null,
    privacy_proof: {
      raw_insights_stays_local: true,
      public_payload_has_no_raw_usage_fields: rawLeakProof(profile),
      profile_is_gitHub_claimed: true,
      public_metrics_are_coarse: true,
    },
    urls: {
      profile: profileUrl,
      compare: compareUrl,
      recap: recapUrl,
      credential: credentialUrl,
      badge: badgeUrl,
      embed: embedUrl,
      leaderboard: leaderboardUrl,
      match: matchUrl,
    },
    copy: {
      share_text: shareText,
      x_share_url: xShareUrl(xText, compareUrl),
      readme_badge_markdown: badgeMarkdown,
      embed_html: embedHtml,
      terminal_onboarding: terminalOnboarding(terminalCommands),
    },
  };
}

export function shareKitText(kit) {
  return [
    `vibestats share kit: @${kit.handle}`,
    `Profile: ${kit.urls.profile}`,
    `Compare invite: ${kit.urls.compare}`,
    `Recap: ${kit.urls.recap}`,
    `Credential: ${kit.urls.credential}`,
    `Leaderboard: ${kit.urls.leaderboard}`,
    `Matchmaker: ${kit.urls.match}`,
    '',
    `Copy/paste: ${kit.copy.share_text}`,
    `Share on X: ${kit.copy.x_share_url}`,
    `README badge: ${kit.copy.readme_badge_markdown}`,
    `Embed: ${kit.copy.embed_html}`,
    '',
    'Terminal onboarding:',
    ...kit.copy.terminal_onboarding.map((line, index) => `${index + 1}. ${line}`),
    '',
    `Privacy proof: raw /insights stays local; public payload has no raw usage fields: ${kit.privacy_proof.public_payload_has_no_raw_usage_fields ? 'yes' : 'no'}`,
  ].join('\n');
}

export async function fetchProfile({ origin, handle, fetchImpl = fetch } = {}) {
  const url = absoluteUrl(origin, `/api/u/${encodeURIComponent(handle)}`);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    const reason = err?.cause?.message || err?.message || 'unknown network error';
    throw new Error(`Profile fetch failed for ${url}: ${reason}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Profile fetch failed for ${url} with HTTP ${response.status}`);
  }
  return body;
}
