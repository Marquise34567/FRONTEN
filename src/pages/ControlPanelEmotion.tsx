import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Flame, RefreshCw, Sparkles, Wand2, Waves } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import { EmptyStateNote, formatShortTime } from "./control-panel/shared"

type FeatureLabControls = {
  hookLogicMode: "stable" | "experimental"
  subtitleEngineMode: "v1" | "v2"
  maxUploadSizeMb: number
  aiIntensity: number
  watermarkOverride: "auto" | "force_on" | "force_off"
  retentionAlgorithmMode: "adaptive_v3" | "emotional_focus" | "safe_mode"
  zoomIntensityLevel: "low" | "medium" | "high"
  emotionalDetectionThreshold: number
  retentionModelVariant: "v1" | "v2"
  updatedAt: string
  updatedBy?: string | null
}

type FeatureLabResponse = {
  controls: FeatureLabControls
  updatedAt: string
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const EMOTION_PRESETS: Array<{
  id: string
  label: string
  description: string
  patch: Partial<FeatureLabControls>
}> = [
  {
    id: "balanced",
    label: "Balanced Pulse",
    description: "Smooth emotional range for stable storytelling.",
    patch: {
      retentionAlgorithmMode: "adaptive_v3",
      aiIntensity: 1.15,
      emotionalDetectionThreshold: 0.55,
      zoomIntensityLevel: "medium"
    }
  },
  {
    id: "viral",
    label: "Viral Heat",
    description: "Aggressive emotional hooks and energetic cuts.",
    patch: {
      retentionAlgorithmMode: "emotional_focus",
      aiIntensity: 1.75,
      emotionalDetectionThreshold: 0.32,
      zoomIntensityLevel: "high"
    }
  },
  {
    id: "cinematic",
    label: "Cinematic Calm",
    description: "Lower intensity with cleaner emotional confidence.",
    patch: {
      retentionAlgorithmMode: "safe_mode",
      aiIntensity: 0.9,
      emotionalDetectionThreshold: 0.72,
      zoomIntensityLevel: "low"
    }
  }
]

const ControlPanelEmotion = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)
  const [draft, setDraft] = useState<FeatureLabControls | null>(null)
  const [syncLive, setSyncLive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)
  const lastPushedFingerprint = useRef<string>("")

  const controlsQuery = useQuery({
    queryKey: ["control-panel-emotion-controls"],
    queryFn: () => apiFetch<FeatureLabResponse>("/api/admin/feature-lab", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 8000
  })

  useEffect(() => {
    if (!controlsQuery.data?.controls) return
    if (draft && isSaving) return
    setDraft(controlsQuery.data.controls)
  }, [controlsQuery.data?.updatedAt, isSaving])

  const pushPatch = async (patch: Partial<FeatureLabControls>, successMessage = "Emotion controls updated.") => {
    if (!accessToken) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)
    try {
      const result = await apiFetch<FeatureLabResponse>("/api/admin/feature-lab", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(patch)
      })
      setDraft(result.controls)
      setSaveSuccess(successMessage)
      lastPushedFingerprint.current = JSON.stringify({
        retentionAlgorithmMode: result.controls.retentionAlgorithmMode,
        aiIntensity: result.controls.aiIntensity,
        emotionalDetectionThreshold: result.controls.emotionalDetectionThreshold,
        zoomIntensityLevel: result.controls.zoomIntensityLevel
      })
    } catch (error: any) {
      setSaveError(error?.message || "Failed to update emotion controls.")
    } finally {
      setIsSaving(false)
    }
  }

  const scheduleLiveSync = (nextDraft: FeatureLabControls) => {
    if (!syncLive || !accessToken) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const patch: Partial<FeatureLabControls> = {
        retentionAlgorithmMode: nextDraft.retentionAlgorithmMode,
        aiIntensity: nextDraft.aiIntensity,
        emotionalDetectionThreshold: nextDraft.emotionalDetectionThreshold,
        zoomIntensityLevel: nextDraft.zoomIntensityLevel
      }
      const fingerprint = JSON.stringify(patch)
      if (fingerprint === lastPushedFingerprint.current) return
      void pushPatch(patch, "Realtime emotion sync applied.")
    }, 280)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const updateDraft = (patch: Partial<FeatureLabControls>) => {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      scheduleLiveSync(next)
      return next
    })
  }

  const emotionPower = useMemo(() => {
    if (!draft) return 0
    const intensityScore = clamp((draft.aiIntensity - 0.4) / (2 - 0.4), 0, 1)
    const thresholdScore = clamp((1 - draft.emotionalDetectionThreshold) / (1 - 0.1), 0, 1)
    const modeScore =
      draft.retentionAlgorithmMode === "emotional_focus"
        ? 1
        : draft.retentionAlgorithmMode === "adaptive_v3"
        ? 0.65
        : 0.35
    const zoomScore = draft.zoomIntensityLevel === "high" ? 1 : draft.zoomIntensityLevel === "medium" ? 0.7 : 0.4
    return Math.round(((intensityScore + thresholdScore + modeScore + zoomScore) / 4) * 100)
  }, [draft])

  const pulseColor =
    emotionPower >= 75 ? "hsl(351 98% 63%)" : emotionPower >= 50 ? "hsl(34 96% 58%)" : "hsl(193 92% 58%)"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(125%_120%_at_12%_8%,hsl(344_92%_60%/0.2),transparent_44%),radial-gradient(120%_120%_at_84%_20%,hsl(25_98%_58%/0.18),transparent_40%),linear-gradient(180deg,hsl(234_40%_8%)_0%,hsl(238_46%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[16%] h-72 w-72 rounded-full bg-rose-400/12 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.42, 0.25] }}
          transition={{ duration: 7.2, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[9%] top-[36%] h-72 w-72 rounded-full bg-amber-300/12 blur-3xl"
          animate={{ scale: [1.08, 1, 1.08], opacity: [0.22, 0.36, 0.22] }}
          transition={{ duration: 8.3, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Emotion Engine"
          subtitle="Realtime emotional tuning for the editor algorithm with live-sync controls and presets."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load emotion controls." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-rose-300/30 bg-slate-950/55 xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-rose-200" />
                Realtime Emotion Mix
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={syncLive ? "default" : "outline"}
                  className={syncLive ? "bg-rose-500 text-rose-50 hover:bg-rose-500/90" : "border-border/60"}
                  onClick={() => setSyncLive((current) => !current)}
                >
                  {syncLive ? "Live Sync On" : "Live Sync Off"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (!draft) return
                    void pushPatch(
                      {
                        retentionAlgorithmMode: draft.retentionAlgorithmMode,
                        aiIntensity: draft.aiIntensity,
                        emotionalDetectionThreshold: draft.emotionalDetectionThreshold,
                        zoomIntensityLevel: draft.zoomIntensityLevel
                      },
                      "Manual save applied."
                    )
                  }}
                  disabled={!draft || isSaving}
                >
                  {isSaving ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                  Save Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-rose-300/30 bg-slate-900/65 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Emotion Power</p>
                  <Badge className="border-rose-300/40 bg-rose-500/20 text-rose-100">{emotionPower}%</Badge>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: pulseColor }}
                    initial={false}
                    animate={{ width: `${emotionPower}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Stronger power pushes more emotional cuts and higher hook intensity in generated edits.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/45 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">AI Intensity</p>
                  <input
                    type="range"
                    min={0.4}
                    max={2}
                    step={0.01}
                    value={draft?.aiIntensity ?? 1}
                    onChange={(event) => updateDraft({ aiIntensity: Number(event.target.value) })}
                    className="w-full accent-rose-400"
                  />
                  <p className="mt-2 text-sm font-semibold">{(draft?.aiIntensity ?? 1).toFixed(2)}x</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/45 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Emotion Detection Threshold</p>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={draft?.emotionalDetectionThreshold ?? 0.55}
                    onChange={(event) => updateDraft({ emotionalDetectionThreshold: Number(event.target.value) })}
                    className="w-full accent-amber-300"
                  />
                  <p className="mt-2 text-sm font-semibold">{(draft?.emotionalDetectionThreshold ?? 0.55).toFixed(2)}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/45 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Retention Emotion Mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "safe_mode", label: "Safe" },
                      { id: "adaptive_v3", label: "Adaptive" },
                      { id: "emotional_focus", label: "Emotional" }
                    ].map((mode) => {
                      const active = draft?.retentionAlgorithmMode === mode.id
                      return (
                        <motion.button
                          key={mode.id}
                          whileHover={{ y: -1.5, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => updateDraft({ retentionAlgorithmMode: mode.id as FeatureLabControls["retentionAlgorithmMode"] })}
                          className={`rounded-lg border px-3 py-2 text-xs transition ${
                            active
                              ? "border-rose-300/50 bg-rose-500/20 text-rose-100"
                              : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {mode.label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/45 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Zoom Intensity</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "low", label: "Low" },
                      { id: "medium", label: "Medium" },
                      { id: "high", label: "High" }
                    ].map((zoom) => {
                      const active = draft?.zoomIntensityLevel === zoom.id
                      return (
                        <motion.button
                          key={zoom.id}
                          whileHover={{ y: -1.5, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => updateDraft({ zoomIntensityLevel: zoom.id as FeatureLabControls["zoomIntensityLevel"] })}
                          className={`rounded-lg border px-3 py-2 text-xs transition ${
                            active
                              ? "border-amber-300/55 bg-amber-500/20 text-amber-100"
                              : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {zoom.label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {saveError ? <p className="text-sm text-rose-300">{saveError}</p> : null}
              {saveSuccess ? <p className="text-sm text-emerald-300">{saveSuccess}</p> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/55">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-amber-200" />
                Preset Buttons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {EMOTION_PRESETS.map((preset, index) => (
                <motion.button
                  key={preset.id}
                  type="button"
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.24 }}
                  className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-3 text-left transition hover:border-rose-300/40"
                  onClick={() => {
                    if (!draft) return
                    const next = { ...draft, ...preset.patch }
                    setDraft(next)
                    void pushPatch(preset.patch, `${preset.label} applied.`)
                  }}
                >
                  <p className="font-semibold text-foreground">{preset.label}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </motion.button>
              ))}

              <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Live Sync</p>
                <p className="text-sm text-foreground">
                  {syncLive ? "Realtime updates are pushing to the editor algorithm." : "Manual mode active. Press Save Now to apply."}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Last Runtime Update</p>
                <p className="text-sm text-foreground">{formatShortTime(draft?.updatedAt || controlsQuery.data?.updatedAt)}</p>
                <p className="text-[11px] text-muted-foreground">Updated by: {draft?.updatedBy || "system"}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4">
          <Card className="glass-card border-border/60 bg-slate-950/55">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Waves className="h-4 w-4 text-cyan-200" />
                Emotion Scenario Launcher
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-xs md:grid-cols-3">
              {[
                {
                  label: "Hook Blast",
                  text: "Maximize first 8-second engagement and emotional peaks for shorts."
                },
                {
                  label: "Story Arc",
                  text: "Smooth pacing with balanced emotion across longer clips."
                },
                {
                  label: "Retention Guard",
                  text: "Lower emotional volatility and protect coherence under noisy footage."
                }
              ].map((scenario, index) => (
                <motion.div
                  key={scenario.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.07, duration: 0.28 }}
                  className="rounded-xl border border-border/60 bg-card/45 p-3"
                >
                  <p className="mb-1 font-semibold">{scenario.label}</p>
                  <p className="text-muted-foreground">{scenario.text}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelEmotion
