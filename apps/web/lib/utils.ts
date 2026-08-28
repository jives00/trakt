import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// External clients (Sonarr/Radarr/Emby containers, Android TV) can't resolve LAN
// hostnames like `synology`, so URLs we hand them use the LAN IP, not the origin.
const LAN_HOST = process.env.NEXT_PUBLIC_LAN_HOST ?? "192.168.0.105";

export function externalOrigin(fallback = "http://localhost:3001") {
  if (typeof window === "undefined") return fallback;
  const { protocol, hostname, port, origin } = window.location;
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname) || hostname.includes(":")) return origin;
  return `${protocol}//${LAN_HOST}${port ? `:${port}` : ""}`;
}
