import { apiFetch } from "@/lib/api"
import type {
  AutoOptimizeResponse,
  AlgorithmConfigParams,
  AlgorithmConfigVersion,
  AlgorithmExperiment,
  AlgorithmPreset,
  AnalyzeResponse,
  FeedbackLoopStatusResponse,
  ExperimentStatusResponse,
  ImprovementSuggestion,
  PromptApplyResponse,
  RenderQualityMetric,
  RetentionScoringResponse,
  SampleFootageItem,
  ScorecardPoint
} from "./types"

const BASE = "/api/dev/algorithm"

type TokenInput = {
  token: string
}

const withToken = (token: string, options: RequestInit = {}) => ({
  ...options,
  token
})

export const algorithmApi = {
  getConfig: ({ token }: TokenInput) =>
    apiFetch<{ config: AlgorithmConfigVersion }>(`${BASE}/config`, withToken(token)),

  listConfigVersions: ({ token, limit = 40 }: TokenInput & { limit?: number }) =>
    apiFetch<{ versions: AlgorithmConfigVersion[] }>(`${BASE}/config/versions?limit=${encodeURIComponent(String(limit))}`, {
      ...withToken(token)
    }),

  createConfig: ({
    token,
    params,
    activate,
    note,
    preset_name
  }: TokenInput & {
    params: AlgorithmConfigParams
    activate?: boolean
    note?: string | null
    preset_name?: string | null
  }) =>
    apiFetch<{ config: AlgorithmConfigVersion }>(`${BASE}/config`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        params,
        activate,
        note: note ?? null,
        preset_name: preset_name ?? null
      })
    }),

  rollbackConfig: ({ token }: TokenInput) =>
    apiFetch<{ config: AlgorithmConfigVersion }>(`${BASE}/config/rollback`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({})
    }),

  applyPreset: ({ token, preset_key, note }: TokenInput & { preset_key: string; note?: string | null }) =>
    apiFetch<{ preset: { key: string; name: string }; config: AlgorithmConfigVersion }>(`${BASE}/preset/apply`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({ preset_key, note: note ?? null })
    }),

  listPresets: ({ token }: TokenInput) =>
    apiFetch<{ presets: AlgorithmPreset[] }>(`${BASE}/presets`, withToken(token)),

  listRecentMetrics: ({ token, limit = 50 }: TokenInput & { limit?: number }) =>
    apiFetch<{ metrics: RenderQualityMetric[] }>(`${BASE}/metrics/recent?limit=${encodeURIComponent(String(limit))}`, {
      ...withToken(token)
    }),

  getScorecards: ({ token, range = "7d", limit = 600 }: TokenInput & { range?: string; limit?: number }) =>
    apiFetch<{ series: ScorecardPoint[] }>(
      `${BASE}/scorecards?range=${encodeURIComponent(range)}&limit=${encodeURIComponent(String(limit))}`,
      withToken(token)
    ),

  getSuggestions: ({ token, range = "7d" }: TokenInput & { range?: string }) =>
    apiFetch<{ suggestions: ImprovementSuggestion[] }>(
      `${BASE}/suggestions?range=${encodeURIComponent(range)}`,
      withToken(token)
    ),

  analyzeRenders: ({ token, limit = 1000, range }: TokenInput & { limit?: number; range?: string }) =>
    apiFetch<AnalyzeResponse>(`${BASE}/analyze-renders`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        limit,
        ...(range ? { range } : {})
      })
    }),

  applyPrompt: ({
    token,
    prompt,
    fallback_limit,
    fallback_range
  }: TokenInput & {
    prompt: string
    fallback_limit?: number
    fallback_range?: string
  }) =>
    apiFetch<PromptApplyResponse>(`${BASE}/prompt/apply`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        prompt,
        ...(fallback_limit ? { fallback_limit } : {}),
        ...(fallback_range ? { fallback_range } : {})
      })
    }),

  autoOptimize: ({
    token,
    limit = 1000,
    range
  }: TokenInput & {
    limit?: number
    range?: string
  }) =>
    apiFetch<AutoOptimizeResponse>(`${BASE}/auto-optimize`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        limit,
        ...(range ? { range } : {})
      })
    }),

  startExperiment: ({
    token,
    name,
    arms,
    allocation,
    reward_metric = "score_total"
  }: TokenInput & {
    name: string
    arms: Array<{ config_version_id: string; weight: number }>
    allocation: Record<string, number>
    reward_metric?: string
  }) =>
    apiFetch<{ experiment: AlgorithmExperiment }>(`${BASE}/experiment/start`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        name,
        arms,
        allocation,
        reward_metric
      })
    }),

  stopExperiment: ({ token }: TokenInput) =>
    apiFetch<{ experiment: AlgorithmExperiment | null }>(`${BASE}/experiment/stop`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({})
    }),

  getExperimentStatus: ({ token }: TokenInput) =>
    apiFetch<ExperimentStatusResponse>(`${BASE}/experiment/status`, withToken(token)),

  getFeedbackLoopStatus: ({ token }: TokenInput) =>
    apiFetch<FeedbackLoopStatusResponse>(`${BASE}/feedback-loop/status`, withToken(token)),

  listSampleFootage: ({ token, limit = 20 }: TokenInput & { limit?: number }) =>
    apiFetch<{ samples: SampleFootageItem[] }>(`${BASE}/sample-footage?limit=${encodeURIComponent(String(limit))}`, {
      ...withToken(token)
    }),

  testSampleFootage: ({
    token,
    job_id,
    params
  }: TokenInput & { job_id: string; params?: AlgorithmConfigParams }) =>
    apiFetch<RetentionScoringResponse>(`${BASE}/sample-footage/test`, {
      ...withToken(token),
      method: "POST",
      body: JSON.stringify({
        job_id,
        ...(params ? { params } : {})
      })
    })
}
