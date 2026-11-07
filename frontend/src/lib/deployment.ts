type Environment = Record<string, string | undefined>;

function absoluteUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${name} must be an HTTP(S) URL without credentials, query or fragment.`,
    );
  }
  return url;
}

export function backendUrl(
  environment: Environment = process.env,
): string | undefined {
  const configured = environment.BACKEND_URL?.trim();
  if (!configured) return undefined;
  const url = absoluteUrl(configured, "BACKEND_URL");
  if (
    environment.VERCEL === "1" &&
    (url.protocol !== "https:" ||
      /^(localhost|.*\.localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\])$/i.test(
        url.hostname,
      ))
  ) {
    throw new Error(
      "BACKEND_URL on Vercel must point to a public HTTPS backend.",
    );
  }
  return url.href.replace(/\/+$/, "");
}

export function siteOrigin(
  environment: Environment = process.env,
): URL | undefined {
  const configured = environment.SITE_URL?.trim();
  const platformHost = environment.VERCEL_URL?.trim();
  const value =
    configured || (platformHost ? `https://${platformHost}` : undefined);
  if (!value) return undefined;
  const url = absoluteUrl(value, "SITE_URL");
  if (url.pathname !== "/")
    throw new Error("SITE_URL must be an origin without a path.");
  if (environment.VERCEL === "1" && url.protocol !== "https:") {
    throw new Error("SITE_URL on Vercel must use HTTPS.");
  }
  return url;
}
