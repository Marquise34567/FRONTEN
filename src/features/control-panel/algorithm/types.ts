export type AlgorithmConfigParams = {
  cut_aggression: number
  min_clip_len_ms: number
  max_clip_len_ms: number
  silence_db_threshold: number
  silence_min_ms: number
  filler_word_weight: number
  redundancy_weight: number
  energy_floor: number
  spike_boost: number
  pattern_interrupt_every_sec: number
  hook_priority_weight: number
  story_coherence_guard: number
  jank_guard: number
  pacing_multiplier: number
  subtitle_style_mode: string
}

export type AlgorithmConfigVersion = {
  id: string
  created_at: string
  created_by_user_id: string | null
  preset_name: string | null
  params: AlgorithmConfigParams
  is_active: boolean
  note: string | null
}

export type AlgorithmPreset = {
  key: string
  name: string
  description: string
  params: AlgorithmConfigParams
}

export type RenderQualityMetric = {
  id: string
  job_id: string
  user_id: string | null
  created_at: string
  config_version_id: string
  score_total: number
  score_hook: number
  score_pacing: number
  score_emotion: number
  score_visual: number
  score_story: number
  score_jank: number
  features: Record<string, unknown>
  flags: Record<string, unknown>
}

export type ScorecardPoint = {
  t: string
  score_total: number
  hook: number
  pacing: number
  emotion: number
  visual: number
  story: number
  jank: number
  cut_rate_per_min: number
}

export type ImprovementSuggestion = {
  title: string
  why: string
  change: Record<string, number>
  predicted_delta_score: number
  confidence: number
  risk: string
}

export type AnalyzeSummary = {
  avg_score_total: number
  avg_hook: number
  avg_pacing: number
  avg_emotion: number
  avg_visual: number
  avg_story: number
  avg_jank: number
  score_std: number
  sample_size: number
  failure_counts: {
    low_hook: number
    low_pacing: number
    high_jank: number
    low_story: number
  }
}

export type AnalyzeGroup = {
  config_version_id: string
  preset_name: string | null
  sample_size: number
  avg_score_total: number
  avg_hook: number
  avg_pacing: number
  avg_emotion: number
  avg_visual: number
  avg_story: number
  avg_jank: number
}

export type AnalyzeResponse = {
  summary: AnalyzeSummary
  correlations: Record<string, number>
  groups: AnalyzeGroup[]
  suggestions: ImprovementSuggestion[]
}

export type ExperimentArm = {
  config_version_id: string
  weight: number
}

export type AlgorithmExperiment = {
  id: string
  created_at: string
  created_by_user_id: string | null
  name: string
  status: 'draft' | 'running' | 'stopped'
  arms: ExperimentArm[]
  allocation: Record<string, number>
  reward_metric: string
  start_at: string | null
  end_at: string | null
}

export type ExperimentResult = {
  config_version_id: string
  avg_score: number
  std_dev: number
  sample_size: number
  confidence: number
}

export type ExperimentStatusResponse = {
  experiment: AlgorithmExperiment | null
  results: ExperimentResult[]
  winner_suggestion: {
    config_version_id: string | null
    rationale: string
  }
}

export type SampleFootageItem = {
  job_id: string
  user_id: string | null
  created_at: string
  retention_score: number
  config_version_id: string | null
  duration_sec: number
  hook_score: number
}

export type RetentionScoringResponse = {
  score_total: number
  subscores: {
    H: number
    P: number
    E: number
    V: number
    S: number
    F: number
    J: number
  }
  features: Record<string, unknown>
  flags: Record<string, unknown>
}
