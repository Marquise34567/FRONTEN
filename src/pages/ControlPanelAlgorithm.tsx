import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { motion } from "framer-motion"
import { Activity, FlaskConical, Rocket, Sparkles, TestTubeDiagonal, Wand2 } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { useAuth } from "@/providers/AuthProvider"
import { algorithmApi } from "@/features/control-panel/algorithm/api"
import { AUTOEDITOR_MASTER_PROMPT_TEMPLATE } from "@/features/control-panel/algorithm/masterPromptTemplate"
import type {
  AlgorithmConfigParams,
  AnalyzeResponse,
  ImprovementSuggestion,
  PromptApplyChange
} from "@/features/control-panel/algorithm/types"

const PARAM_LIMITS: Record<
  keyof AlgorithmConfigParams,
  {
    min: number
    max: number
    step?: number
  }
> = {
  cut_aggression: { min: 0, max: 100, step: 1 },
  min_clip_len_ms: { min: 120, max: 30000, step: 10 },
  max_clip_len_ms: { min: 300, max: 120000, step: 10 },
  silence_db_threshold: { min: -80, max: -5, step: 1 },
  silence_min_ms: { min: 80, max: 8000, step: 10 },
  filler_word_weight: { min: 0, max: 4, step: 0.01 },
  redundancy_weight: { min: 0, max: 4, step: 0.01 },
  energy_floor: { min: 0, max: 1, step: 0.01 },
  spike_boost: { min: 0, max: 3, step: 0.01 },
  pattern_interrupt_every_sec: { min: 2, max: 60, step: 1 },
  hook_priority_weight: { min: 0, max: 3, step: 0.01 },
  story_coherence_guard: { min: 0, max: 100, step: 1 },
  jank_guard: { min: 0, max: 100, step: 1 },
  pacing_multiplier: { min: 0.3, max: 3, step: 0.01 },
  subtitle_style_mode: { min: 0, max: 0 }
}

const SLIDER_FIELDS: Array<{
  key: keyof AlgorithmConfigParams
  label: string
  hint: string
}> = [
  { key: "cut_aggression", label: "Cut Aggression", hint: "Higher trims harder and raises keep/drop threshold." },
  { key: "hook_priority_weight", label: "Hook Priority", hint: "Biases early-seconds peak segment selection." },
  { key: "pattern_interrupt_every_sec", label: "Interrupt Cycle", hint: "Cadence target for pattern breaks." },
  { key: "silence_db_threshold", label: "Silence dB Threshold", hint: "How aggressively low-audio segments are treated as silence." },
  { key: "silence_min_ms", label: "Silence Min (ms)", hint: "Minimum pause length required before silence cut logic activates." },
  { key: "energy_floor", label: "Energy Floor", hint: "Minimum energy target to keep scenes feeling alive." },
  { key: "spike_boost", label: "Spike Boost", hint: "How much emotional spikes influence keep decisions." },
  { key: "story_coherence_guard", label: "Story Guard", hint: "Prevents high-context removals." },
  { key: "jank_guard", label: "Jank Guard", hint: "Penalizes continuity and audio jank risk." },
  { key: "pacing_multiplier", label: "Pacing Multiplier", hint: "Global tempo target for cut density." },
  { key: "filler_word_weight", label: "Filler Weight", hint: "Penalty strength for filler language." },
  { key: "redundancy_weight", label: "Redundancy Weight", hint: "Penalty strength for repeated content." },
  { key: "min_clip_len_ms", label: "Min Clip (ms)", hint: "Hard floor for minimum segment length." },
  { key: "max_clip_len_ms", label: "Max Clip (ms)", hint: "Hard ceiling for maximum segment length." }
]

const QUICK_TUNE_PROFILES: Array<{
  id: string
  label: string
  description: string
  deltas: Partial<Record<Exclude<keyof AlgorithmConfigParams, 'subtitle_style_mode'>, number>>
}> = [
  {
    id: 'viral_boost',
    label: 'Viral Boost',
    description: 'Faster pacing and stronger opening hooks.',
    deltas: {
      cut_aggression: 8,
      pacing_multiplier: 0.12,
      hook_priority_weight: 0.18,
      pattern_interrupt_every_sec: -1.3
    }
  },
  {
    id: 'clean_stability',
    label: 'Clean Stability',
    description: 'Reduce jank and preserve smoother transitions.',
    deltas: {
      jank_guard: 9,
      story_coherence_guard: 5,
      cut_aggression: -7,
      silence_min_ms: 100
    }
  },
  {
    id: 'story_depth',
    label: 'Story Depth',
    description: 'Prioritize narrative flow and context retention.',
    deltas: {
      story_coherence_guard: 11,
      max_clip_len_ms: 1100,
      cut_aggression: -4
    }
  },
  {
    id: 'energy_push',
    label: 'Energy Push',
    description: 'Bias toward emotionally high-energy moments.',
    deltas: {
      spike_boost: 0.2,
      energy_floor: 0.06,
      hook_priority_weight: 0.08
    }
  }
]

const PARTICLES = [
  { top: "10%", left: "8%", size: 4, delay: 0 },
  { top: "18%", left: "74%", size: 6, delay: 1.1 },
  { top: "35%", left: "12%", size: 5, delay: 0.7 },
  { top: "42%", left: "66%", size: 3, delay: 1.8 },
  { top: "52%", left: "28%", size: 4, delay: 2.1 },
  { top: "65%", left: "82%", size: 5, delay: 0.4 },
  { top: "78%", left: "40%", size: 6, delay: 1.4 },
  { top: "85%", left: "18%", size: 3, delay: 2.6 }
] as const

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const formatClock = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "--:--"
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

const formatPct = (value: number) => `${(value * 100).toFixed(0)}%`

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const PROMPT_MAX_CHARS = 30_000

const formatParamKey = (key: string) =>
  key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const ControlPanelAlgorithm = () => {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  const canLoad = Boolean(accessToken)
  const [draftParams, setDraftParams] = useState<AlgorithmConfigParams | null>(null)
  const [paramsDirty, setParamsDirty] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [deepAnalysis, setDeepAnalysis] = useState<AnalyzeResponse | null>(null)
  const [experimentOpen, setExperimentOpen] = useState(false)
  const [experimentName, setExperimentName] = useState("Algorithm A/B")
  const [experimentDraftArms, setExperimentDraftArms] = useState<Array<{ config_version_id: string; allocation: number }>>(
    [
      { config_version_id: "", allocation: 50 },
      { config_version_id: "", allocation: 50 }
    ]
  )
  const [selectedSampleJobId, setSelectedSampleJobId] = useState("")
  const [sampleTestResult, setSampleTestResult] = useState<{
    score_total: number
    hook: number
    pacing: number
    jank: number
  } | null>(null)
  const [analysisLimit, setAnalysisLimit] = useState("1000")
  const [analysisRange, setAnalysisRange] = useState("7d")
  const [promptText, setPromptText] = useState(AUTOEDITOR_MASTER_PROMPT_TEMPLATE)
  const [promptSummary, setPromptSummary] = useState<string | null>(null)
  const [promptWarnings, setPromptWarnings] = useState<string[]>([])
  const [promptAppliedChanges, setPromptAppliedChanges] = useState<PromptApplyChange[]>([])
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(true)
  const [realtimeNote, setRealtimeNote] = useState("Realtime Control Room sync")
  const autoPushDebounceRef = useRef<number | null>(null)
  const lastAutoPushFingerprintRef = useRef<string>("")

  const activeConfigQuery = useQuery({
    queryKey: ["algorithm-config-active"],
    queryFn: () => algorithmApi.getConfig({ token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 3000
  })

  const configVersionsQuery = useQuery({
    queryKey: ["algorithm-config-versions"],
    queryFn: () => algorithmApi.listConfigVersions({ token: accessToken || "", limit: 40 }),
    enabled: canLoad,
    refetchInterval: 8000
  })

  const presetsQuery = useQuery({
    queryKey: ["algorithm-presets"],
    queryFn: () => algorithmApi.listPresets({ token: accessToken || "" }),
    enabled: canLoad
  })

  const recentMetricsQuery = useQuery({
    queryKey: ["algorithm-metrics-recent"],
    queryFn: () => algorithmApi.listRecentMetrics({ token: accessToken || "", limit: 50 }),
    enabled: canLoad,
    refetchInterval: 3000
  })

  const scorecardsQuery = useQuery({
    queryKey: ["algorithm-scorecards"],
    queryFn: () => algorithmApi.getScorecards({ token: accessToken || "", range: "7d", limit: 700 }),
    enabled: canLoad,
    refetchInterval: 3000
  })

  const suggestionsQuery = useQuery({
    queryKey: ["algorithm-suggestions"],
    queryFn: () => algorithmApi.getSuggestions({ token: accessToken || "", range: "7d" }),
    enabled: canLoad,
    refetchInterval: 15000
  })

  const experimentStatusQuery = useQuery({
    queryKey: ["algorithm-experiment-status"],
    queryFn: () => algorithmApi.getExperimentStatus({ token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 4000
  })

  const sampleFootageQuery = useQuery({
    queryKey: ["algorithm-sample-footage"],
    queryFn: () => algorithmApi.listSampleFootage({ token: accessToken || "", limit: 25 }),
    enabled: canLoad
  })

  useEffect(() => {
    if (!activeConfigQuery.data?.config || paramsDirty) return
    setDraftParams(activeConfigQuery.data.config.params)
  }, [activeConfigQuery.data?.config?.id, paramsDirty])

  useEffect(() => {
    if (selectedSampleJobId || !(sampleFootageQuery.data?.samples?.length || 0)) return
    setSelectedSampleJobId(sampleFootageQuery.data?.samples[0]?.job_id || "")
  }, [sampleFootageQuery.data?.samples, selectedSampleJobId])

  useEffect(() => {
    const versions = configVersionsQuery.data?.versions || []
    if (versions.length < 2) return
    const hasAnyConfig = experimentDraftArms.some((arm) => arm.config_version_id)
    if (hasAnyConfig) return
    setExperimentDraftArms([
      { config_version_id: versions[0].id, allocation: 50 },
      { config_version_id: versions[1].id, allocation: 50 }
    ])
  }, [configVersionsQuery.data?.versions, experimentDraftArms])

  const refreshAlgorithmQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["algorithm-config-active"] }),
      queryClient.invalidateQueries({ queryKey: ["algorithm-config-versions"] }),
      queryClient.invalidateQueries({ queryKey: ["algorithm-metrics-recent"] }),
      queryClient.invalidateQueries({ queryKey: ["algorithm-scorecards"] }),
      queryClient.invalidateQueries({ queryKey: ["algorithm-suggestions"] }),
      queryClient.invalidateQueries({ queryKey: ["algorithm-experiment-status"] })
    ])
  }

  const createConfigMutation = useMutation({
    mutationFn: (payload: { params: AlgorithmConfigParams; note?: string | null }) =>
      algorithmApi.createConfig({
        token: accessToken || "",
        params: payload.params,
        activate: true,
        note: payload.note ?? null
      }),
    onSuccess: async (result) => {
      setParamsDirty(false)
      setDraftParams(result.config.params)
      setActionError(null)
      setActionSuccess("Applied and activated as new config version.")
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Failed to apply config.")
    }
  })

  const realtimePushMutation = useMutation({
    mutationFn: (payload: { params: AlgorithmConfigParams; note?: string | null }) =>
      algorithmApi.createConfig({
        token: accessToken || "",
        params: payload.params,
        activate: true,
        note: payload.note ?? "Realtime control update"
      }),
    onSuccess: async (result) => {
      setParamsDirty(false)
      setDraftParams(result.config.params)
      setActionError(null)
      setActionSuccess("Realtime config synced to server.")
      setPromptSummary(null)
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Realtime sync failed.")
    }
  })

  const rollbackMutation = useMutation({
    mutationFn: () => algorithmApi.rollbackConfig({ token: accessToken || "" }),
    onSuccess: async (result) => {
      setParamsDirty(false)
      setDraftParams(result.config.params)
      setActionError(null)
      setActionSuccess("Rollback completed. Previous config re-activated.")
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Rollback failed.")
    }
  })

  const analyzeMutation = useMutation({
    mutationFn: () =>
      algorithmApi.analyzeRenders({
        token: accessToken || "",
        limit: clamp(toNumber(analysisLimit, 1000), 50, 5000),
        range: analysisRange
      }),
    onSuccess: (result) => {
      setDeepAnalysis(result)
      setActionError(null)
      setActionSuccess(`Analyzed last ${result.summary.sample_size} renders with deterministic suggestions.`)
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Analyze renders failed.")
    }
  })

  const promptApplyMutation = useMutation({
    mutationFn: () =>
      algorithmApi.applyPrompt({
        token: accessToken || "",
        prompt: promptText.trim(),
        fallback_limit: clamp(toNumber(analysisLimit, 1000), 50, 5000),
        fallback_range: analysisRange
      }),
    onSuccess: async (result) => {
      setDraftParams(result.config.params)
      setParamsDirty(false)
      setActionError(null)
      setActionSuccess("Prompt translated and applied to live config.")
      setPromptWarnings(result.warnings || [])
      setPromptAppliedChanges(result.applied_changes || [])
      setPromptSummary(
        `${result.strategy} • ${result.applied_changes.length} change${result.applied_changes.length === 1 ? "" : "s"}`
      )
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setPromptSummary(null)
      setPromptWarnings([])
      setPromptAppliedChanges([])
      setActionSuccess(null)
      setActionError((error as Error).message || "Prompt apply failed.")
    }
  })

  const autoOptimizeMutation = useMutation({
    mutationFn: () =>
      algorithmApi.autoOptimize({
        token: accessToken || "",
        limit: clamp(toNumber(analysisLimit, 1000), 50, 5000),
        range: analysisRange
      }),
    onSuccess: async (result) => {
      setDraftParams(result.config.params)
      setParamsDirty(false)
      setPromptSummary(`Auto-optimized from ${result.analyzed_sample_size} renders using "${result.suggestion.title}".`)
      setPromptWarnings([])
      setPromptAppliedChanges([])
      setActionError(null)
      setActionSuccess(`Auto-optimized live config: ${result.suggestion.title}`)
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Auto-optimize failed.")
    }
  })

  const sampleTestMutation = useMutation({
    mutationFn: ({ job_id, params }: { job_id: string; params?: AlgorithmConfigParams }) =>
      algorithmApi.testSampleFootage({
        token: accessToken || "",
        job_id,
        params
      }),
    onSuccess: (result) => {
      setActionError(null)
      setSampleTestResult({
        score_total: result.score_total,
        hook: result.subscores.H,
        pacing: result.subscores.P,
        jank: result.subscores.J
      })
    },
    onError: (error) => {
      setSampleTestResult(null)
      setActionError((error as Error).message || "Sample test failed.")
    }
  })

  const startExperimentMutation = useMutation({
    mutationFn: async () => {
      const filtered = experimentDraftArms.filter((arm) => arm.config_version_id.trim())
      if (filtered.length < 2 || filtered.length > 4) {
        throw new Error("Select 2 to 4 experiment arms.")
      }
      const allocationTotal = filtered.reduce((sum, arm) => sum + Math.max(0, toNumber(arm.allocation, 0)), 0)
      if (allocationTotal <= 0) {
        throw new Error("Allocation total must be greater than 0.")
      }
      const normalized = filtered.map((arm) => {
        const pct = (Math.max(0, toNumber(arm.allocation, 0)) / allocationTotal) * 100
        return {
          config_version_id: arm.config_version_id,
          allocation: pct
        }
      })

      return algorithmApi.startExperiment({
        token: accessToken || "",
        name: experimentName.trim() || "Algorithm A/B",
        arms: normalized.map((arm) => ({
          config_version_id: arm.config_version_id,
          weight: arm.allocation / 100
        })),
        allocation: normalized.reduce((acc, arm) => {
          acc[arm.config_version_id] = Number(arm.allocation.toFixed(4))
          return acc
        }, {} as Record<string, number>)
      })
    },
    onSuccess: async () => {
      setExperimentOpen(false)
      setActionError(null)
      setActionSuccess("Experiment started.")
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Could not start experiment.")
    }
  })

  const stopExperimentMutation = useMutation({
    mutationFn: () => algorithmApi.stopExperiment({ token: accessToken || "" }),
    onSuccess: async () => {
      setActionError(null)
      setActionSuccess("Experiment stopped.")
      await refreshAlgorithmQueries()
    },
    onError: (error) => {
      setActionSuccess(null)
      setActionError((error as Error).message || "Could not stop experiment.")
    }
  })

  const setParamValue = (key: keyof AlgorithmConfigParams, value: number | string) => {
    setDraftParams((prev) => {
      if (!prev) return prev
      if (key === "subtitle_style_mode") {
        return {
          ...prev,
          subtitle_style_mode: String(value)
        }
      }
      const currentLimits = PARAM_LIMITS[key]
      const clamped = clamp(toNumber(value, prev[key] as number), currentLimits.min, currentLimits.max)
      return {
        ...prev,
        [key]: clamped
      }
    })
    setParamsDirty(true)
  }

  const applyQuickTuneProfile = (profileId: string) => {
    const profile = QUICK_TUNE_PROFILES.find((item) => item.id === profileId)
    const source = draftParams || activeConfigQuery.data?.config.params
    if (!profile || !source) return
    const next: AlgorithmConfigParams = { ...source }
    for (const [rawKey, rawDelta] of Object.entries(profile.deltas)) {
      const key = rawKey as keyof AlgorithmConfigParams
      if (key === "subtitle_style_mode") continue
      const limits = PARAM_LIMITS[key]
      const current = toNumber(next[key], 0)
      next[key] = clamp(current + toNumber(rawDelta, 0), limits.min, limits.max) as never
    }
    setDraftParams(next)
    setParamsDirty(true)
    setActionError(null)
    setActionSuccess(`${profile.label} profile loaded.`)
  }

  useEffect(() => {
    return () => {
      if (autoPushDebounceRef.current !== null) {
        window.clearTimeout(autoPushDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!realtimeSyncEnabled || !draftParams || !paramsDirty || realtimePushMutation.isPending) return
    const fingerprint = JSON.stringify(draftParams)
    if (!fingerprint || fingerprint === lastAutoPushFingerprintRef.current) return
    if (autoPushDebounceRef.current !== null) window.clearTimeout(autoPushDebounceRef.current)
    autoPushDebounceRef.current = window.setTimeout(() => {
      lastAutoPushFingerprintRef.current = fingerprint
      realtimePushMutation.mutate({
        params: draftParams,
        note: realtimeNote.trim() || "Realtime control sync"
      })
    }, 900)
    return () => {
      if (autoPushDebounceRef.current !== null) {
        window.clearTimeout(autoPushDebounceRef.current)
      }
    }
  }, [draftParams, paramsDirty, realtimeSyncEnabled, realtimeNote, realtimePushMutation])

  const applySuggestionAsConfig = async (suggestion: ImprovementSuggestion) => {
    const source = draftParams || activeConfigQuery.data?.config.params
    if (!source) return

    if (Object.prototype.hasOwnProperty.call(suggestion.change, "rollback_to_config_version")) {
      await rollbackMutation.mutateAsync()
      return
    }

    const next: AlgorithmConfigParams = { ...source }
    for (const [key, delta] of Object.entries(suggestion.change)) {
      if (key === "subtitle_style_mode") continue
      if (!(key in next)) continue
      const typedKey = key as keyof AlgorithmConfigParams
      if (typedKey === "subtitle_style_mode") continue
      const limits = PARAM_LIMITS[typedKey]
      const current = toNumber(next[typedKey], 0)
      next[typedKey] = clamp(current + delta, limits.min, limits.max) as never
    }

    await createConfigMutation.mutateAsync({
      params: next,
      note: `Applied suggestion: ${suggestion.title}`
    })
  }

  const chartSeries = useMemo(() => scorecardsQuery.data?.series || [], [scorecardsQuery.data?.series])
  const lineSeries = useMemo(() => chartSeries.slice(-50), [chartSeries])
  const scatterSeries = useMemo(
    () =>
      lineSeries.map((point) => ({
        cut_rate_per_min: point.cut_rate_per_min,
        jank: point.jank
      })),
    [lineSeries]
  )

  const suggestions = deepAnalysis?.suggestions || suggestionsQuery.data?.suggestions || []
  const activeConfig = activeConfigQuery.data?.config || null
  const liveDotClass = canLoad ? "bg-emerald-400" : "bg-slate-500"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_140%_at_80%_-15%,hsl(206_98%_56%/0.24),transparent_50%),radial-gradient(120%_130%_at_15%_100%,hsl(189_94%_48%/0.16),transparent_45%),linear-gradient(180deg,hsl(218_30%_8%)_0%,hsl(218_34%_5%)_100%)] text-foreground">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        {PARTICLES.map((particle, index) => (
          <motion.span
            key={`${particle.left}-${particle.top}-${index}`}
            className="absolute rounded-full bg-sky-300/40"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size
            }}
            animate={{ y: [0, -16, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ repeat: Infinity, duration: 5 + index * 0.8, delay: particle.delay }}
          />
        ))}
      </div>

      <main className="relative mx-auto w-full max-w-[1600px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Algorithm Control Room"
          subtitle="Retention proxy orchestration, guardrails, experiments, and deterministic improvement loops."
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge className="border-sky-300/30 bg-sky-500/15 text-sky-100">
            <span className={`mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full ${liveDotClass}`} />
            Live
          </Badge>
          <Badge variant="outline" className={`${realtimeSyncEnabled ? "border-emerald-400/40 text-emerald-200" : "border-slate-600/70 text-slate-300"}`}>
            Realtime Sync: {realtimeSyncEnabled ? "ON" : "OFF"}
          </Badge>
          <Badge variant="outline" className="border-slate-600/70 text-slate-300">
            Active Config: {activeConfig?.preset_name || activeConfig?.id || "unavailable"}
          </Badge>
          <Badge variant="outline" className="border-slate-600/70 text-slate-300">
            Renders tracked: {recentMetricsQuery.data?.metrics.length || 0}
          </Badge>
          {promptSummary ? <span className="text-cyan-200">{promptSummary}</span> : null}
          {actionError ? <span className="text-rose-300">{actionError}</span> : null}
          {actionSuccess ? <span className="text-emerald-300">{actionSuccess}</span> : null}
        </div>

        <section className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <Card className="glass-card border-sky-400/20 bg-slate-950/55">
            <CardHeader>
              <CardTitle className="text-sm text-slate-100">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">Presets</p>
                <div className="grid gap-2">
                  {(presetsQuery.data?.presets || []).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setDraftParams(preset.params)
                        setParamsDirty(true)
                      }}
                      className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-sky-300/40 hover:bg-slate-900/80"
                    >
                      <p className="font-semibold">{preset.name}</p>
                      <p className="text-[11px] text-slate-400">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">Realtime Quality Profiles</p>
                <div className="grid gap-2">
                  {QUICK_TUNE_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => applyQuickTuneProfile(profile.id)}
                      className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-cyan-300/40 hover:bg-slate-900/80"
                    >
                      <p className="font-semibold">{profile.label}</p>
                      <p className="text-[11px] text-slate-400">{profile.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">Realtime Push Controls</p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs text-slate-200">
                    <span>Auto-push when sliders change</span>
                    <input
                      type="checkbox"
                      checked={realtimeSyncEnabled}
                      onChange={(event) => setRealtimeSyncEnabled(event.target.checked)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </label>
                  <input
                    type="text"
                    value={realtimeNote}
                    onChange={(event) => setRealtimeNote(event.target.value)}
                    className="h-8 w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-100"
                    placeholder="Realtime note for server"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!draftParams || realtimePushMutation.isPending}
                    onClick={() =>
                      realtimePushMutation.mutate({
                        params: draftParams as AlgorithmConfigParams,
                        note: realtimeNote.trim() || "Manual realtime push"
                      })
                    }
                    className="w-full bg-cyan-500/85 text-slate-950 hover:bg-cyan-400"
                  >
                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                    Push Live Now
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300/80">Prompt To Tune + Apply</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setPromptText(AUTOEDITOR_MASTER_PROMPT_TEMPLATE)}
                    >
                      Load Master Prompt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setPromptText("")}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <textarea
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  rows={8}
                  maxLength={PROMPT_MAX_CHARS}
                  className="w-full resize-y rounded-md border border-slate-700 bg-slate-900/75 px-2 py-2 text-xs text-slate-100"
                  placeholder="Describe your full strategy prompt. Platform/content selections should be explicit for deterministic mapping."
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Supports detailed long-form prompts.</span>
                  <span>
                    {promptText.length}/{PROMPT_MAX_CHARS}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!promptText.trim() || promptApplyMutation.isPending}
                    onClick={() => promptApplyMutation.mutate()}
                    className="flex-1 bg-sky-500 text-slate-950 hover:bg-sky-400"
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Apply Prompt Live
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Prompt is parsed on the server into deterministic param changes, then activated for new renders immediately.
                </p>
                {promptWarnings.length ? (
                  <div className="mt-2 rounded-md border border-amber-400/20 bg-amber-500/10 p-2">
                    {promptWarnings.map((warning, index) => (
                      <p key={`prompt-warning-${index}`} className="text-[11px] text-amber-100/90">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
                {promptAppliedChanges.length ? (
                  <div className="mt-2 space-y-1 rounded-md border border-cyan-400/20 bg-cyan-500/10 p-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/90">Applied Changes</p>
                    {promptAppliedChanges.slice(0, 8).map((change, index) => (
                      <p key={`prompt-change-${index}`} className="text-[11px] text-cyan-50/90">
                        {formatParamKey(String(change.key))}: {String(change.previous)} → {String(change.next)} ({change.source})
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">Training Window</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[11px] text-slate-300">Range</p>
                    <select
                      value={analysisRange}
                      onChange={(event) => setAnalysisRange(event.target.value)}
                      className="h-8 w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-100"
                    >
                      <option value="24h">24h</option>
                      <option value="3d">3d</option>
                      <option value="7d">7d</option>
                      <option value="14d">14d</option>
                      <option value="30d">30d</option>
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-slate-300">Sample Limit</p>
                    <input
                      type="number"
                      value={analysisLimit}
                      onChange={(event) => setAnalysisLimit(event.target.value)}
                      min={50}
                      max={5000}
                      step={50}
                      className="h-8 w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-100"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={autoOptimizeMutation.isPending}
                  onClick={() => autoOptimizeMutation.mutate()}
                  className="mt-2 w-full bg-emerald-500/85 text-slate-950 hover:bg-emerald-400"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Auto-Optimize + Activate
                </Button>
              </div>

              <div className="space-y-3">
                {SLIDER_FIELDS.map((field) => {
                  const value = draftParams ? draftParams[field.key] : 0
                  const limits = PARAM_LIMITS[field.key]
                  return (
                    <div key={field.key}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-200">{field.label}</p>
                        <input
                          type="number"
                          value={typeof value === "number" ? Number(value.toFixed(2)) : 0}
                          min={limits.min}
                          max={limits.max}
                          step={limits.step || 1}
                          onChange={(event) => setParamValue(field.key, event.target.value)}
                          className="h-7 w-24 rounded-md border border-slate-700 bg-slate-900/70 px-2 text-right text-xs text-slate-100"
                        />
                      </div>
                      <input
                        type="range"
                        min={limits.min}
                        max={limits.max}
                        step={limits.step || 1}
                        value={typeof value === "number" ? value : 0}
                        onChange={(event) => setParamValue(field.key, event.target.value)}
                        className="w-full accent-sky-400"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">{field.hint}</p>
                    </div>
                  )
                })}

                <div>
                  <p className="mb-1 text-xs font-medium text-slate-200">Subtitle Style Mode</p>
                  <input
                    type="text"
                    value={draftParams?.subtitle_style_mode || ""}
                    onChange={(event) => setParamValue("subtitle_style_mode", event.target.value)}
                    className="h-8 w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-100"
                    placeholder="premium_clean"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!draftParams) return
                    createConfigMutation.mutate({
                      params: draftParams,
                      note: "Manual apply from Algorithm Control Room"
                    })
                  }}
                  disabled={!draftParams || createConfigMutation.isPending}
                  className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                >
                  <Rocket className="mr-1.5 h-4 w-4" />
                  Apply To New Renders
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => rollbackMutation.mutate()}
                  disabled={rollbackMutation.isPending}
                  className="border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-800/70"
                >
                  Rollback
                </Button>
                <Dialog open={experimentOpen} onOpenChange={setExperimentOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="border-slate-600 bg-slate-900/40 text-slate-100">
                      <FlaskConical className="mr-1.5 h-4 w-4" />
                      Start Experiment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-slate-700 bg-slate-950 text-slate-100">
                    <DialogHeader>
                      <DialogTitle>Start A/B Experiment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <input
                        value={experimentName}
                        onChange={(event) => setExperimentName(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm"
                        placeholder="Experiment name"
                      />
                      {experimentDraftArms.map((arm, index) => (
                        <div key={`arm-${index}`} className="grid grid-cols-[1fr_110px_36px] gap-2">
                          <select
                            value={arm.config_version_id}
                            onChange={(event) => {
                              setExperimentDraftArms((prev) =>
                                prev.map((entry, idx) =>
                                  idx === index ? { ...entry, config_version_id: event.target.value } : entry
                                )
                              )
                            }}
                            className="h-9 rounded-md border border-slate-700 bg-slate-900/70 px-2 text-sm"
                          >
                            <option value="">Select config</option>
                            {(configVersionsQuery.data?.versions || []).map((version) => (
                              <option key={version.id} value={version.id}>
                                {(version.preset_name || "Custom")} - {version.id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={arm.allocation}
                            onChange={(event) => {
                              const value = clamp(toNumber(event.target.value, 0), 0, 100)
                              setExperimentDraftArms((prev) =>
                                prev.map((entry, idx) => (idx === index ? { ...entry, allocation: value } : entry))
                              )
                            }}
                            className="h-9 rounded-md border border-slate-700 bg-slate-900/70 px-2 text-sm"
                            min={0}
                            max={100}
                            step={1}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExperimentDraftArms((prev) => prev.filter((_, idx) => idx !== index))
                            }
                            className="rounded-md border border-slate-700 bg-slate-900/70 text-xs text-slate-300"
                          >
                            x
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-slate-700 bg-slate-900/40"
                          disabled={experimentDraftArms.length >= 4}
                          onClick={() =>
                            setExperimentDraftArms((prev) => [...prev, { config_version_id: "", allocation: 0 }])
                          }
                        >
                          Add Arm
                        </Button>
                        <Button
                          type="button"
                          disabled={startExperimentMutation.isPending}
                          onClick={() => startExperimentMutation.mutate()}
                          className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                        >
                          Start
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="border-slate-700/70 bg-slate-900/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Sample Footage Sandbox</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <select
                    value={selectedSampleJobId}
                    onChange={(event) => setSelectedSampleJobId(event.target.value)}
                    className="h-8 w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 text-xs"
                  >
                    <option value="">Choose completed render</option>
                    {(sampleFootageQuery.data?.samples || []).map((sample) => (
                      <option key={sample.job_id} value={sample.job_id}>
                        {sample.job_id.slice(0, 10)} - {formatClock(sample.created_at)} - hook {sample.hook_score.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedSampleJobId || sampleTestMutation.isPending}
                    onClick={() =>
                      sampleTestMutation.mutate({
                        job_id: selectedSampleJobId,
                        params: draftParams || undefined
                      })
                    }
                    className="w-full bg-cyan-500/85 text-slate-950 hover:bg-cyan-400"
                  >
                    <TestTubeDiagonal className="mr-1.5 h-3.5 w-3.5" />
                    Test New Features On Sample
                  </Button>
                  {sampleTestResult ? (
                    <div className="rounded-md border border-slate-700/80 bg-slate-950/70 p-2 text-xs text-slate-300">
                      <p className="font-semibold text-slate-100">Predicted Score: {sampleTestResult.score_total.toFixed(2)}</p>
                      <p>Hook: {sampleTestResult.hook.toFixed(2)} | Pacing: {sampleTestResult.pacing.toFixed(2)} | Jank: {sampleTestResult.jank.toFixed(2)}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="glass-card border-sky-400/20 bg-slate-950/55">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm text-slate-100">
                  <span>Score Total (Last 50 Renders)</span>
                  <Badge className="bg-emerald-500/20 text-emerald-200">
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    realtime
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineSeries}>
                    <CartesianGrid stroke="hsl(215 20% 20% / 0.5)" vertical={false} />
                    <XAxis dataKey="t" tickFormatter={formatClock} stroke="hsl(216 16% 62%)" minTickGap={22} />
                    <YAxis domain={[0, 100]} stroke="hsl(216 16% 62%)" />
                    <Tooltip
                      contentStyle={{ background: "rgba(2, 8, 23, 0.9)", border: "1px solid rgba(56, 189, 248, 0.2)" }}
                      labelFormatter={(label) => formatClock(String(label))}
                    />
                    <Line type="monotone" dataKey="score_total" stroke="hsl(200 95% 55%)" strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="glass-card border-sky-400/20 bg-slate-950/55">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-100">Hook vs Pacing vs Jank</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lineSeries}>
                      <CartesianGrid stroke="hsl(215 20% 20% / 0.5)" vertical={false} />
                      <XAxis dataKey="t" tickFormatter={formatClock} stroke="hsl(216 16% 62%)" minTickGap={26} />
                      <YAxis domain={[0, 1]} stroke="hsl(216 16% 62%)" />
                      <Tooltip
                        contentStyle={{ background: "rgba(2, 8, 23, 0.9)", border: "1px solid rgba(56, 189, 248, 0.2)" }}
                        labelFormatter={(label) => formatClock(String(label))}
                      />
                      <Area type="monotone" dataKey="hook" stackId="1" stroke="hsl(193 94% 55%)" fill="hsl(193 94% 55% / 0.25)" />
                      <Area type="monotone" dataKey="pacing" stackId="1" stroke="hsl(152 76% 44%)" fill="hsl(152 76% 44% / 0.2)" />
                      <Area type="monotone" dataKey="jank" stackId="1" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.22)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card border-sky-400/20 bg-slate-950/55">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-100">Cut Rate vs Jank Scatter</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="hsl(215 20% 20% / 0.5)" />
                      <XAxis dataKey="cut_rate_per_min" stroke="hsl(216 16% 62%)" />
                      <YAxis dataKey="jank" domain={[0, 1]} stroke="hsl(216 16% 62%)" />
                      <Tooltip contentStyle={{ background: "rgba(2, 8, 23, 0.9)", border: "1px solid rgba(56, 189, 248, 0.2)" }} />
                      <Scatter data={scatterSeries} fill="hsl(200 95% 55%)" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="glass-card border-sky-400/20 bg-slate-950/55">
            <CardHeader>
              <CardTitle className="text-sm text-slate-100">Improve Now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="w-full bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                Analyze Window ({analysisRange} / {clamp(toNumber(analysisLimit, 1000), 50, 5000)})
              </Button>

              {(suggestions || []).slice(0, 5).map((suggestion) => (
                <motion.div
                  key={suggestion.title}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-slate-700/90 bg-slate-900/70 p-3"
                >
                  <p className="text-sm font-semibold text-slate-100">{suggestion.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{suggestion.why}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <Badge className="bg-emerald-500/20 text-emerald-200">Delta +{suggestion.predicted_delta_score.toFixed(2)}</Badge>
                    <Badge className="bg-sky-500/20 text-sky-200">Confidence {formatPct(suggestion.confidence)}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-amber-200">{suggestion.risk}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void applySuggestionAsConfig(suggestion)}
                    className="mt-2 border-slate-600 bg-slate-900/50 text-slate-100 hover:bg-slate-800/80"
                  >
                    Apply Change As New Config
                  </Button>
                </motion.div>
              ))}

              <Card className="border-slate-700/80 bg-slate-900/65">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Experiment Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-slate-300">
                    {experimentStatusQuery.data?.experiment
                      ? `Running: ${experimentStatusQuery.data.experiment.name}`
                      : "No running experiment"}
                  </p>
                  {(experimentStatusQuery.data?.results || []).map((result) => (
                    <div key={result.config_version_id} className="rounded-md border border-slate-700/80 bg-slate-950/70 p-2">
                      <p className="line-clamp-1 text-slate-200">{result.config_version_id}</p>
                      <p className="text-slate-400">
                        avg {result.avg_score.toFixed(2)} | n={result.sample_size} | conf {formatPct(result.confidence)}
                      </p>
                    </div>
                  ))}
                  {experimentStatusQuery.data?.experiment ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => stopExperimentMutation.mutate()}
                      className="w-full border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                    >
                      Stop Experiment
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {deepAnalysis?.summary ? (
                <Card className="border-slate-700/80 bg-slate-900/65">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">1,000 Render Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-slate-300">
                    <p>Avg Score: {deepAnalysis.summary.avg_score_total.toFixed(2)}</p>
                    <p>Avg Hook: {deepAnalysis.summary.avg_hook.toFixed(3)}</p>
                    <p>Avg Pacing: {deepAnalysis.summary.avg_pacing.toFixed(3)}</p>
                    <p>Avg Jank: {deepAnalysis.summary.avg_jank.toFixed(3)}</p>
                    <p>Failures: Hook {deepAnalysis.summary.failure_counts.low_hook} / Pacing {deepAnalysis.summary.failure_counts.low_pacing} / Jank {deepAnalysis.summary.failure_counts.high_jank}</p>
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelAlgorithm
