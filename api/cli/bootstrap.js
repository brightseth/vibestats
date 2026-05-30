import { NO_STORE_HEADERS, methodNotAllowed, setNoStore } from '../_lib/http.js';

const DEFAULT_REPO = 'brightseth/vibestats';
const DEFAULT_REF = 'feat/wave-1-identity';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function githubTarballUrl() {
  const repo = process.env.VIBESTATS_BOOTSTRAP_REPO || DEFAULT_REPO;
  const ref = process.env.VIBESTATS_BOOTSTRAP_REF || DEFAULT_REF;
  const explicit = process.env.VIBESTATS_BOOTSTRAP_TARBALL_URL;
  if (explicit) return explicit;
  return `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
}

function bootstrapScript() {
  const tarballUrl = shellQuote(githubTarballUrl());
  return `#!/bin/sh
set -eu

tarball_url=${tarballUrl}
tmp_dir="$(mktemp -d "\${TMPDIR:-/tmp}/vibestats.XXXXXX")"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

if ! command -v node >/dev/null 2>&1; then
  echo "vibestats needs Node.js 20+ to read Claude Code /insights locally." >&2
  echo "Install Node, then rerun this command. Raw /insights data has not left this machine." >&2
  exit 1
fi

if ! node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 20 ? 0 : 1)' >/dev/null 2>&1; then
  echo "vibestats needs Node.js 20+. Raw /insights data has not left this machine." >&2
  exit 1
fi

archive="$tmp_dir/vibestats.tgz"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$tarball_url" -o "$archive"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$archive" "$tarball_url"
else
  echo "vibestats needs curl or wget to fetch the local helper." >&2
  echo "Raw /insights data has not left this machine." >&2
  exit 1
fi

tar -xzf "$archive" -C "$tmp_dir"
run_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$run_dir" ] || [ ! -f "$run_dir/bin/vibestats.js" ]; then
  echo "Could not unpack the vibestats helper." >&2
  echo "Raw /insights data has not left this machine." >&2
  exit 1
fi

if [ -r /dev/tty ]; then
  node "$run_dir/bin/vibestats.js" "$@" < /dev/tty
else
  node "$run_dir/bin/vibestats.js" "$@"
fi
`;
}

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  setNoStore(res);
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  return res.status(200).send(bootstrapScript());
}

export { bootstrapScript, githubTarballUrl };
