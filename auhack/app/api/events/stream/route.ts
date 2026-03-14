import { NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "https://d825-185-45-22-133.ngrok-free.app";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getUpstreamBaseUrl(): string {
  const fromServerEnv = process.env.API_BASE_URL?.trim();
  if (fromServerEnv) {
    return trimTrailingSlash(fromServerEnv);
  }

  const fromPublicEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromPublicEnv) {
    return trimTrailingSlash(fromPublicEnv);
  }

  return DEFAULT_API_BASE_URL;
}

export async function GET() {
  const upstreamUrl = `${getUpstreamBaseUrl()}/events/stream`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      Accept: "text/event-stream",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text();
    return NextResponse.json(
      {
        error: "Unable to connect to upstream event stream",
        details: message || `Upstream responded with status ${upstream.status}`,
      },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
