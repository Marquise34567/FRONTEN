import { useEffect, useMemo, useState } from "react";
import { Globe2, RefreshCw } from "lucide-react";

export type LiveGeoHeatmapPoint = {
  country: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sessions: number;
  users: number;
};

type LiveUsersGlobeProps = {
  points: LiveGeoHeatmapPoint[];
  activeUsers: number;
  updatedAt?: string | null;
};

const DEG_TO_RAD = Math.PI / 180;
const GLOBE_RADIUS_PCT = 41;

const COUNTRY_COORDINATE_FALLBACK: Record<string, { lat: number; lon: number }> = {
  us: { lat: 39.8, lon: -98.6 },
  usa: { lat: 39.8, lon: -98.6 },
  "united states": { lat: 39.8, lon: -98.6 },
  ca: { lat: 56.1, lon: -106.3 },
  canada: { lat: 56.1, lon: -106.3 },
  gb: { lat: 55.4, lon: -3.4 },
  uk: { lat: 55.4, lon: -3.4 },
  "united kingdom": { lat: 55.4, lon: -3.4 },
  de: { lat: 51.2, lon: 10.4 },
  germany: { lat: 51.2, lon: 10.4 },
  fr: { lat: 46.2, lon: 2.2 },
  france: { lat: 46.2, lon: 2.2 },
  in: { lat: 20.6, lon: 78.9 },
  india: { lat: 20.6, lon: 78.9 },
  br: { lat: -14.2, lon: -51.9 },
  brazil: { lat: -14.2, lon: -51.9 },
  au: { lat: -25.3, lon: 133.8 },
  australia: { lat: -25.3, lon: 133.8 },
  jp: { lat: 36.2, lon: 138.2 },
  japan: { lat: 36.2, lon: 138.2 },
  mx: { lat: 23.6, lon: -102.5 },
  mexico: { lat: 23.6, lon: -102.5 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeCountryKey = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const LiveUsersGlobe = ({ points, activeUsers, updatedAt }: LiveUsersGlobeProps) => {
  const [rotationDeg, setRotationDeg] = useState(0);
  const [secondsTick, setSecondsTick] = useState(0);

  useEffect(() => {
    const rotationHandle = window.setInterval(() => {
      setRotationDeg((prev) => (prev + 0.9) % 360);
    }, 32);

    const secondsHandle = window.setInterval(() => {
      setSecondsTick((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(rotationHandle);
      window.clearInterval(secondsHandle);
    };
  }, []);

  const normalizedPoints = useMemo(() => {
    return points
      .map((row) => {
        const fallback = COUNTRY_COORDINATE_FALLBACK[normalizeCountryKey(row.country)];
        const latitude =
          typeof row.latitude === "number" && Number.isFinite(row.latitude)
            ? clamp(row.latitude, -89, 89)
            : fallback?.lat ?? null;
        const longitude =
          typeof row.longitude === "number" && Number.isFinite(row.longitude)
            ? clamp(row.longitude, -180, 180)
            : fallback?.lon ?? null;

        if (latitude === null || longitude === null) return null;
        return {
          ...row,
          latitude,
          longitude,
          sessions: Math.max(0, Number(row.sessions || 0)),
          users: Math.max(0, Number(row.users || 0)),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 40);
  }, [points]);

  const projectedPoints = useMemo(() => {
    return normalizedPoints
      .map((row, index) => {
        const latRad = row.latitude * DEG_TO_RAD;
        const lonRad = (row.longitude + rotationDeg) * DEG_TO_RAD;
        const cosLat = Math.cos(latRad);
        const sinLat = Math.sin(latRad);
        const x = cosLat * Math.sin(lonRad);
        const y = sinLat;
        const z = cosLat * Math.cos(lonRad);
        const depth = (z + 1) / 2;
        const opacity = depth > 0.06 ? 0.15 + depth * 0.85 : 0;
        if (opacity <= 0.08) return null;

        const size = 1.8 + Math.min(5, Math.log1p(row.sessions) * 1.35);
        return {
          ...row,
          index,
          x: 50 + x * GLOBE_RADIUS_PCT,
          y: 50 - y * GLOBE_RADIUS_PCT,
          z,
          size,
          glow: size * 2.5,
          opacity,
          depth,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.z - b.z);
  }, [normalizedPoints, rotationDeg]);

  const updatedMs = parseTimestamp(updatedAt);
  const secondsSinceUpdate = useMemo(() => {
    if (updatedMs === null) return null;
    return Math.max(0, Math.floor((Date.now() - updatedMs) / 1000));
  }, [updatedMs, secondsTick]);

  const countryCount = useMemo(
    () => new Set(normalizedPoints.map((row) => normalizeCountryKey(row.country) || "unknown")).size,
    [normalizedPoints]
  );
  const trackedSessions = useMemo(
    () => normalizedPoints.reduce((sum, row) => sum + Math.max(0, row.sessions), 0),
    [normalizedPoints]
  );

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-card/45 p-4 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.55)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-cyan-200">
            <Globe2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Live World Presence</p>
            <p className="text-[11px] text-muted-foreground">Country map refreshes every second</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-200">
          <RefreshCw className="h-3.5 w-3.5 animate-live-gear-spin" />
          {secondsSinceUpdate === null ? "Syncing..." : `${secondsSinceUpdate}s ago`}
        </div>
      </div>

      <div className="live-globe-shell mx-auto">
        <div className="live-globe-frame">
          <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Live active user globe">
            <defs>
              <radialGradient id="liveGlobeFill" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(196 92% 63% / 0.95)" />
                <stop offset="46%" stopColor="hsl(232 78% 30% / 0.84)" />
                <stop offset="100%" stopColor="hsl(242 70% 12% / 0.96)" />
              </radialGradient>
              <radialGradient id="liveGlobeShade" cx="80%" cy="45%" r="65%">
                <stop offset="0%" stopColor="hsl(228 44% 10% / 0.12)" />
                <stop offset="75%" stopColor="hsl(228 44% 10% / 0.65)" />
                <stop offset="100%" stopColor="hsl(228 44% 10% / 0.88)" />
              </radialGradient>
              <filter id="liveGlobeDotGlow" x="-200%" y="-200%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx="50" cy="50" r={GLOBE_RADIUS_PCT} fill="url(#liveGlobeFill)" />
            <circle
              className="live-globe-orbit-track"
              cx="50"
              cy="50"
              r={GLOBE_RADIUS_PCT - 3}
              fill="none"
              stroke="hsl(196 94% 69% / 0.35)"
              strokeDasharray="1.5 2.6"
              strokeWidth="0.35"
            />
            <path
              d="M8 50C22 20 78 20 92 50C78 80 22 80 8 50Z"
              fill="none"
              stroke="hsl(196 94% 69% / 0.25)"
              strokeDasharray="2.2 2.8"
              strokeWidth="0.5"
              className="live-globe-orbit-track-alt"
            />
            <path
              d="M20 13C40 24 60 76 80 87"
              fill="none"
              stroke="hsl(216 94% 72% / 0.28)"
              strokeDasharray="2 2.8"
              strokeWidth="0.4"
              className="live-globe-orbit-track"
            />

            {projectedPoints.map((row) => (
              <g key={`${row.country || "unknown"}-${row.city || "city"}-${row.index}`} style={{ opacity: row.opacity }}>
                <circle
                  cx={row.x}
                  cy={row.y}
                  r={row.glow}
                  fill="hsl(186 100% 64% / 0.22)"
                  className="live-globe-point-pulse"
                  style={{ animationDelay: `${(row.index % 10) * 0.15}s` }}
                />
                <circle
                  cx={row.x}
                  cy={row.y}
                  r={row.size}
                  fill="hsl(178 100% 84% / 0.95)"
                  stroke="hsl(199 96% 66% / 0.95)"
                  strokeWidth="0.35"
                  filter="url(#liveGlobeDotGlow)"
                >
                  <title>
                    {(row.country || "Unknown") + ` - ${row.sessions} sessions, ${row.users} users`}
                  </title>
                </circle>
              </g>
            ))}

            <circle cx="50" cy="50" r={GLOBE_RADIUS_PCT} fill="url(#liveGlobeShade)" />
            <circle
              cx="50"
              cy="50"
              r={GLOBE_RADIUS_PCT}
              fill="none"
              stroke="hsl(196 93% 72% / 0.45)"
              strokeWidth="0.55"
            />
          </svg>
          <div className="live-globe-ring live-globe-ring-primary" />
          <div className="live-globe-ring live-globe-ring-secondary" />
          <div className="live-globe-scan" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Active Users</p>
          <p className="text-base font-semibold text-cyan-100">{activeUsers}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Countries</p>
          <p className="text-base font-semibold text-cyan-100">{countryCount}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Tracked Sessions</p>
          <p className="text-base font-semibold text-cyan-100">{trackedSessions}</p>
        </div>
      </div>
    </div>
  );
};

export default LiveUsersGlobe;
