export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const apiAssetUrl = (value?: string) => {
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  formData?: FormData;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem("steami-auth-user");
    return raw ? JSON.parse(raw).token ?? null : null;
  } catch {
    return null;
  }
};

const buildQuery = (params?: Record<string, unknown>) => {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export async function apiRequest<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = options.token ?? getStoredToken();
  const headers = new Headers(options.headers);
  if (!options.formData) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "detail" in data
        ? JSON.stringify((data as { detail: unknown }).detail)
        : `Request failed with ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/**
 * Download a CSV blob from an authenticated endpoint and trigger a browser save.
 * Returns the total row count from the X-Total-Rows response header (or null).
 */
export async function apiDownloadCsv(
  path: string,
  filename: string
): Promise<{ rowCount: number | null }> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(`CSV download failed: ${response.status}`, response.status, text);
  }

  const rowCount = response.headers.get("X-Total-Rows");
  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { rowCount: rowCount ? Number(rowCount) : null };
}

/**
 * Fetch CSV text from an authenticated endpoint without downloading.
 * Used to preview the first N rows in the UI.
 */
export async function apiFetchCsvText(path: string): Promise<string> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    throw new ApiError(`CSV fetch failed: ${response.status}`, response.status, null);
  }
  return response.text();
}

export const api = {
  health: () => apiRequest("/health"),

  auth: {
    signup: (body: { full_name: string; email: string; password: string; profession?: string; subscribe_email?: boolean }) =>
      apiRequest("/api/auth/signup", { method: "POST", body }),
    login: (body: { email: string; password: string }) => apiRequest("/api/auth/login", { method: "POST", body }),
    google: (id_token: string) => apiRequest("/api/auth/google", { method: "POST", body: { id_token } }),
    me: () => apiRequest("/api/auth/me"),
    profile: () => apiRequest("/api/auth/profile"),
    updateProfile: (body: Record<string, unknown>) => apiRequest("/api/auth/profile", { method: "PUT", body }),
    patchProfile: (body: Record<string, unknown>) => apiRequest("/api/auth/profile", { method: "PATCH", body }),
    getInterests: () => apiRequest("/api/auth/interests"),
    saveInterests: (topics: string[]) => apiRequest("/api/auth/interests", { method: "POST", body: { topics } }),
    subscribe: (subscribe: boolean) => apiRequest("/api/auth/subscribe", { method: "POST", body: { subscribe } }),
    toggleSubscription: () => apiRequest("/api/auth/subscribe/toggle", { method: "PATCH" }),
    users: () => apiRequest("/api/auth/users"),
    user: (uid: string) => apiRequest(`/api/auth/users/${encodeURIComponent(uid)}`),
    updateUser: (uid: string, body: Record<string, unknown>) => apiRequest(`/api/auth/users/${encodeURIComponent(uid)}`, { method: "PUT", body }),
    updateRole: (uid: string, role: string) => apiRequest(`/api/auth/users/${encodeURIComponent(uid)}/role`, { method: "PUT", body: { role } }),
    deleteUser: (uid: string) => apiRequest(`/api/auth/users/${encodeURIComponent(uid)}`, { method: "DELETE" }),
    toggleUserSubscription: (uid: string) => apiRequest(`/api/auth/users/${encodeURIComponent(uid)}/subscribe/toggle`, { method: "PATCH" }),
    newsletterRecipients: () => apiRequest("/api/auth/newsletter/recipients"),
  },

  profile: {
    me: () => apiRequest("/api/profile/me"),
    update: (body: {
      full_name?: string;
      username?: string;
      bio?: string;
      location?: string;
      website?: string;
      profession?: string;
      interests?: string[];
      subscribe_email?: boolean;
    }) => apiRequest("/api/profile/me", { method: "PATCH", body }),
    changeEmail: (body: { email: string; password: string }) =>
      apiRequest("/api/profile/me/email", { method: "PATCH", body }),
    changePassword: (body: { current_password: string; new_password: string }) =>
      apiRequest("/api/profile/me/password", { method: "PATCH", body }),
    setAvatar: (avatar_url: string) =>
      apiRequest("/api/profile/me/avatar", { method: "PATCH", body: { avatar_url } }),
    removeAvatar: () => apiRequest("/api/profile/me/avatar", { method: "DELETE" }),
    deleteAccount: (password: string) =>
      apiRequest("/api/profile/me", { method: "DELETE", body: { password } }),
  },

  newsletter: {
    recipients: () => apiRequest("/api/newsletter/recipients"),
    subscribe: (body: { email: string; name?: string }) => apiRequest("/api/newsletter/subscribe", { method: "POST", body }),
    unsubscribe: (body: { email: string }) => apiRequest("/api/newsletter/unsubscribe", { method: "POST", body }),
    preview: (limit = 5) => apiRequest(`/api/newsletter/preview${buildQuery({ limit })}`),
    sendDaily: (limit = 5) => apiRequest(`/api/newsletter/send-daily${buildQuery({ limit })}`, { method: "POST" }),
    test: (to_email: string, draft?: Record<string, any>, subject?: string) => apiRequest("/api/newsletter/test", { method: "POST", body: { to_email, draft, subject } }),
    aiSubscribe: (body: { email: string; name?: string; source?: string; metadata?: Record<string, unknown> }) =>
      apiRequest("/api/newsletter/ai-subscribe", { method: "POST", body }),
    getDraft: () =>
      apiRequest<{ draft: Record<string, any> | null }>("/api/newsletter/draft"),
    saveDraft: (draft: Record<string, any>) =>
      apiRequest<{ saved: boolean; doc_id: string }>("/api/newsletter/draft/save", { method: "POST", body: draft }),
    generateChart: (body: { article_id: string; title: string; summary?: string; domain?: string }) =>
      apiRequest<{ chart_image_url: string; explanation: string; article_id: string }>(
        "/api/newsletter/draft/chart", { method: "POST", body }
      ),
    generateCoverStory: (body: {
      article_id: string; title: string; content?: string; summary?: string;
      domain?: string; article_url?: string; fetched_at?: string; matched_domains?: string[];
    }) =>
      apiRequest<{
        article_id: string; headline: string; standfirst: string;
        body_paragraphs: string[]; pull_quote: string;
        key_stats: Array<{ label: string; value: string; context: string }>;
        chart_data: Record<string, any>; chart_subject: string;
        closing_line: string; reading_time_min: number;
        domain: string; formatted_summary: string;
      }>("/api/newsletter/draft/cover-story", { method: "POST", body }),
    generateCoverStoryChart: (body: {
      article_id: string; title: string; content?: string; summary?: string;
      domain?: string; article_url?: string; fetched_at?: string; matched_domains?: string[];
    }) =>
      apiRequest<{
        article_id: string; chart_image_url: string; explanation: string;
        chart_type: string; success: boolean; error: string;
      }>("/api/newsletter/draft/cover-story-chart", { method: "POST", body }),
    previewDraft: (draft: Record<string, any>) =>
      apiRequest<{ html: string; subject: string; articles_included: number }>(
        "/api/newsletter/preview-draft", { method: "POST", body: draft }
      ),
    sendCustom: (draft: Record<string, any>) =>
      apiRequest<{ sent: number; failed: number; total_subscribers: number; log_id: string }>(
        "/api/newsletter/send-custom", { method: "POST", body: draft }
      ),
  },

  public: {
    aiContext: () => apiRequest("/api/public/ai-context"),
    siteInfo: () => apiRequest("/api/public/site-info"),
  },

  articles: {
    sources: () => apiRequest("/api/sources"),
    list: (params?: Record<string, unknown>) => apiRequest(`/api/articles${buildQuery(params)}`),
    forMe: () => apiRequest("/api/articles/for-me"),
    get: (id: string) => apiRequest(`/api/articles/${encodeURIComponent(id)}`),
    create: (body: { title: string; content: string; url?: string; source?: string; topic?: string }) =>
      apiRequest("/api/articles", { method: "POST", body }),
    refresh: (body: { domains?: string[]; target?: number }) => apiRequest("/api/articles/refresh", { method: "POST", body }),
    refreshCheck: (since_hours = 24) => apiRequest(`/api/articles/refresh/check${buildQuery({ since_hours })}`),
    fetch: (body: { topic?: string; keywords?: string[]; limit?: number }) => apiRequest("/api/articles/fetch", { method: "POST", body }),
    fetchSource: (body: { url: string; limit?: number }) => apiRequest("/api/articles/fetch-source", { method: "POST", body }),
    pipeline: (body: { topic?: string; keywords?: string[]; limit?: number }) => apiRequest("/api/pipeline", { method: "POST", body }),
    generateInsight: (articleId: string, force = false) =>
      apiRequest(`/api/articles/${encodeURIComponent(articleId)}/generate-insight${buildQuery({ force })}`, { method: "POST" }),
  },

  insights: {
    status: () => apiRequest("/api/articles/insights/status"),
    list: () => apiRequest("/api/insights"),
    get: (articleId: string) => apiRequest(`/api/insights/${encodeURIComponent(articleId)}`),
    clear: (articleId: string) => apiRequest(`/api/articles/${encodeURIComponent(articleId)}/insight`, { method: "DELETE" }),
    process: (batch_size = 2) => apiRequest("/api/articles/insights/process", { method: "POST", body: { batch_size } }),
    queue: () => apiRequest("/api/articles/insights/queue"),
    clearQueue: () => apiRequest("/api/articles/insights/queue", { method: "DELETE" }),
  },

  feed: {
    fromSelection: (body: { selected_text: string; uid?: string; source_article_id?: string }) =>
      apiRequest("/api/feed/from-selection", { method: "POST", body }),
    items: () => apiRequest("/api/feed/items"),
    get: (id: string) => apiRequest(`/api/feed/items/${encodeURIComponent(id)}`),
    delete: (id: string) => apiRequest(`/api/feed/items/${encodeURIComponent(id)}`, { method: "DELETE" }),
    insight: (id: string) => apiRequest(`/api/feed/items/${encodeURIComponent(id)}/insight`, { method: "POST" }),
  },

  content: {
    uploadImage: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest("/api/images/upload", { method: "POST", formData });
    },
    explainers: () => apiRequest("/api/explainers"),
    explainer: (id: string) => apiRequest(`/api/explainers/${encodeURIComponent(id)}`),
    createExplainer: (body: Record<string, unknown>) => apiRequest("/api/explainers", { method: "POST", body }),
    createExplainerWithImage: (body: Record<string, string>, file: File) => {
      const formData = new FormData();
      Object.entries(body).forEach(([key, value]) => formData.append(key, value));
      formData.append("image", file);
      return apiRequest("/api/explainers/create-with-image", { method: "POST", formData });
    },
    updateExplainer: (id: string, body: Record<string, unknown>) => apiRequest(`/api/explainers/${encodeURIComponent(id)}`, { method: "PUT", body }),
    deleteExplainer: (id: string) => apiRequest(`/api/explainers/${encodeURIComponent(id)}`, { method: "DELETE" }),
    uploadExplainerImage: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return apiRequest(`/api/explainers/${encodeURIComponent(id)}/image`, { method: "POST", formData });
    },
    researchFields: () => apiRequest("/api/research/fields"),
    researchImages: () => apiRequest("/api/research/images"),
    researchArticles: () => apiRequest("/api/research/articles"),
    researchArticle: (id: string) => apiRequest(`/api/research/articles/${encodeURIComponent(id)}`),
    createResearch: (body: Record<string, unknown>) => apiRequest("/api/research/articles", { method: "POST", body }),
    createResearchWithImage: (body: Record<string, string>, file: File) => {
      const formData = new FormData();
      // body may include references and citations as JSON strings
      Object.entries(body).forEach(([key, value]) => formData.append(key, value));
      formData.append("image", file);
      return apiRequest("/api/research/articles/create-with-image", { method: "POST", formData });
    },
    updateResearch: (id: string, body: Record<string, unknown>) => apiRequest(`/api/research/articles/${encodeURIComponent(id)}`, { method: "PUT", body }),
    deleteResearch: (id: string) => apiRequest(`/api/research/articles/${encodeURIComponent(id)}`, { method: "DELETE" }),
    uploadResearchImage: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return apiRequest(`/api/research/articles/${encodeURIComponent(id)}/image`, { method: "POST", formData });
    },
    blogPosts: () => apiRequest("/api/blog"),
    blogPost: (id: string) => apiRequest(`/api/blog/${encodeURIComponent(id)}`),
    createBlogPost: (body: Record<string, unknown>) => apiRequest("/api/blog", { method: "POST", body }),
    updateBlogPost: (id: string, body: Record<string, unknown>) => apiRequest(`/api/blog/${encodeURIComponent(id)}`, { method: "PUT", body }),
    deleteBlogPost: (id: string) => apiRequest(`/api/blog/${encodeURIComponent(id)}`, { method: "DELETE" }),
    uploadBlogCover: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return apiRequest(`/api/blog/${encodeURIComponent(id)}/cover-image`, { method: "POST", formData });
    },
    /** POST /api/blog/content-image — upload an inline image inserted into the
     *  RichTextEditor body and get back a permanent Cloudinary CDN URL.
     *  Called immediately when the user picks/drops/pastes an image so the
     *  saved markdown stores https://res.cloudinary.com/... not a blob: URL.
     */
    uploadBlogContentImage: (formData: FormData) =>
      apiRequest<{ url: string }>("/api/blog/content-image", { method: "POST", formData }),
    cmsExplainers: () => apiRequest("/api/cms/explainers"),
    cmsExplainer: (id: string) => apiRequest(`/api/cms/explainers/${encodeURIComponent(id)}`),
    cmsResearch: () => apiRequest("/api/cms/research"),
    cmsResearchArticle: (id: string) => apiRequest(`/api/cms/research/${encodeURIComponent(id)}`),
    cmsBlog: () => apiRequest("/api/cms/blog"),
    cmsBlogPost: (id: string) => apiRequest(`/api/cms/blog/${encodeURIComponent(id)}`),

    // Live Intelligence Network
    intelligenceNodes: (params?: { domain?: string; sentiment?: string; tag?: string; limit?: number }) =>
      apiRequest(`/api/intelligence/nodes${buildQuery(params)}`),
    intelligenceNode: (id: string) => apiRequest(`/api/intelligence/nodes/${encodeURIComponent(id)}`),
    createIntelligenceNode: (body: Record<string, unknown>) =>
      apiRequest("/api/intelligence/nodes", { method: "POST", body }),
    updateIntelligenceNode: (id: string, body: Record<string, unknown>) =>
      apiRequest(`/api/intelligence/nodes/${encodeURIComponent(id)}`, { method: "PUT", body }),
    deleteIntelligenceNode: (id: string) =>
      apiRequest(`/api/intelligence/nodes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    cmsIntelligence: () => apiRequest("/api/cms/intelligence"),
    cmsIntelligenceNode: (id: string) => apiRequest(`/api/cms/intelligence/${encodeURIComponent(id)}`),
  },

  simulations: {
    list: (params?: { field?: string; simulation_type?: string }) =>
      apiRequest(`/api/simulations${buildQuery(params)}`),
    get: (id: string) =>
      apiRequest(`/api/simulations/${encodeURIComponent(id)}`),
    create: (body: {
      id:              string;
      title:           string;
      field?:          string;
      fieldColor?:     string;
      description?:    string;
      caption?:        string;
      readTime?:       string;
      simulation_type?: string;
      component_id?:   string;
      insights?:       string[];
      tags?:           string[];
    }) => apiRequest("/api/simulations", { method: "POST", body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest(`/api/simulations/${encodeURIComponent(id)}`, { method: "PUT", body }),
    delete: (id: string) =>
      apiRequest(`/api/simulations/${encodeURIComponent(id)}`, { method: "DELETE" }),
    uploadSnapshot: (id: string, imageData: string) =>
      apiRequest(`/api/simulations/${encodeURIComponent(id)}/snapshot`, {
        method: "POST",
        body: { image_data: imageData },
      }),
    uploadGlb: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest(`/api/simulations/${encodeURIComponent(id)}/glb`, {
        method: "POST",
        formData,
      });
    },
    seed: () => apiRequest("/api/simulations/seed", { method: "POST" }),
    cmsList: () => apiRequest("/api/cms/simulations"),
    cmsGet: (id: string) => apiRequest(`/api/cms/simulations/${encodeURIComponent(id)}`),
  },

  diary: {
    create: (body: { popup_type: string; popup_id: string; title: string; selected_text: string; note?: string }) =>
      apiRequest("/api/diary", { method: "POST", body }),
    list: () => apiRequest("/api/diary"),
    get: (id: string) => apiRequest(`/api/diary/${encodeURIComponent(id)}`),
    update: (id: string, body: { title?: string; note?: string }) => apiRequest(`/api/diary/${encodeURIComponent(id)}`, { method: "PUT", body }),
    delete: (id: string) => apiRequest(`/api/diary/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  dashboard: {
    /** POST /api/dashboard/event — log a popup open (v2).
     *  Returns the full enriched event document including `id`.
     *  Store the returned `id` and send it to patchDuration() on close.
     */
    event: (body: {
      popup_type:  string;
      popup_id:    string;
      popup_title?: string;
      device_type?: string;
      // NOTE: read_duration_seconds is no longer accepted here.
      // Use patchDuration(eventId, seconds) when the popup closes instead.
    }) => apiRequest("/api/dashboard/event", { method: "POST", body }),

    /**
     * PATCH /api/dashboard/event/{id}/duration
     * Called when a popup CLOSES. Updates the existing open-event document
     * with read_duration_seconds — no duplicate row created.
     * Minimum 2 s, maximum 7200 s (enforced server-side too).
     */
    patchDuration: (eventId: string, read_duration_seconds: number) =>
      apiRequest(`/api/dashboard/event/${encodeURIComponent(eventId)}/duration`, {
        method: 'PATCH',
        body: { read_duration_seconds },
      }),

    /** GET /api/dashboard/me — own activity summary */
    me: () => apiRequest("/api/dashboard/me"),

    /** GET /api/dashboard/subject-intelligence */
    subjectIntelligence: (params?: { limit?: number }) =>
      apiRequest(`/api/dashboard/subject-intelligence${buildQuery(params)}`),

    /** GET /api/dashboard/admin — platform-wide stats */
    admin: () => apiRequest("/api/dashboard/admin"),

    /**
     * GET /api/dashboard/admin/events — raw event log
     * New filters in v2: subject, date_from, date_to
     */
    events: (params?: {
      limit?: number;
      popup_type?: string;
      uid_filter?: string;
      subject?: string;
      date_from?: string;
      date_to?: string;
    }) => apiRequest(`/api/dashboard/admin/events${buildQuery(params)}`),

    /**
     * GET /api/dashboard/admin/export-csv — download enriched events as CSV.
     * Triggers a browser file-save dialog. Returns { rowCount }.
     * Supports the same filters as /admin/events.
     */
    exportCsv: (
      params: {
        popup_type?: string;
        uid_filter?: string;
        subject?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
      } = {},
      filename?: string
    ) => {
      const qs = buildQuery(params);
      const today = new Date().toISOString().slice(0, 10);
      return apiDownloadCsv(
        `/api/dashboard/admin/export-csv${qs}`,
        filename ?? `steami_events_${today}.csv`
      );
    },

    /**
     * GET /api/dashboard/admin/export-csv — preview only (no file save).
     * Returns raw CSV text so the UI can render a table.
     */
    previewCsv: (
      params: {
        popup_type?: string;
        uid_filter?: string;
        subject?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
      } = {}
    ) => {
      const qs = buildQuery(params);
      return apiFetchCsvText(`/api/dashboard/admin/export-csv${qs}`);
    },

    /**
     * GET /api/dashboard/admin/user-profiles — per-user interest profiles.
     * Used for recommendation model seeding.
     */
    userProfiles: (params?: { limit?: number }) =>
      apiRequest(`/api/dashboard/admin/user-profiles${buildQuery(params)}`),

    /**
     * GET /api/dashboard/admin/content-heatmap — content × subject matrix.
     * Used for recommendation model seeding.
     */
    contentHeatmap: (params?: { limit?: number }) =>
      apiRequest(`/api/dashboard/admin/content-heatmap${buildQuery(params)}`),
  },

  security: {
    stats: () => apiRequest("/api/security/stats"),
    ban: (ip: string) => apiRequest(`/api/security/ban/${encodeURIComponent(ip)}`, { method: "POST" }),
    unban: (ip: string) => apiRequest(`/api/security/ban/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    clearTempBans: () => apiRequest("/api/security/temp-bans", { method: "DELETE" }),
  },

  /**
   * Visitor tracking — unique IPs that have hit the backend.
   * All endpoints are ADMIN ONLY.
   */
  visitors: {
    /** GET /api/visitors — list all unique IP visitor records, newest first. */
    list: (params?: {
      limit?: number;
      skip?: number;
      /** true = logged-in visitors only, false = unknown/guest only, omit = all */
      logged_in?: boolean;
    }) => apiRequest(`/api/visitors${buildQuery(params)}`),

    /** GET /api/visitors/stats — aggregated counts + top 5 most-frequent IPs. */
    stats: () => apiRequest("/api/visitors/stats"),

    /** DELETE /api/visitors/{ip} — remove a visitor record by IP address. */
    delete: (ip: string) =>
      apiRequest(`/api/visitors/${encodeURIComponent(ip)}`, { method: "DELETE" }),
  },

  chat: {
    upsertUser: (body: { id: string; username: string; avatar?: string; email?: string }) => apiRequest("/api/chat/users", { method: "POST", body }),
    users: () => apiRequest("/api/chat/users"),
    discoverUsers: (params: { uid: string; q?: string }) => apiRequest(`/users/discover${buildQuery(params)}`),
    user: (uid: string) => apiRequest(`/api/chat/users/${encodeURIComponent(uid)}`),
    sendMessage: (body: { senderId: string; receiverId: string; text: string }) => apiRequest("/api/chat/messages", { method: "POST", body }),
    messages: (params?: Record<string, unknown>) => apiRequest(`/api/chat/messages${buildQuery(params)}`),
    markSeen: (body: { receiverId: string; senderId: string }) => apiRequest("/api/chat/messages/seen", { method: "PATCH", body }),
    conversations: (params?: Record<string, unknown>) => apiRequest(`/api/chat/conversations${buildQuery(params)}`),
    unread: (params?: Record<string, unknown>) => apiRequest(`/api/chat/unread${buildQuery(params)}`),
  },

  notifications: {
    latest: (since?: string | null, limit = 20) =>
      apiRequest(`/api/notifications/latest${buildQuery({ since: since ?? undefined, limit })}`),
  },
};
