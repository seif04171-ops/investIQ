/**
 * Typed wrapper around fetch for the InvestIQ backend.
 * The auth token is passed per call, so this stays framework-agnostic.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error("Can't reach the InvestIQ server. Is the backend running?");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail: string | null = null;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // body wasn't JSON — generic message below
    }
    throw new Error(detail ?? `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ types */

export type Sentiment = "positive" | "negative" | "mixed" | "unclear";

export interface StockLink {
  ticker: string;
  name: string;
  effect: Sentiment | string;
}

export interface EventSummary {
  id: string;
  title: string;
  summary: string;
  event_type: string;
  credibility_score: number | null;
  sentiment: Sentiment;
  companies: string[];
  sectors?: string[];
  last_updated_at: string | null;
  source_url: string | null;
  source_name: string | null;
  source_count?: number;
  tickers?: StockLink[];
}

export interface BriefingEvent extends EventSummary {
  matched_tickers: string[];
  relation: "holding" | "watchlist";
}

export interface BriefingMove {
  ticker: string;
  name: string;
  relation: "holding" | "watchlist";
  price: number | null;
  change_percent: number | null;
  shares: number;
}

export interface LiveNews {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  tickers: string[];
  names: Record<string, string>;
  effect: "positive" | "negative" | "neutral";
  impact: "high" | "medium" | "low";
  why: string;
  credibility: number;
  age_hours: number;
  annotated_by?: string;
  matched_tickers?: string[];
  relation?: "holding" | "watchlist";
}

export interface SourceReport {
  ok: number;
  failed: number;
  error: string | null;
}

export interface LiveNewsStatus {
  running: boolean;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
  new_articles: number;
  new_events: number;
  item_count: number;
  newest_at: string | null;
  sources: Record<string, SourceReport>;
  annotated_by: string | null;
}

export interface LiveNewsOut {
  items: LiveNews[];
  status: LiveNewsStatus;
}

export interface Briefing {
  tracked_count: number;
  moves: BriefingMove[];
  news: LiveNews[];
  status: LiveNewsStatus;
}

export interface PopularStock {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change_percent: number | null;
}

export interface PopularOut {
  groups: { key: string; title: string; stocks: PopularStock[] }[];
  gainers: PopularStock[];
  losers: PopularStock[];
  live_count: number;
}

export interface Research {
  ticker: string;
  name: string;
  sector?: string;
  quote: { price: number; change_percent: number } | null;
  profile?: { name?: string; finnhubIndustry?: string; marketCapitalization?: number; logo?: string } | null;
  metrics: { pe?: number; week52_high?: number; week52_low?: number; dividend_yield?: number; beta?: number };
  technicals: {
    last?: number; sma20?: number; sma50?: number; rsi14?: number;
    ret_1w?: number; ret_1m?: number; ret_3m?: number; trend?: string;
  };
  consensus: {
    strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number;
    analysts: number; period: string; view: string;
  } | null;
  next_earnings: string | null;
  news: LiveNews[];
}

export interface EventEntity {
  entity_type: string;
  entity_value: string;
  predicted_effect: string;
}

export interface AIAnalysisOut {
  opportunity_score: number;
  confidence_score: number;
  reasoning_positive: string[];
  reasoning_negative: string[];
  reasoning_unknown: string[];
  short_term_view: string;
  long_term_view: string;
  risks: string[];
}

export interface HistoricalAnalogueOut {
  year: number;
  description: string;
  avg_market_reaction: string;
  sectors_affected: string[];
  disclaimer: string;
}

export interface EventDetail {
  id: string;
  title: string;
  last_updated_at: string | null;
  related_stocks?: StockLink[];
  summary: string;
  event_type: string;
  credibility_score: number | null;
  credibility_breakdown: Record<string, number> | null;
  sources: { source_name: string; url: string }[];
  entities: EventEntity[];
  ai_analysis: AIAnalysisOut | null;
  historical_analogues: HistoricalAnalogueOut[];
}

export interface GlossaryTermOut {
  term: string;
  simple_explanation: string;
  example: string;
  why_it_matters: string;
}

export interface LessonOut {
  id: string;
  title: string;
  content: string;
  difficulty: string;
  completed: boolean;
}

export interface PortfolioHoldingOut {
  company: string;
  ticker: string | null;
  sector: string;
  shares: number;
  avg_buy_price: number;
  current_price: number;
  price_is_live: boolean;
  market_value: number;
  cost_basis: number;
  gain_loss_value: number;
  gain_loss_pct: number;
  day_change_value: number;
  day_change_pct: number;
  weight_pct: number;
}

export interface HealthFactor {
  key: string;
  label: string;
  score: number;
  status: "good" | "watch" | "risk";
  detail: string;
  why: string;
  term: string;
}

export interface PortfolioHealth {
  score: number;
  grade: string;
  factors: HealthFactor[];
  disclaimer: string;
}

export interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}

export interface PortfolioSummaryOut {
  starting_cash: number;
  cash_balance: number;
  invested_value: number;
  total_value: number;
  total_return_value: number;
  total_return_pct: number;
  unrealized_gain_loss: number;
  day_change_value: number;
  day_change_pct: number;
  holdings: PortfolioHoldingOut[];
  allocation: AllocationSlice[];
  sector_exposure_pct: Record<string, number>;
  concentration_warnings: string[];
  health: PortfolioHealth | null;
  prices_live: boolean;
  stale_tickers: string[];
  as_of: string;
}

export interface TransactionOut {
  id: string;
  ticker: string | null;
  company: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  note: string | null;
  executed_at: string | null;
  current_price: number | null;
  since_pct: number | null;
}

export interface PerformanceOut {
  points: { date: number; value: number }[];
  missing: string[];
  reason: string | null;
}

export interface UserOut {
  id: string;
  email: string;
  display_name: string | null;
  experience_level: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface Quote {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
  high: number | null;
  low: number | null;
  open: number | null;
  prev_close: number | null;
}

export type BulkQuote = Omit<Quote, "ticker"> | null;

export interface MarketIndex {
  index_name: string;
  display_symbol: string;
  is_proxy: boolean;
  price: number;
  change: number;
  change_percent: number;
}

export interface MarketSentiment {
  label: "Bullish" | "Neutral" | "Bearish";
  score: number;
  avg_change_percent: number;
}

export interface StockDetail {
  ticker: string;
  quote: Omit<Quote, "ticker"> | null;
  profile: {
    name: string | null;
    industry: string | null;
    country: string | null;
    exchange: string | null;
    market_cap_millions: number | null;
    logo: string | null;
    website: string | null;
    ipo: string | null;
  } | null;
  stats: {
    pe?: number;
    week52_high?: number;
    week52_low?: number;
    dividend_yield?: number;
    beta?: number;
  };
}

export interface WatchlistEntry {
  company_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  added_at: string | null;
}

export interface SearchHit {
  symbol: string;
  description: string;
  type?: string;
}

export interface OpportunityStory {
  id: string;
  title: string;
  effect: string;
  impact?: string | null;
  credibility: number | null;
  when: string;
  age_hours: number;
  url?: string | null;
  source?: string | null;
  why?: string | null;
}

export interface Opportunity {
  ticker: string;
  name: string;
  price: number;
  change_percent: number | null;
  score: number;
  label: string;
  direction: "bullish" | "neutral" | "bearish";
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
  risks: string[];
  stories: OpportunityStory[];
  story_count: number;
  ret_1m: number | null;
  range_position: number | null;
  relation: "holding" | "watchlist" | null;
  sector?: string | null;
  category?: string | null;
  rsi?: number | null;
  trend?: string | null;
}

export interface OpportunitiesOut {
  items: Opportunity[];
  newest_story_at: string | null;
  disclaimer: string;
  scanned?: number;
}

export interface RefreshStatus {
  running: boolean;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
  new_articles: number;
  new_events: number;
  started?: boolean;
  sources?: Record<string, SourceReport>;
}

/* ------------------------------------------------------------------- api */

export const api = {
  health: () => request<{ status: string; app: string; env: string }>("/health"),
  me: (token: string) => request<UserOut>("/auth/me", { token }),
  signup: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // News / analysis
  listEvents: (limit = 20, ticker?: string) =>
    request<EventSummary[]>(
      `/analysis/events?limit=${limit}${ticker ? `&ticker=${encodeURIComponent(ticker)}` : ""}`
    ),
  getEventDetail: (eventId: string) => request<EventDetail>(`/analysis/events/${eventId}`),
  refreshNews: (force = false) =>
    request<RefreshStatus>(`/news/refresh${force ? "?force=true" : ""}`, { method: "POST" }),
  getRefreshStatus: () => request<RefreshStatus>("/news/refresh/status"),
  getLiveNews: (opts: { sort?: "smart" | "latest"; effect?: string; category?: string; ticker?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.sort) p.set("sort", opts.sort);
    if (opts.effect) p.set("effect", opts.effect);
    if (opts.category) p.set("category", opts.category);
    if (opts.ticker) p.set("ticker", opts.ticker);
    p.set("limit", String(opts.limit ?? 60));
    return request<LiveNewsOut>(`/news/live?${p.toString()}`);
  },
  getPopular: () => request<PopularOut>("/market/popular"),
  getResearch: (ticker: string) => request<Research>(`/market/research/${encodeURIComponent(ticker)}`),
  getOpportunities: (token: string) => request<OpportunitiesOut>("/opportunities", { token }),
  getBriefing: (token: string) => request<Briefing>("/briefing", { token }),

  // Education
  listGlossary: () => request<GlossaryTermOut[]>("/education/glossary"),
  listLessons: (token: string) => request<LessonOut[]>("/education/lessons", { token }),
  completeLesson: (token: string, lessonId: string) =>
    request<{ status: string; lesson_id: string }>(`/education/lessons/${lessonId}/complete`, {
      method: "POST",
      token,
    }),

  // Tutor
  askTutor: (
    token: string,
    question: string,
    explanationMode: "simple" | "advanced" = "simple",
    conversationId?: string
  ) =>
    request<{ conversation_id: string; answer: string }>("/tutor/ask", {
      method: "POST",
      token,
      body: JSON.stringify({
        question,
        explanation_mode: explanationMode,
        conversation_id: conversationId,
      }),
    }),

  listConversations: (token: string) =>
    request<{ id: string; title: string; created_at: string | null }[]>("/tutor/conversations", { token }),
  getConversation: (token: string, id: string) =>
    request<{ role: "user" | "assistant"; content: string }[]>(`/tutor/conversations/${id}`, { token }),

  // Portfolio simulator
  getPortfolioSummary: (token: string) =>
    request<PortfolioSummaryOut>("/portfolio/summary", { token }),
  getTransactions: (token: string) => request<TransactionOut[]>("/portfolio/transactions", { token }),
  getPerformance: (token: string, days = 30) =>
    request<PerformanceOut>(`/portfolio/performance?days=${days}`, { token }),
  buyStock: (token: string, ticker: string, shares: number, note?: string) =>
    request<{ transaction_id: string; status: string; price: number }>("/portfolio/buy", {
      method: "POST",
      token,
      body: JSON.stringify({ ticker, shares, note }),
    }),
  sellStock: (token: string, ticker: string, shares: number, note?: string) =>
    request<{ transaction_id: string; status: string; price: number }>("/portfolio/sell", {
      method: "POST",
      token,
      body: JSON.stringify({ ticker, shares, note }),
    }),
  resetPortfolio: (token: string) =>
    request<{ status: string }>("/portfolio/reset", { method: "POST", token }),

  // Watchlist
  listWatchlist: (token: string) => request<WatchlistEntry[]>("/watchlist", { token }),
  addToWatchlist: (token: string, ticker: string) =>
    request<{ status: string; ticker: string }>("/watchlist", {
      method: "POST",
      token,
      body: JSON.stringify({ ticker }),
    }),
  removeFromWatchlist: (token: string, ticker: string) =>
    request<{ status: string; ticker: string }>(`/watchlist/${ticker}`, {
      method: "DELETE",
      token,
    }),

  // Market data (real, via Finnhub)
  searchTicker: (query: string) =>
    request<SearchHit[]>(`/market/search?q=${encodeURIComponent(query)}`),
  getQuote: (ticker: string) => request<Quote>(`/market/quote/${ticker}`),
  getQuotes: (tickers: string[]) =>
    request<Record<string, BulkQuote>>(`/market/quotes?tickers=${tickers.join(",")}`),
  getStock: (ticker: string) => request<StockDetail>(`/market/stock/${ticker}`),
  getMarketOverview: () => request<MarketIndex[]>("/market/overview"),
  getMarketSentiment: () => request<MarketSentiment>("/market/sentiment"),
  getHistory: (ticker: string, days = 30) =>
    request<{ date: number; close: number }[]>(`/market/history/${ticker}?days=${days}`),
};
