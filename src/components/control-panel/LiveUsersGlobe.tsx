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

const LANDMASS_SEEDS: Array<{ lat: number; lon: number; size?: number }> = [
  { lat: 72, lon: -150, size: 0.9 },
  { lat: 62, lon: -140 }, { lat: 55, lon: -130 }, { lat: 48, lon: -124 },
  { lat: 44, lon: -117 }, { lat: 40, lon: -109 }, { lat: 34, lon: -102 },
  { lat: 30, lon: -96 }, { lat: 40, lon: -92 }, { lat: 49, lon: -87 },
  { lat: 54, lon: -78 }, { lat: 48, lon: -70 }, { lat: 40, lon: -75 },
  { lat: 30, lon: -82 }, { lat: 22, lon: -90 }, { lat: 16, lon: -88 },
  { lat: 12, lon: -80 }, { lat: 4, lon: -79 }, { lat: -6, lon: -76 },
  { lat: -14, lon: -72 }, { lat: -22, lon: -69 }, { lat: -30, lon: -65 },
  { lat: -40, lon: -64 }, { lat: -50, lon: -68 }, { lat: -32, lon: -57 },
  { lat: -18, lon: -54 }, { lat: -8, lon: -49 }, { lat: 3, lon: -51 },
  { lat: 74, lon: -42 }, { lat: 68, lon: -35 }, { lat: 64, lon: -46 },
  { lat: 59, lon: -7 }, { lat: 54, lon: 2 }, { lat: 50, lon: 10 },
  { lat: 49, lon: 20 }, { lat: 54, lon: 30 }, { lat: 58, lon: 42 },
  { lat: 52, lon: 58 }, { lat: 45, lon: 40 }, { lat: 40, lon: 25 },
  { lat: 36, lon: 13 }, { lat: 32, lon: 0 }, { lat: 26, lon: 10 },
  { lat: 22, lon: 20 }, { lat: 17, lon: 27 }, { lat: 10, lon: 31 },
  { lat: 2, lon: 24 }, { lat: -8, lon: 23 }, { lat: -18, lon: 25 },
  { lat: -27, lon: 23 }, { lat: -35, lon: 18 }, { lat: -25, lon: 15 },
  { lat: -12, lon: 14 }, { lat: 4, lon: 10 }, { lat: 18, lon: 8 },
  { lat: 68, lon: 60 }, { lat: 62, lon: 75 }, { lat: 56, lon: 90 },
  { lat: 50, lon: 106 }, { lat: 46, lon: 120 }, { lat: 42, lon: 132 },
  { lat: 35, lon: 120 }, { lat: 30, lon: 108 }, { lat: 25, lon: 96 },
  { lat: 22, lon: 82 }, { lat: 24, lon: 70 }, { lat: 30, lon: 56 },
  { lat: 36, lon: 52 }, { lat: 40, lon: 66 }, { lat: 46, lon: 82 },
  { lat: 52, lon: 102 }, { lat: 58, lon: 122 }, { lat: 46, lon: 142 },
  { lat: 36, lon: 140 }, { lat: 31, lon: 135 }, { lat: 22, lon: 121 },
  { lat: 14, lon: 110 }, { lat: 7, lon: 102 }, { lat: 0, lon: 106 },
  { lat: -8, lon: 115 }, { lat: -16, lon: 123 }, { lat: -24, lon: 132 },
  { lat: -30, lon: 141 }, { lat: -34, lon: 151 }, { lat: -24, lon: 154 },
  { lat: -17, lon: 146 }, { lat: -13, lon: 136 }, { lat: -12, lon: 124 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeCountryKey = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const projectPoint = (latitude: number, longitude: number, rotationDeg: number) => {
  const latRad = latitude * DEG_TO_RAD;
  const lonRad = (longitude + rotationDeg) * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const x = cosLat * Math.sin(lonRad);
  const y = sinLat;
  const z = cosLat * Math.cos(lonRad);
  return {
    x: 50 + x * GLOBE_RADIUS_PCT,
    y: 50 - y * GLOBE_RADIUS_PCT,
    z,
    depth: (z + 1) / 2,
  };
};

const LiveUsersGlobe = ({ points, activeUsers, updatedAt }: LiveUsersGlobeProps) => {
  const [rotationDeg, setRotationDeg] = useState(0);
  const [secondsTick, setSecondsTick] = useState(0);

  useEffect(() => {
    const rotationHandle = window.setInterval(() => {
      setRotationDeg((prev) => (prev + 0.72) % 360);
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

  const projectedLand = useMemo(() => {
    return LANDMASS_SEEDS
      .map((seed, index) => {
        const projected = projectPoint(seed.lat, seed.lon, rotationDeg);
        if (projected.z < -0.06) return null;
        return {
          ...projected,
          index,
          size: seed.size ? seed.size : 0.78,
          opacity: 0.2 + projected.depth * 0.72,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.z - b.z);
  }, [rotationDeg]);

  const projectedPoints = useMemo(() => {
    return normalizedPoints
      .map((row, index) => {
        const projected = projectPoint(row.latitude, row.longitude, rotationDeg);
        if (projected.z < -0.04) return null;
        const size = 1.4 + Math.min(4.5, Math.log1p(row.sessions) * 1.2);
        return {
          ...row,
          ...projected,
          index,
          size,
          glow: size * 2.25,
          opacity: 0.2 + projected.depth * 0.8,
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

  const latitudeRings = [-55, -30, 0, 30, 55].map((lat) => {
    const latRad = lat * DEG_TO_RAD;
    const cy = 50 - Math.sin(latRad) * GLOBE_RADIUS_PCT;
    const rx = Math.cos(latRad) * GLOBE_RADIUS_PCT;
    return { lat, cy, rx };
  });

  return (
    <div className="rounded-xl border border-sky-300/25 bg-card/45 p-4 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.4)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/35 bg-sky-400/10 text-sky-200">
            <Globe2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Live World Presence</p>
            <p className="text-[11px] text-muted-foreground">Earth view refreshes every second</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[11px] text-sky-200">
          <RefreshCw className="h-3.5 w-3.5 animate-live-gear-spin" />
          {secondsSinceUpdate === null ? "Syncing..." : `${secondsSinceUpdate}s ago`}
        </div>
      </div>

      <div className="live-globe-shell mx-auto">
        <div className="earth-globe-frame">
          <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Live active user Earth globe">
            <defs>
              <radialGradient id="earthOceanFill" cx="35%" cy="25%" r="72%">
                <stop offset="0%" stopColor="hsl(203 86% 67% / 0.96)" />
                <stop offset="42%" stopColor="hsl(210 76% 45% / 0.92)" />
                <stop offset="100%" stopColor="hsl(221 66% 18% / 0.96)" />
              </radialGradient>
              <radialGradient id="earthShade" cx="78%" cy="46%" r="68%">
                <stop offset="0%" stopColor="hsl(218 40% 10% / 0.08)" />
                <stop offset="70%" stopColor="hsl(218 40% 10% / 0.58)" />
                <stop offset="100%" stopColor="hsl(218 40% 10% / 0.82)" />
              </radialGradient>
              <filter id="earthUserDotGlow" x="-200%" y="-200%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="1.1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx="50" cy="50" r={GLOBE_RADIUS_PCT} fill="url(#earthOceanFill)" />

            {latitudeRings.map((ring) => (
              <ellipse
                key={`lat-${ring.lat}`}
                cx="50"
                cy={ring.cy}
                rx={ring.rx}
                ry={Math.max(0.32, ring.rx * 0.18)}
                fill="none"
                stroke="hsl(201 84% 84% / 0.12)"
                strokeWidth="0.24"
              />
            ))}

            {projectedLand.map((land) => (
              <circle
                key={`land-${land.index}`}
                cx={land.x}
                cy={land.y}
                r={land.size}
                fill="hsl(102 34% 44%)"
                opacity={land.opacity}
              />
            ))}

            <g className="earth-globe-cloud-layer">
              <ellipse cx="38" cy="31" rx="17.5" ry="4.6" fill="hsl(210 60% 96% / 0.13)" />
              <ellipse cx="58" cy="45" rx="23" ry="5.2" fill="hsl(210 60% 96% / 0.11)" />
              <ellipse cx="48" cy="64" rx="19" ry="4.3" fill="hsl(210 60% 96% / 0.1)" />
            </g>

            {projectedPoints.map((row) => (
              <g key={`${row.country || "unknown"}-${row.city || "city"}-${row.index}`} style={{ opacity: row.opacity }}>
                <circle
                  cx={row.x}
                  cy={row.y}
                  r={row.glow}
                  fill="hsl(40 100% 70% / 0.18)"
                  className="live-globe-point-pulse"
                  style={{ animationDelay: `${(row.index % 9) * 0.16}s` }}
                />
                <circle
                  cx={row.x}
                  cy={row.y}
                  r={row.size}
                  fill="hsl(42 100% 77%)"
                  stroke="hsl(26 100% 65%)"
                  strokeWidth="0.35"
                  filter="url(#earthUserDotGlow)"
                >
                  <title>
                    {(row.country || "Unknown") + ` - ${row.sessions} sessions, ${row.users} users`}
                  </title>
                </circle>
              </g>
            ))}

            <circle cx="50" cy="50" r={GLOBE_RADIUS_PCT} fill="url(#earthShade)" />
            <circle cx="50" cy="50" r={GLOBE_RADIUS_PCT} className="earth-globe-atmosphere" fill="none" strokeWidth="0.68" />
          </svg>
          <div className="live-globe-ring live-globe-ring-primary" />
          <div className="live-globe-ring live-globe-ring-secondary" />
          <div className="live-globe-scan" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Active Users</p>
          <p className="text-base font-semibold text-sky-100">{activeUsers}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Countries</p>
          <p className="text-base font-semibold text-sky-100">{countryCount}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
          <p className="text-muted-foreground">Tracked Sessions</p>
          <p className="text-base font-semibold text-sky-100">{trackedSessions}</p>
        </div>
      </div>
    </div>
  );
};

export default LiveUsersGlobe;
