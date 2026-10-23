// GitHub release helpers — create a release and upload .exe assets.
// Uses REST API directly via fetch (no Octokit runtime dep needed for upload).

const GH_API = "https://api.github.com";
const GH_UPLOADS = "https://uploads.github.com";

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}

export function getGithubConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    throw new Error(
      "Faltan variables de entorno GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO"
    );
  }
  return { token, owner, repo };
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function createRelease(opts: {
  cfg: GithubConfig;
  tag: string;
  name: string;
  body: string;
}): Promise<{ id: number; htmlUrl: string; uploadUrl: string }> {
  const { cfg, tag, name, body } = opts;
  const res = await fetch(
    `${GH_API}/repos/${cfg.owner}/${cfg.repo}/releases`,
    {
      method: "POST",
      headers: {
        ...authHeaders(cfg.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag_name: tag,
        name,
        body,
        draft: false,
        prerelease: false,
        make_latest: "true",
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub createRelease failed ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    htmlUrl: data.html_url,
    uploadUrl: data.upload_url,
  };
}

export async function deleteRelease(opts: {
  cfg: GithubConfig;
  releaseId: number;
  tag: string;
}): Promise<void> {
  const { cfg, releaseId, tag } = opts;
  // Delete release (does not delete tag)
  await fetch(
    `${GH_API}/repos/${cfg.owner}/${cfg.repo}/releases/${releaseId}`,
    { method: "DELETE", headers: authHeaders(cfg.token) }
  );
  // Delete tag
  await fetch(
    `${GH_API}/repos/${cfg.owner}/${cfg.repo}/git/refs/tags/${tag}`,
    { method: "DELETE", headers: authHeaders(cfg.token) }
  );
}

export async function getReleaseByTag(opts: {
  cfg: GithubConfig;
  tag: string;
}): Promise<{ id: number; htmlUrl: string } | null> {
  const { cfg, tag } = opts;
  const res = await fetch(
    `${GH_API}/repos/${cfg.owner}/${cfg.repo}/releases/tags/${tag}`,
    { headers: authHeaders(cfg.token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub getReleaseByTag failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return { id: data.id, htmlUrl: data.html_url };
}

export async function uploadAsset(opts: {
  cfg: GithubConfig;
  releaseId: number;
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const { cfg, releaseId, filename, data, contentType } = opts;
  const url = new URL(
    `${GH_UPLOADS}/repos/${cfg.owner}/${cfg.repo}/releases/${releaseId}/assets`
  );
  url.searchParams.set("name", filename);
  url.searchParams.set("label", filename);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(cfg.token),
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
    },
    body: data,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub uploadAsset failed ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return json.browser_download_url as string;
}

export function tagFromVersion(version: string): string {
  // "1.2.3" -> "v1.2.3"
  return version.startsWith("v") ? version : `v${version}`;
}

export function assetUrlFor(opts: {
  owner: string;
  repo: string;
  tag: string;
  filename: string;
}): string {
  const tag = tagFromVersion(opts.tag);
  return `https://github.com/${opts.owner}/${opts.repo}/releases/download/${tag}/${opts.filename}`;
}
