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

export type FeedbackLoopSignal = {
  job_id: string
  created_at: string
  source_type: 'platform' | 'internal'
  source: string | null
  notes: string | null
  creator_feedback_category: string | null
  creator_feedback_notes: string | null
  signal_outcome: number
  watch_percent: number | null
  hook_hold_percent: number | null
  completion_percent: number | null
  rewatch_rate: number | null
  manual_score: number | null
  first30_retention: number | null
  click_through_rate: number | null
  shares_per_view: number | null
  likes_per_view: number | null
  comments_per_view: number | null
  editor_mode: string | null
  strategy_profile: string | null
  target_platform: string | null
  hook_selection_mode: string | null
  model_hook_score: number | null
  model_pacing_score: number | null
  model_jank_score: number | null
  model_retention_score: number | null
}

export type FeedbackLoopStatusResponse = {
  status: {
    settings: {
      enabled: boolean
      auto_apply: boolean
      min_feedback_samples: number
      lookback_limit: number
      cooldown_minutes: number
      min_confidence: number
      min_delta_score: number
    }
    runtime: {
      last_run_at: string | null
      last_run_reason: string | null
      last_trigger: string | null
      last_applied_at: string | null
      last_applied_note: string | null
      last_applied_config_version_id: string | null
      last_apply_confidence: number | null
      last_apply_delta_score: number | null
    }
    brain_snapshot: {
      generated_at: string
      sample_size: number
      platform_feedback_share: number
      avg_outcome: number
      avg_hook_hold: number | null
      avg_completion: number | null
      avg_model_hook: number | null
      avg_model_pacing: number | null
      avg_model_jank: number | null
      confidence: number
      predicted_delta_score: number
      recommended_editor_mode: string | null
      recommended_strategy_profile: string | null
      recommended_target_platform: string | null
      rationale: string[]
      proposed_param_deltas: Record<string, number>
      mode_performance: Array<{ key: string; count: number; avg_outcome: number }>
      strategy_performance: Array<{ key: string; count: number; avg_outcome: number }>
      platform_performance: Array<{ key: string; count: number; avg_outcome: number }>
      recent_signals: FeedbackLoopSignal[]
    }
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

export type PromptApplyChange = {
  key: keyof AlgorithmConfigParams
  previous: number | string
  next: number | string
  delta: number | null
  source: 'prompt_directive' | 'prompt_intent' | 'suggestion_fallback'
  reason: string
}

export type PromptApplyResponse = {
  prompt: string
  strategy: 'prompt_directive' | 'prompt_intent' | 'suggestion_fallback'
  warnings: string[]
  applied_changes: PromptApplyChange[]
  config: AlgorithmConfigVersion
}

export type AutoOptimizeResponse = {
  analyzed_sample_size: number
  suggestion: ImprovementSuggestion
  config: AlgorithmConfigVersion
}

export type IntelligenceBoundaryCriticModel = {
  version: string
  threshold: number
  weights: {
    continuity: number
    context: number
    motion: number
    audio: number
    narrative: number
    bias: number
  }
  metrics: {
    sampleCount: number
    accuracy: number
    precision: number
    recall: number
    f1: number
  }
  createdAt: string
}

export type IntelligenceBaselineStats = {
  sampleCount: number
  labeledBoundaryCount: number
  goodBoundaryCount: number
  badBoundaryCount: number
  coveragePercent: number
}

export type CreatorStyleProfile = {
  version: 1
  userId: string
  updatedAt: string
  sampleCount: number
  pacePreference: number
  cutAggression: number
  hookAggression: number
  preferredTransitionStyle: "smooth" | "jump" | "mixed"
  qualityBias: number
  signals: {
    avgWatchPercent: number | null
    avgCompletionPercent: number | null
    avgHookHoldPercent: number | null
    avgRewatchRate: number | null
  }
}

export type IntelligenceStatusResponse = {
  ok: true
  model: IntelligenceBoundaryCriticModel
  baseline: IntelligenceBaselineStats
  style: CreatorStyleProfile
}

export type IntelligenceBaselineSample = {
  id: string
  userId: string
  sourceType: string
  sourceJobId: string | null
  videoUrl: string | null
  durationSeconds: number | null
  edl: unknown[]
  boundaryLabels: Array<{
    boundaryIndex: number
    time: number
    label: "good" | "bad"
    continuity: number
    context: number
    motion: number
    audio: number
    narrative: number
    notes: string | null
  }>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type IntelligenceBaselineSamplesResponse = {
  ok: true
  samples: IntelligenceBaselineSample[]
}

export type IntelligenceCollectBaselineResponse = {
  ok: true
  sample: IntelligenceBaselineSample
}

export type IntelligenceTrainBoundaryCriticResponse = {
  ok: true
  model: IntelligenceBoundaryCriticModel
}

export type IntelligencePromotionCandidate = {
  policyId: string
  baselinePolicyId: string
  lift: number
  zScore: number
  sampleCount: number
  baselineSampleCount: number
  mean: number
  baselineMean: number
}

export type IntelligencePromotionsResponse = {
  ok: true
  candidates: IntelligencePromotionCandidate[]
}
