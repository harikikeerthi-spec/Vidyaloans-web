/**
 * Centralized API client for all backend requests
 */

// Relative path: works on localhost, Cloudflare tunnels, and production alike.
// Next.js rewrites /api/* → http://localhost:5000/* on the server side.
import { HTTP_API_PREFIX, HttpApiPaths } from "./http-api-paths";

const API_URL = HTTP_API_PREFIX;

export type TokenChangeCallback = (token: string | null) => void;
const tokenChangeListeners = new Set<TokenChangeCallback>();

export function subscribeToTokenChange(callback: TokenChangeCallback) {
    tokenChangeListeners.add(callback);
    return () => {
        tokenChangeListeners.delete(callback);
    };
}

export function notifyTokenChange(token: string | null) {
    tokenChangeListeners.forEach(cb => cb(token));
}

type Portal = "student" | "staff" | "admin" | "bank" | "agent" | "it";

function getPortalFromPathname(pathname?: string): Portal {
    if (!pathname) return "student";
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/staff")) return "staff";
    if (pathname.startsWith("/bank")) return "bank";
    if (pathname.startsWith("/agent")) return "agent";
    if (pathname.startsWith("/it")) return "it";
    return "student";
}

function getStorageKeys(portal: Portal) {
    if (portal === "admin") {
        return {
            token: "adminAccessToken",
            refreshToken: "adminRefreshToken",
            email: "adminUserEmail",
            userId: "adminUserId",
            user: "adminAuthUser",
            loginPath: "/admin/login",
        };
    }
    if (portal === "staff") {
        return {
            token: "staffAccessToken",
            refreshToken: "staffRefreshToken",
            email: "staffUserEmail",
            userId: "staffUserId",
            user: "staffAuthUser",
            loginPath: "/staff/login",
        };
    }
    if (portal === "bank") {
        return {
            token: "bankAccessToken",
            refreshToken: "bankRefreshToken",
            email: "bankUserEmail",
            userId: "bankUserId",
            user: "bankAuthUser",
            loginPath: "/bank/login",
        };
    }
    if (portal === "agent") {
        return {
            token: "agentAccessToken",
            refreshToken: "agentRefreshToken",
            email: "agentUserEmail",
            userId: "agentUserId",
            user: "agentAuthUser",
            loginPath: "/agent/login",
        };
    }
    if (portal === "it") {
        return {
            token: "itAccessToken",
            refreshToken: "itRefreshToken",
            email: "itUserEmail",
            userId: "itUserId",
            user: "itAuthUser",
            loginPath: "/it",
        };
    }
    return {
        token: "accessToken",
        refreshToken: "refreshToken",
        email: "userEmail",
        userId: "userId",
        user: "authUser",
        loginPath: "/login",
    };
}

function clearAllPortalAuthStorage() {
    const portals: Portal[] = ["student", "staff", "admin", "bank", "agent"];
    for (const portal of portals) {
        const keys = getStorageKeys(portal);
        localStorage.removeItem(keys.token);
        localStorage.removeItem(keys.refreshToken);
        localStorage.removeItem(keys.email);
        localStorage.removeItem(keys.userId);
        localStorage.removeItem(keys.user);
    }
}

// ─── Agent ────────────────────────────────────────────────────────────
export const agentApi = {
    getStats: () =>
        apiFetch(`${API_URL}/dashboard/summary`),
    getApplications: (params?: { search?: string; status?: string; loanType?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams();
        if (params?.search) query.append("search", params.search);
        if (params?.status) query.append("status", params.status);
        if (params?.loanType) query.append("loanType", params.loanType);
        if (params?.page) query.append("page", String(params.page));
        if (params?.limit) query.append("limit", String(params.limit));
        const queryString = query.toString();
        return apiFetch(`${API_URL}/leads${queryString ? `?${queryString}` : ""}`);
    },
    createLead: (data: any) =>
        apiFetch(`${API_URL}/leads`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getActivityFeed: () =>
        apiFetch(`${API_URL}/dashboard/activity-feed`),
    getActionItems: () =>
        apiFetch(`${API_URL}/dashboard/action-items`),
    getPipeline: () =>
        apiFetch(`${API_URL}/dashboard/pipeline`),
    checkEligibility: (data: any) =>
        apiFetch(`${API_URL}/eligibility/check`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getLeadDetail: (id: string) =>
        apiFetch(`${API_URL}/leads/${id}`),
    getLeadChecklist: (id: string) =>
        apiFetch(`${API_URL}/leads/${id}/checklist`),
    shareUploadLink: (id: string, data: any) =>
        apiFetch(`${API_URL}/leads/${id}/share-upload-link`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getCommissionsSummary: () =>
        apiFetch(`${API_URL}/commissions/summary`),
    getCommissionsLedger: () =>
        apiFetch(`${API_URL}/commissions/ledger`),
    getCommissionsPayouts: () =>
        apiFetch(`${API_URL}/commissions/payouts`),
    getCommissionsRateCard: () =>
        apiFetch(`${API_URL}/commissions/rate-card`),
    getMe: () =>
        apiFetch(`${API_URL}/agents/me`),
    updateContact: (data: any) =>
        apiFetch(`${API_URL}/agents/me/contact`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getKyc: () =>
        apiFetch(`${API_URL}/kyc`),
    submitKyc: (data: any) =>
        apiFetch(`${API_URL}/kyc`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getKycDocuments: () =>
        apiFetch(`${API_URL}/kyc/documents`),
    getBankAccount: () =>
        apiFetch(`${API_URL}/bank-account`),
    updateBankAccount: (data: any) =>
        apiFetch(`${API_URL}/bank-account`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getAgreements: () =>
        apiFetch(`${API_URL}/agreements`),
    getSupportTickets: () =>
        apiFetch(`${API_URL}/support/tickets`),
    createSupportTicket: (data: any) =>
        apiFetch(`${API_URL}/support/tickets`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getChatMessages: (staffId: string) =>
        apiFetch(`${API_URL}/chat/${staffId}`),
    sendChatMessage: (staffId: string, data: { content: string }) =>
        apiFetch(`${API_URL}/chat/${staffId}`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    createTask: (data: any) =>
        apiFetch<any>(`${API_URL}/tasks`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getTasks: () =>
        apiFetch<any>(`${API_URL}/tasks`),
    completeTask: (taskId: string, completed: boolean) =>
        apiFetch<any>(`${API_URL}/tasks/${taskId}/complete`, {
            method: "POST",
            body: JSON.stringify({ completed }),
        }),
    createBtLead: (data: any) =>
        apiFetch<any>(`${API_URL}/bt-leads`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    bulkImport: (leads: any[]) =>
        apiFetch<any>(`${API_URL}/leads/bulk-import`, {
            method: "POST",
            body: JSON.stringify({ leads }),
        }),
    inviteSubAgent: (data: any) =>
        apiFetch<any>(`${API_URL}/sub-agents/invite`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getSubAgents: () =>
        apiFetch<any>(`${API_URL}/sub-agents`),
    getTrainingModules: () =>
        apiFetch<any>(`${API_URL}/training/modules`),
    completeTrainingModule: (id: string) =>
        apiFetch<any>(`${API_URL}/training/modules/${id}/complete`, {
            method: "POST",
        }),
    getQrCode: () =>
        apiFetch<any>(`${API_URL}/qr/my-code`),
    getQrScanAnalytics: () =>
        apiFetch<any>(`${API_URL}/qr/scan-analytics`),
    getBtLeads: () =>
        apiFetch<any>(`${API_URL}/bt-leads`),
    getTrackingLink: (id: string) =>
        apiFetch<any>(`${API_URL}/leads/${id}/tracking-link`),
    createTrackingLink: (id: string) =>
        apiFetch<any>(`${API_URL}/leads/${id}/tracking-link`, {
            method: "POST",
        }),
    getAlumni: () =>
        apiFetch<any>(`${API_URL}/alumni`),
    getAlumniReferralLink: (id: string) =>
        apiFetch<any>(`${API_URL}/alumni/${id}/referral-link`),
    getReferralAnalytics: () =>
        apiFetch<any>(`${API_URL}/referrals/analytics`),
};

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    const portal = getPortalFromPathname(window.location.pathname);
    const keys = getStorageKeys(portal);

    // 1. Try portal-specific token
    const portalToken = localStorage.getItem(keys.token);
    if (portalToken) return portalToken;

    // 2. If student portal, check standard user token key aliases ONLY
    if (portal === "student") {
        return localStorage.getItem("token") || localStorage.getItem("userToken") || localStorage.getItem("jwt") || null;
    }

    return null;
}

function isPublicAuthUrl(url?: string): boolean {
    if (!url) return false;
    return (
        url.includes('/auth/send-otp') ||
        url.includes('/auth/verify-otp') ||
        url.includes('/auth/firebase') ||
        url.includes('/auth/check-user/') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/landing-page-submit') ||
        url.includes('/auth/logout') ||
        url.includes('/auth/dashboard')
    );
}

function authHeaders(url?: string): HeadersInit {
    // Exclude Authorization header for public endpoints to avoid gateway/proxy 401s from stale local tokens
    const isPublic = isPublicAuthUrl(url);

    const token = isPublic ? null : getToken();
    const headers: Record<string, string> = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };

    if (typeof window !== "undefined") {
        const selectedBankId = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
        if (selectedBankId) {
            const bankNameMap: Record<string, string> = {
                auxilo: "Auxilo Finserve",
                avanse: "Avanse Financial",
                credila: "HDFC Credila",
                idfc: "IDFC FIRST Bank",
                poonawalla: "Poonawalla Fincorp",
            };
            const mappedBankName = bankNameMap[selectedBankId];
            if (mappedBankName) {
                headers["x-selected-bank"] = mappedBankName;
            }
        }
    }
    return headers;
}

/** Attempt a silent token refresh — only called when an API request returns 401 */
async function tryRefreshAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;

    const portal = getPortalFromPathname(window.location.pathname);
    const keys = getStorageKeys(portal);
    const refreshToken =
        localStorage.getItem(keys.refreshToken) ||
        localStorage.getItem("adminRefreshToken") ||
        localStorage.getItem("staffRefreshToken") ||
        localStorage.getItem("refreshToken");

    if (!refreshToken) return null;

    try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshRes.ok) return null;

        const data = await refreshRes.json();
        const newToken = data.access_token || data.accessToken;
        if (!newToken) return null;

        localStorage.setItem(keys.token, newToken);
        if (data.refresh_token) {
            localStorage.setItem(keys.refreshToken, data.refresh_token);
        }
        notifyTokenChange(newToken);
        return newToken;
    } catch {
        return null;
    }
}

function notifySessionExpired() {
    if (typeof window === "undefined") return;

    const portal = getPortalFromPathname(window.location.pathname);
    const { loginPath } = getStorageKeys(portal);
    if (window.location.pathname.startsWith(loginPath)) return;

    clearAllPortalAuthStorage();
    notifyTokenChange(null);
    window.dispatchEvent(
        new CustomEvent("auth:session-expired", { detail: { loginPath } })
    );
}

let cachedCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

/**
 * Synchronize CSRF token with backend Double-Submit Cookie protection
 */
export async function initializeCsrf(forceRefresh = false): Promise<string | null> {
    if (typeof window === "undefined") return null;
    if (cachedCsrfToken && !forceRefresh) {
        return cachedCsrfToken;
    }
    if (csrfFetchPromise && !forceRefresh) {
        return csrfFetchPromise;
    }

    csrfFetchPromise = (async () => {
        try {
            const res = await fetch(`${API_URL}/csrf-token`, {
                method: "GET",
                credentials: "include",
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.csrfToken) {
                cachedCsrfToken = data.csrfToken;
                return data.csrfToken;
            }
            return null;
        } catch {
            return null;
        } finally {
            csrfFetchPromise = null;
        }
    })();

    return csrfFetchPromise;
}

export function getCsrfToken(): string | null {
    return cachedCsrfToken;
}

/**
 * Enhanced fetch wrapper — automatically handles authorization tokens, CSRF double-cookie headers, and silent refreshes
 */
export async function apiFetch<T>(
    url: string,
    options: RequestInit = {},
    retried = false
): Promise<T> {
    const method = (options.method || "GET").toUpperCase();
    const isStateMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    const headersObj: Record<string, string> = {
        ...(authHeaders(url) as Record<string, string>),
        ...(options.headers as Record<string, string>),
    };

    if (isStateMutating) {
        let token = cachedCsrfToken;
        if (!token) {
            token = await initializeCsrf();
        }
        if (token) {
            headersObj["X-CSRF-Token"] = token;
        }
    }

    const res = await fetch(url, {
        ...options,
        credentials: options.credentials || "include",
        headers: headersObj,
    });

    // Handle 403 CSRF mismatch retry once with a fresh token
    if (res.status === 403 && isStateMutating && !retried) {
        const freshToken = await initializeCsrf(true);
        if (freshToken) {
            headersObj["X-CSRF-Token"] = freshToken;
            return apiFetch<T>(
                url,
                {
                    ...options,
                    credentials: options.credentials || "include",
                    headers: headersObj,
                },
                true
            );
        }
    }

    if (res.status === 401 && !retried && !isPublicAuthUrl(url)) {
        const newToken = await tryRefreshAccessToken();
        if (newToken) {
            return apiFetch<T>(
                url,
                {
                    ...options,
                    credentials: options.credentials || "include",
                    headers: {
                        ...headersObj,
                        Authorization: `Bearer ${newToken}`,
                        "Content-Type": "application/json",
                    },
                },
                true
            );
        }
    }

    return handleResponse<T>(res, url, retried);
}

async function handleResponse<T>(res: Response, url?: string, alreadyRetried = false): Promise<T> {
    const contentType = res.headers.get("content-type");
    let body: any;

    if (contentType && contentType.includes("application/json")) {
        body = await res.json();
    } else {
        body = await res.text();
    }

    console.log(`[API Response] ${res.status} ${res.url}`, {
        ok: res.ok,
        contentType,
        body,
        bodyKeys: typeof body === 'object' ? Object.keys(body) : 'not-an-object'
    });

    if (!res.ok) {
        console.error(`API Error: ${res.status} ${res.url}`, body);
        let err: any;
        try {
            err = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (e) {
            // Check if response is HTML or contains HTML markup to avoid leaking raw HTML into the UI
            const isHtml = (contentType && contentType.includes("text/html")) || 
                           (typeof body === 'string' && (body.trim().startsWith('<') || body.toLowerCase().includes('<html')));
            err = { 
                message: isHtml 
                    ? `An unexpected server error occurred (Status ${res.status}). Please try again.` 
                    : (body || res.statusText) 
            };
        }

        // Session expired — soft redirect via AuthContext (no full page reload)
        if (res.status === 401 && !isPublicAuthUrl(url) && !alreadyRetried) {
            notifySessionExpired();
        }

        throw new Error(err.message || "API request failed");
    }

    return body as T;
}

/**
 * Fetch wrapper for binary responses (blobs) with proper error handling
 */
async function fetchBlob(
    url: string,
    options: RequestInit = {},
    retried = false
): Promise<Blob> {
    const token = getToken();
    const headers = token
        ? { Authorization: `Bearer ${token}`, ...options.headers }
        : options.headers;

    const res = await fetch(url, {
        ...options,
        headers,
    });

    if (res.status === 401 && !retried) {
        const newToken = await tryRefreshAccessToken();
        if (newToken) {
            return fetchBlob(
                url,
                {
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${newToken}`,
                    },
                },
                true
            );
        }
    }

    if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorMessage = `HTTP ${res.status}`;

        try {
            if (contentType?.includes("application/json")) {
                const errorBody = await res.json();
                errorMessage = errorBody.message || errorMessage;
            } else {
                const errorText = await res.text();
                if (errorText) errorMessage = errorText;
            }
        } catch (e) {
            // Unable to parse error response
        }

        // Session expired — soft redirect via AuthContext
        if (res.status === 401 && !retried) {
            notifySessionExpired();
        }

        throw new Error(`Failed to fetch document: ${errorMessage}`);
    }

    return res.blob();
}

// ─── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
    sendOtp: (email: string, portal?: string) =>
        apiFetch(HttpApiPaths.auth.sendOtp(), {
            method: "POST",
            body: JSON.stringify({ email, portal }),
        }),

    requestOtp: (email: string, portal?: string) =>
        apiFetch(`${API_URL}/auth/request-otp`, {
            method: "POST",
            body: JSON.stringify({ email, portal: portal || "agent" }),
        }),

    verifyOtp: (email: string, otp: string, referralCode?: string) =>
        apiFetch(HttpApiPaths.auth.verifyOtp(), {
            method: "POST",
            body: JSON.stringify({ email, otp, referralCode }),
        }),

    firebaseLogin: (idToken: string) =>
        apiFetch(HttpApiPaths.auth.firebase(), {
            method: "POST",
            body: JSON.stringify({ idToken }),
        }),

    refresh: async (refreshToken: string) => {
        const res = await fetch(HttpApiPaths.auth.refresh(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const body = await res.json();
        if (!res.ok) {
            throw new Error(body.message || "Token refresh failed");
        }
        return body;
    },

    logout: (email: string) =>
        apiFetch(HttpApiPaths.auth.logout(), {
            method: "POST",
            body: JSON.stringify({ email }),
        }),

    getDashboard: (email: string) =>
        apiFetch(HttpApiPaths.auth.dashboard(), {
            method: "POST",
            body: JSON.stringify({ email }),
        }),

    getDashboardData: (userId: string) =>
        apiFetch(HttpApiPaths.auth.dashboardData(), {
            method: "POST",
            body: JSON.stringify({ userId }),
        }),

    updateDetails: (email: string, details: {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        passportNumber?: string;
        intakeSeason?: string;
        pincode?: string;
        targetUniversity?: string;
        studyDestination?: string;
        coApplicantPhone?: string;
        coApplicantEmail?: string;
        coApplicantRelation?: string;
        coApplicantIncome?: number;
        [key: string]: any;
    }) =>
        apiFetch(HttpApiPaths.auth.updateDetails(), {
            method: "POST",
            body: JSON.stringify({ email, ...details }),
        }),

    uploadDocument: (data: {
        userId: string;
        docType: string;
        uploaded: boolean;
        filePath?: string;
    }) =>
        apiFetch(HttpApiPaths.auth.uploadDocument(), {
            method: "POST",
            body: JSON.stringify(data),
        }),

    submitLandingPageApplication: (data: any) =>
        apiFetch(`${API_URL}/auth/landing-page-submit`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
};

// ─── Blogs ────────────────────────────────────────────────────────────
export const blogApi = {
    getAll: (page = 1, limit = 10) => {
        const offset = (page - 1) * limit;
        return apiFetch(`${API_URL}/blogs?offset=${offset}&limit=${limit}`);
    },

    getBySlug: (slug: string) =>
        apiFetch(`${API_URL}/blogs/${slug}`),

    create: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/blogs`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/blogs/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiFetch(`${API_URL}/blogs/${id}`, {
            method: "DELETE",
        }),
};

// ─── Community / Forum ───────────────────────────────────────────────
export const communityApi = {
    // Basic posts (legacy/alias)
    getPosts: (topic?: string, page = 1) =>
        apiFetch(`${API_URL}/community/posts?${topic ? `topic=${topic}&` : ""}page=${page}`),

    getPostBySlug: (slug: string) =>
        apiFetch(`${API_URL}/community/posts/${slug}`),

    createPost: (data: { title: string; content: string; category: string; force?: boolean }) =>
        apiFetch(`${API_URL}/community/posts`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Engagement
    addComment: (postId: string, content: string) =>
        apiFetch(`${API_URL}/community/posts/${postId}/comments`, {
            method: "POST",
            body: JSON.stringify({ content }),
        }),

    likePost: (postId: string) =>
        apiFetch(`${API_URL}/community/posts/${postId}/like`, {
            method: "POST",
        }),

    // New Forum structure
    getForumPosts: (params?: { category?: string; tag?: string; sort?: string; limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        if (params?.category) q.set('category', params.category);
        if (params?.tag) q.set('tag', params.tag);
        if (params?.sort) q.set('sort', params.sort);
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.offset) q.set('offset', String(params.offset));
        return apiFetch(`${API_URL}/community/forum?${q.toString()}`);
    },

    getForumPost: (id: string) =>
        apiFetch(`${API_URL}/community/forum/${id}`),

    likeForumPost: (postId: string) =>
        apiFetch(`${API_URL}/community/forum/${postId}/like`, {
            method: "POST",
        }),

    addForumComment: (postId: string, content: string, parentId?: string) =>
        apiFetch(`${API_URL}/community/forum/${postId}/comment`, {
            method: "POST",
            body: JSON.stringify({ content, parentId }),
        }),

    likeForumComment: (commentId: string) =>
        apiFetch(`${API_URL}/community/forum/comments/${commentId}/like`, {
            method: "POST",
        }),

    // Hubs, Stats, etc.
    getHubs: () => apiFetch(`${API_URL}/community/hubs`),

    getStats: () => apiFetch(`${API_URL}/community/stats`),

    checkDuplicate: (data: { title: string; content: string; category: string }) =>
        apiFetch(`${API_URL}/community/forum/check-duplicate`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    checkRelevance: (title: string, content: string) =>
        apiFetch(`${API_URL}/ai/check-relevance`, {
            method: "POST",
            body: JSON.stringify({ title, content }),
        }),

    searchSimilarPosts: (q: string) =>
        apiFetch(`${API_URL}/community/forum/search?q=${encodeURIComponent(q)}`),

    // Specialized data
    getMentors: (params?: { limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.offset) q.set('offset', String(params.offset));
        return apiFetch(`${API_URL}/community/mentors?${q.toString()}`);
    },

    getEvents: (params?: { limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.limit) q.set('limit', String(params.limit));
        return apiFetch(`${API_URL}/community/events?${q.toString()}`);
    },

    getStories: (params?: { limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.limit) q.set('limit', String(params.limit));
        return apiFetch(`${API_URL}/community/stories?${q.toString()}`);
    },
};

// ─── Explore ─────────────────────────────────────────────────────────
export const exploreApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? "?" + new URLSearchParams(params).toString() : "";
        return apiFetch(`${API_URL}/explore${query}`);
    },

    getUniversities: () =>
        apiFetch(`${API_URL}/explore/universities`),

    getCourses: () => apiFetch(`${API_URL}/explore/courses`),

    getScholarships: () =>
        apiFetch(`${API_URL}/explore/scholarships`),
};

// ─── Applications ─────────────────────────────────────────────────────
export const applicationApi = {
    create: (data: Record<string, unknown>) =>
        apiFetch(HttpApiPaths.auth.createApplication(), {
            method: "POST",
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiFetch(HttpApiPaths.auth.applicationById(id), {
            method: "DELETE",
        }),

    uploadBankStatement: (applicationId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch(`${API_URL}/applications/${applicationId}/upload-statement`, {
            method: 'POST',
            body: formData,
        });
    },
};

// ─── AI Tools ─────────────────────────────────────────────────────────
export const aiApi = {
    sopReview: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/sop-analysis`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    sopHumanize: (text: string) =>
        apiFetch(`${API_URL}/ai/humanize-sop`, {
            method: "POST",
            body: JSON.stringify({ text }),
        }),

    admitPredictor: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/predict-admission`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    gradeConverter: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/convert-grades`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    gradeAnalyzer: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/analyze-grades`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    loanEligibility: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/eligibility-check`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    compareUniversities: (uni1: string, uni2: string) =>
        apiFetch(`${API_URL}/ai/compare-universities`, {
            method: "POST",
            body: JSON.stringify({ uni1, uni2 }),
        }),

    compareShortlist: (shortlist: Array<{ name: string; course: string }>, profile: { bachelors?: string; workExp?: string; gpa?: string }) =>
        apiFetch(`${API_URL}/ai/compare-shortlist`, {
            method: "POST",
            body: JSON.stringify({ shortlist, profile }),
        }),

    searchAdvice: (query: string, type: 'university' | 'course', context?: any) =>
        apiFetch(`${API_URL}/ai/search-advice`, {
            method: "POST",
            body: JSON.stringify({ query, type, context }),
        }),

    suggestTags: (title: string) =>
        apiFetch(`${API_URL}/ai/suggest-tags`, {
            method: "POST",
            body: JSON.stringify({ title }),
        }),

    // Always use relative path; /api/ai-search is handled by the local Next.js frontend route.
    aiSearch: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai-search`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    validateUniversityCountry: (university: string, country: string) =>
        apiFetch(`${API_URL}/ai/validate-university-country`, {
            method: "POST",
            body: JSON.stringify({ university, country }),
        }),

    correctCountryName: (countryInput: string) =>
        apiFetch(`${API_URL}/ai/correct-country-name`, {
            method: "POST",
            body: JSON.stringify({ countryInput }),
        }),

    saveVisaReport: (data: Record<string, unknown>) =>
        apiFetch(`${API_URL}/ai/visa-interview/save-report`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
};

// ─── Reference Data ───────────────────────────────────────────────────
export const referenceApi = {
    getBanks: () => apiFetch(HttpApiPaths.reference.banks()),
    getBankBySlug: (slug: string) =>
        apiFetch(`${API_URL}/reference/banks/slug/${slug}`),
    getCountries: () =>
        apiFetch(HttpApiPaths.reference.countries()),
    createCountry: (data: any) =>
        apiFetch(HttpApiPaths.reference.countries(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    updateCountry: (id: string, data: any) =>
        apiFetch(`${API_URL}/reference/countries/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    deleteCountry: (id: string) =>
        apiFetch(`${API_URL}/reference/countries/${id}`, {
            method: "DELETE",
        }),
    getUniversities: () =>
        apiFetch(HttpApiPaths.reference.universities()),
    getPlatformStats: () =>
        apiFetch(`${API_URL}/reference/platform-stats`),
    getOffices: () =>
        apiFetch(HttpApiPaths.reference.offices()),
    createOffice: (data: { name: string; city: string; location: string }) =>
        apiFetch(HttpApiPaths.reference.offices(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    updateOffice: (id: string, data: any) =>
        apiFetch(HttpApiPaths.reference.officeById(id), {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    deleteOffice: (id: string) =>
        apiFetch(HttpApiPaths.reference.officeById(id), {
            method: "DELETE",
        }),
};

// ─── Onboarding ───────────────────────────────────────────────────────
export const onboardingApi = {
    submit: (data: Record<string, unknown>) =>
        apiFetch(HttpApiPaths.onboarding.root(), {
            method: "POST",
            body: JSON.stringify(data),
        }),

    getStatus: (userId: string) =>
        apiFetch(HttpApiPaths.onboarding.status(userId)),

    share: (data: { studentId: string; studentEmail: string; studentName: string; shareUrl: string }) =>
        apiFetch(HttpApiPaths.onboarding.share(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
};

// ─── Referral ─────────────────────────────────────────────────────────
export const referralApi = {
    // Get user's referral code (or create one if doesn't exist)
    getMyCode: () =>
        apiFetch(`${API_URL}/referral/my-code`),

    // Get referral statistics
    getStats: () =>
        apiFetch(`${API_URL}/referral/stats`),

    // Get list of referrals
    getList: (status?: string) => {
        const query = status ? `?status=${status}` : '';
        return apiFetch(`${API_URL}/referral/list${query}`);
    },

    // Validate a referral code
    validateCode: (code: string) =>
        apiFetch(`${API_URL}/referral/validate/${code}`),

    // Record a new referral (when someone signs up with code)
    recordReferral: (data: { referralCode: string; referredUserId: string }) =>
        apiFetch(`${API_URL}/referral/record`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Send referral invite email
    sendInvite: (email: string) =>
        apiFetch(`${API_URL}/referral/invite`, {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    // Get referral leaderboard
    getLeaderboard: (limit = 10) =>
        apiFetch(`${API_URL}/referral/leaderboard?limit=${limit}`),

    // Record a visit to a referral link
    recordVisit: (code: string) =>
        apiFetch(`${API_URL}/referral/visit/${code}`, {
            method: 'POST',
        }),

    // Get unified referral data for current user (stats, list, code)
    getMe: () =>
        apiFetch(`${API_URL}/referral/me`),

    // Get stats for admin dashboard
    getAdminStats: () =>
        apiFetch(`${API_URL}/referral/admin/stats`),

    // Get list of all referrals for admin
    getAdminList: (status?: string, search?: string, pendingPayout?: boolean) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        if (pendingPayout) params.set('pendingPayout', 'true');
        const query = params.toString();
        return apiFetch(`${API_URL}/referral/admin/list${query ? `?${query}` : ''}`);
    },

    // Override referral status manually
    overrideStatus: (id: string, status: string, reason?: string) =>
        apiFetch(`${API_URL}/referral/admin/override/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, reason }),
        }),
};

// ─── Admin ────────────────────────────────────────────────────────────
export const adminApi = {
    // Banks Management
    createBank: (data: any) =>
        apiFetch(`${API_URL}/reference/banks`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    updateBank: (id: string, data: any) =>
        apiFetch(`${API_URL}/reference/banks/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    deleteBank: (id: string) =>
        apiFetch(`${API_URL}/reference/banks/${id}`, {
            method: "DELETE",
        }),

    // Stats
    getBlogStats: () =>
        apiFetch(HttpApiPaths.admin.blogsStats()),
    getApplicationStats: (bankId?: string) =>
        apiFetch(`${API_URL}/applications/admin/stats${bankId ? `?bankId=${bankId}` : ''}`),
    getPortfolioAnalysis: (bankId?: string) =>
        apiFetch(`${API_URL}/admin/applications/portfolio/analysis${bankId ? `?bankId=${bankId}` : ''}`),
    getComplianceReport: (bankId?: string) =>
        apiFetch(`${API_URL}/admin/applications/compliance/report${bankId ? `?bankId=${bankId}` : ''}`),

    // Blogs
    getBlogs: (params?: Record<string, string>) =>
        apiFetch(HttpApiPaths.admin.blogsAll(params)),
    bulkUpdateBlogStatus: (blogIds: string[], isPublished: boolean) =>
        apiFetch(HttpApiPaths.admin.blogsBulkStatus(), {
            method: "POST",
            body: JSON.stringify({ blogIds, isPublished }),
        }),
    deleteBlog: (id: string) =>
        apiFetch(HttpApiPaths.admin.blogById(id), {
            method: "DELETE",
        }),
    createBlog: (data: any) =>
        apiFetch(HttpApiPaths.admin.blogsCreate(), {
            method: "POST",
            body: JSON.stringify(data),
        }),

    getUserStats: () =>
        apiFetch(HttpApiPaths.admin.usersStats()),

    // Users
    getUsers: (limit = 30, offset = 0, search = "", role = "") =>
        apiFetch(HttpApiPaths.admin.usersList(limit, offset, search, role)),
    updateUserRole: (email: string, role: string) =>
        apiFetch(HttpApiPaths.admin.makeAdmin(), {
            method: "POST",
            body: JSON.stringify({ email, role }),
        }),
    deleteUser: (id: string) =>
        apiFetch(HttpApiPaths.admin.userByAdminId(id), {
            method: "DELETE",
        }),
    getUserById: (id: string) =>
        apiFetch(HttpApiPaths.admin.userByAdminId(id), {
            method: "GET",
        }),

    // Applications
    getApplications: (params?: Record<string, string>) =>
        apiFetch(HttpApiPaths.admin.applicationsAll(params)),
    getApplication: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationById(id)),
    getApplicationTracking: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationTracking(id)),
    getApplicationDocuments: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationDocuments(id)),
    updateApplicationStatus: (id: string, data: Record<string, unknown>) =>
        apiFetch(HttpApiPaths.admin.applicationStatus(id), {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    updateApplication: (id: string, data: Record<string, unknown>) =>
        apiFetch(HttpApiPaths.admin.applicationUpdate(id), {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    updateFollowUp: (id: string, data: { date: string; time?: string; notes?: string; status?: string }) =>
        apiFetch(`${API_URL}/applications/${id}/follow-up`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    aiReviewApplication: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationAiReview(id), {
            method: "POST",
        }),
    deleteApplication: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationDelete(id), {
            method: "DELETE",
        }),
    shareApplication: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationShare(id), {
            method: "POST",
        }),
    syncVaultDocuments: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationSyncVault(id), {
            method: "POST",
        }),
    viewDocument: (applicationId: string, documentId: string): Promise<Blob> =>
        fetchBlob(HttpApiPaths.admin.applicationDocumentView(applicationId, documentId)),

    // Site Settings & Platform Config
    getSiteSettings: () =>
        apiFetch<any>(`${API_URL}/site-settings`),
    getPublicSiteSettings: () =>
        apiFetch<any>(`${API_URL}/site-settings/public`),
    updateSiteSettings: (data: any) =>
        apiFetch<any>(`${API_URL}/site-settings`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    resetSiteSettings: () =>
        apiFetch<any>(`${API_URL}/site-settings/reset-defaults`, {
            method: "POST",
        }),
    testDisposableEmail: (email: string) =>
        apiFetch<any>(`${API_URL}/site-settings/check-email`, {
            method: "POST",
            body: JSON.stringify({ email }),
        }),


    // Community
    getCommunityStats: () =>
        apiFetch(HttpApiPaths.admin.communityStats()),
    getForumPosts: (limit = 20, offset = 0) =>
        apiFetch(HttpApiPaths.admin.forumPostsAdmin(limit, offset)),
    getMentors: () =>
        apiFetch(HttpApiPaths.admin.mentors()),
    createMentor: (data: any) =>
        apiFetch(HttpApiPaths.admin.mentorsAdminCreate(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    deleteMentor: (id: string) =>
        apiFetch(HttpApiPaths.admin.mentorAdminDelete(id), {
            method: "DELETE",
        }),
    getCommunityResources: (params?: Record<string, string>) =>
        apiFetch(HttpApiPaths.admin.communityResources(params)),
    createCommunityResource: (data: any) =>
        apiFetch(HttpApiPaths.admin.communityResourcesAdminCreate(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    deleteCommunityResource: (id: string) =>
        apiFetch(HttpApiPaths.admin.communityResourceAdminDelete(id), {
            method: "DELETE",
        }),
    togglePinForumPost: (id: string, isPinned: boolean) =>
        apiFetch(HttpApiPaths.admin.forumPostPin(id), {
            method: "PUT",
            body: JSON.stringify({ isPinned }),
        }),
    deleteForumPost: (id: string) =>
        apiFetch(HttpApiPaths.admin.forumPostDelete(id), {
            method: "DELETE",
        }),
    getAuditLogs: (limit = 20) =>
        apiFetch(HttpApiPaths.admin.matrixLogs(limit)),
    sendEmail: (data: { to?: string; subject: string; content: string; role?: string; isBulk?: boolean }) =>
        apiFetch(HttpApiPaths.admin.sendEmail(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    createUser: (data: any) =>
        apiFetch(HttpApiPaths.admin.usersCreate(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    updateUserDetails: (data: { userId?: string; email: string; firstName: string; lastName: string; phoneNumber: string; dateOfBirth: string; targetUniversity?: string; studyDestination?: string; fatherName?: string; motherName?: string; family?: any; coApplicant?: any; academic?: any; passport?: any; officeId?: string; officeLocation?: string }) =>
        apiFetch(HttpApiPaths.admin.usersUpdateDetails(), {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getOffices: () =>
        referenceApi.getOffices(),
    createOffice: (data: { name: string; city: string; location: string }) =>
        referenceApi.createOffice(data),
    deleteOffice: (id: string) =>
        referenceApi.deleteOffice(id),

    updateUserStatus: (userId: string, status: string, rejectionReason?: string) =>
        apiFetch(HttpApiPaths.admin.usersUpdateStatus(), {
            method: "POST",
            body: JSON.stringify({ userId, status, rejectionReason }),
        }),

    getUserProfile: (email: string) =>
        apiFetch(HttpApiPaths.admin.usersProfile(), {
            method: "POST",
            body: JSON.stringify({ email }),
            headers: authHeaders(),
        }),

    addRemark: (id: string, data: { type: string; content: string }) =>
        apiFetch(HttpApiPaths.admin.applicationNotes(id), {
            method: 'POST',
            body: JSON.stringify(data),
            headers: authHeaders(),
        }),

    getRemarks: (id: string) =>
        apiFetch(HttpApiPaths.admin.applicationNotes(id), {
            headers: authHeaders(),
        }),

    verifyDocument: (applicationId: string, documentId: string, status: string, rejectionReason?: string) =>
        apiFetch(HttpApiPaths.admin.documentVerify(documentId), {
            method: 'PUT',
            body: JSON.stringify({ status, rejectionReason }),
            headers: authHeaders(),
        }),
};

// ─── Documents ────────────────────────────────────────────────────────
export const documentApi = {
    getUsersDocuments: (userId: string) =>
        apiFetch(HttpApiPaths.documents.byUserId(userId)),

    getUserDocuments: (userId: string) =>
        apiFetch(HttpApiPaths.documents.byUserId(userId)),

    delete: (userId: string, docType: string) =>
        apiFetch(HttpApiPaths.documents.byUserIdAndDocType(userId, docType), {
            method: "DELETE",
        }),

    deleteFile: (userId: string, docType: string) =>
        apiFetch(`${HttpApiPaths.documents.byUserIdAndDocType(userId, docType)}/file`, {
            method: "DELETE",
        }),

    initiateDigilocker: (userId: string, docType: string) => {
        // Redirect directly — backend handles the OAuth flow
        window.location.href = HttpApiPaths.documents.digilockerAuthorizeRedirect(userId, docType);
    },

    initiateDigiLockerPull: (userId: string, docType: string) =>
        apiFetch(HttpApiPaths.documents.digilockerInitiate(), {
            method: 'POST',
            body: JSON.stringify({ userId, docType }),
        }),

    syncFromDigilocker: (userId: string, docType: string) =>
        apiFetch(HttpApiPaths.documents.digilockerSync(), {
            method: "POST",
            body: JSON.stringify({ userId, docType }),
        }),

    upload: (userId: string, docType: string, file: File, onProgress?: (progress: number) => void) => {
        return new Promise(async (resolve, reject) => {
            const token = (() => {
                if (typeof window === 'undefined') return null;
                return localStorage.getItem('agentAccessToken') || localStorage.getItem('staffAccessToken') || localStorage.getItem('adminAccessToken') || localStorage.getItem('accessToken');
            })();

            let csrfToken = getCsrfToken();
            if (!csrfToken) {
                csrfToken = await initializeCsrf();
            }

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            const form = new FormData();
            form.append('file', file);
            form.append('userId', userId);
            form.append('docType', docType);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress((e.loaded / e.total) * 100);
                }
            });

            xhr.addEventListener('load', async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else if (xhr.status === 403) {
                    // Retry once with fresh CSRF token
                    try {
                        const freshToken = await initializeCsrf(true);
                        const retryXhr = new XMLHttpRequest();
                        retryXhr.withCredentials = true;
                        retryXhr.addEventListener('load', () => {
                            if (retryXhr.status >= 200 && retryXhr.status < 300) {
                                try { resolve(JSON.parse(retryXhr.responseText)); } catch { resolve(retryXhr.responseText); }
                            } else {
                                reject(new Error(`Upload failed with status ${retryXhr.status}`));
                            }
                        });
                        retryXhr.addEventListener('error', () => reject(new Error('Network error')));
                        retryXhr.open('POST', HttpApiPaths.documents.upload());
                        if (token) retryXhr.setRequestHeader('Authorization', `Bearer ${token}`);
                        if (freshToken) retryXhr.setRequestHeader('X-CSRF-Token', freshToken);
                        retryXhr.send(form);
                    } catch {
                        reject(new Error("CSRF token refresh failed"));
                    }
                } else {
                    let errorMsg = `Upload failed with status ${xhr.status}`;
                    try {
                        const parsed = JSON.parse(xhr.responseText);
                        if (parsed.message) errorMsg = parsed.message;
                        else if (parsed.error) errorMsg = parsed.error;
                    } catch {}
                    reject(new Error(errorMsg));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error')));

            xhr.open('POST', HttpApiPaths.documents.upload());
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            xhr.send(form);
        });
    },

    ocrReverify: (userId: string, docType: string) => {
        return apiFetch(HttpApiPaths.documents.ocrReverify(), {
            method: 'POST',
            body: JSON.stringify({ userId, docType }),
        });
    },

    addRequirement: (userId: string, docType: string, docName?: string) =>
        apiFetch(HttpApiPaths.documents.requirement(), {
            method: 'POST',
            body: JSON.stringify({ userId, docType, docName }),
        }),

    /** Get a short-lived S3 presigned URL to view/preview a document. */
    getPresignedView: (userId: string, docType: string) =>
        apiFetch(HttpApiPaths.documents.presignedView(userId, docType)),

    /** Update student profile fields (e.g. from OCR extraction results). */
    updateProfile: (userId: string, updates: any) =>
        apiFetch(HttpApiPaths.onboarding.root(), {
            method: "POST",
            body: JSON.stringify({ userId, ...updates }),
        }),

    accept: (docId: string) =>
        apiFetch(HttpApiPaths.documents.accept(docId), {
            method: "POST",
        }),

    reject: (docId: string, rejectionReason: string) =>
        apiFetch(HttpApiPaths.documents.reject(docId), {
            method: "POST",
            body: JSON.stringify({ rejectionReason }),
        }),
};


// ─── Connected / Cohort ───────────────────────────────────────────────
export const connectedApi = {
    apply: (data: {
        fullName: string;
        email: string;
        phone: string;
        targetIntake: string;
        destination?: string;
        university?: string;
        course?: string;
        gapYear?: boolean;
        message?: string;
    }) =>
        apiFetch(`${API_URL}/connected/apply`, {
            method: "POST",
            body: JSON.stringify({ ...data, source: "connectED" }),
        }),
};

// ─── University ───────────────────────────────────────────────────────
export const universityApi = {
    submitInquiry: (data: {
        userId?: string;
        name: string;
        email: string;
        mobile: string;
        universityName: string;
        type: 'callback' | 'fasttrack';
    }) =>
        apiFetch(`${API_URL}/university-inquiry`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    checkInquiry: (email: string, universityName: string, type: string): Promise<{ exists: boolean }> =>
        apiFetch(`${API_URL}/university-inquiry/check?email=${encodeURIComponent(email)}&universityName=${encodeURIComponent(universityName)}&type=${type}`),
};

// ─── Chat ─────────────────────────────────────────────────────────────
export const chatApi = {
    connect: () =>
        apiFetch(HttpApiPaths.chat.connect(), {
            method: "POST",
        }),

    getConversations: () =>
        apiFetch(HttpApiPaths.chat.conversations()),

    getMessages: (conversationId: string) =>
        apiFetch(HttpApiPaths.chat.messages(conversationId)),

    staffStart: (customerPhone: string, email: string, name?: string) =>
        apiFetch(HttpApiPaths.chat.staffStart(), {
            method: "POST",
            body: JSON.stringify({ customerPhone, email, name }),
        }),
};
// ─── Staff Profile (Intermediary Flow) ───────────────────────────────
export const staffProfileApi = {
    // List all profiles (with optional search / bankStatus filter)
    list: (params?: { search?: string; bankStatus?: string }) =>
        apiFetch(HttpApiPaths.staffProfiles.list(params)),

    // Check if a profile already exists for a linked user
    checkExists: (userId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.check(userId)),

    // Create a staff profile linked to a website user
    create: (data: { linked_user_id: string; target_bank?: string; loan_type?: string; internal_notes?: string }) =>
        apiFetch(HttpApiPaths.staffProfiles.root(), {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Get a single profile with its documents
    get: (profileId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.byId(profileId)),

    // Pull and attach all documents uploaded by the linked user
    fetchUserDocuments: (profileId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.fetchDocuments(profileId), {
            method: 'POST',
        }),

    // Get documents currently attached to a profile
    getDocuments: (profileId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.documents(profileId)),

    // Staff manually uploads a document and attaches it
    uploadDocument: (profileId: string, file: File, docType: string, onProgress?: (progress: number) => void, description?: string) => {
        return new Promise(async (resolve, reject) => {
            const token = (() => {
                if (typeof window === 'undefined') return null;
                return localStorage.getItem('staffAccessToken') || localStorage.getItem('adminAccessToken');
            })();

            let csrfToken = getCsrfToken();
            if (!csrfToken) {
                csrfToken = await initializeCsrf();
            }

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            const form = new FormData();
            form.append('file', file);
            form.append('doc_type', docType);
            if (description) form.append('description', description);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress((e.loaded / e.total) * 100);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error')));

            xhr.open('POST', HttpApiPaths.staffProfiles.documents(profileId));
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            xhr.send(form);
        });
    },

    // Update a document's status (also back-syncs to user's profile)
    updateDocumentStatus: (profileId: string, docId: string, status: string, rejectionReason?: string) =>
        apiFetch(HttpApiPaths.staffProfiles.documentStatus(profileId, docId), {
            method: 'PATCH',
            body: JSON.stringify({ status, rejection_reason: rejectionReason }),
        }),

    // Remove (detach) a document from the profile
    removeDocument: (profileId: string, docId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.documentById(profileId, docId), {
            method: 'DELETE',
        }),

    // Share a document bundle with a bank
    shareWithBank: (profileId: string, data: {
        doc_ids: string[];
        bank_name: string;
        bank_email: string;
        expires_in_days?: number;
        access_note?: string;
    }) =>
        apiFetch(HttpApiPaths.staffProfiles.share(profileId), {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Get share history for a profile
    getShares: (profileId: string) =>
        apiFetch(HttpApiPaths.staffProfiles.shares(profileId)),

    // S3 Document Management
    // Get presigned URL for S3 upload
    getS3PresignedUrl: (userId: string, docType: string, fileName: string, fileType: string) =>
        apiFetch(HttpApiPaths.documents.presignedUrl(), {
            method: 'POST',
            body: JSON.stringify({ userId, docType, fileName, fileType }),
        }),

    // Complete S3 document upload (register in database)
    completeS3Upload: (userId: string, docId: string, docType: string, s3Key: string, s3Url: string, personType: string, employmentType?: string) =>
        apiFetch(HttpApiPaths.documents.completeUpload(), {
            method: 'POST',
            body: JSON.stringify({ userId, docId, docType, s3Key, s3Url, personType, employmentType }),
        }),

    // Fetch user documents from S3
    fetchUserS3Documents: (userId: string) =>
        apiFetch(HttpApiPaths.documents.userDocumentsLegacy(userId)),

    // Delete S3 document
    deleteS3Document: (docId: string) =>
        apiFetch(HttpApiPaths.documents.byDocId(docId), {
            method: 'DELETE',
        }),

    // Download document from S3
    downloadS3Document: (s3Key: string) =>
        apiFetch(HttpApiPaths.documents.download(), {
            method: 'POST',
            body: JSON.stringify({ s3Key }),
        }),

    // Verify S3 document
    verifyS3Document: (docId: string, status: string, rejectionReason?: string) =>
        apiFetch(HttpApiPaths.documents.verifyByDocId(docId), {
            method: 'PATCH',
            body: JSON.stringify({ status, rejection_reason: rejectionReason }),
        }),

    // Dashboard Activities
    logActivity: (data: { type: string; msg: string; icon: string; color: string }) =>
        apiFetch(HttpApiPaths.staffProfiles.activities(), {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDashboardActivities: (limit = 15, staffId?: string) =>
        apiFetch(HttpApiPaths.staffProfiles.dashboardActivities(limit, staffId)),

    getAllDashboardActivities: (opts: { limit?: number; offset?: number; type?: string; search?: string; staffId?: string }) =>
        apiFetch(HttpApiPaths.staffProfiles.activitiesAll(opts)),

    getStaffMembersList: () =>
        apiFetch(HttpApiPaths.staffProfiles.staffList()),

    toggleStaffResignation: (staffId: string, isResigned = true) =>
        apiFetch(HttpApiPaths.staffProfiles.toggleResign(staffId), {
            method: 'PATCH',
            body: JSON.stringify({ isResigned }),
        }),

    // Share a student profile with a bank or the student (Step 4 of onboarding)
    shareProfile: (studentId: string, data: {
        recipientType: string;
        recipientName: string;
        recipientEmail: string;
        message?: string;
        sharedBy?: string;
        studentDetails?: any;
    }) =>
        apiFetch(HttpApiPaths.staffProfiles.shareProfile(studentId), {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTodayDashboard: () =>
        apiFetch(HttpApiPaths.staffProfiles.today()),

    getDashboardSummary: () =>
        apiFetch(HttpApiPaths.staffProfiles.summary()),

    getRejectionAnalytics: (period?: string) =>
        apiFetch(HttpApiPaths.staffProfiles.rejections(period)),

    getSlaTracker: () =>
        apiFetch(HttpApiPaths.staffProfiles.sla()),

    globalSearch: (q: string) =>
        apiFetch(HttpApiPaths.staffProfiles.search(q)),

    getAiPredictionScore: (id: string) =>
        apiFetch(HttpApiPaths.staffProfiles.predict(id)),

    getDeadlineCalendar: () =>
        apiFetch(HttpApiPaths.staffProfiles.calendar()),
};

// ─── Assignment (Round-Robin Staff Assignment) ────────────────────────
export const assignmentApi = {
    // Trigger round-robin assignment for a single loan application with fallback paths
    assign: async (loanId: string) => {
        try {
            return await apiFetch(`${API_URL}/assignment/assign/${loanId}`, { method: 'POST' });
        } catch (e1) {
            try {
                return await apiFetch(`${API_URL}/admin/applications/${loanId}/assign`, { method: 'POST' });
            } catch (e2) {
                return await apiFetch(`${API_URL}/applications/${loanId}/assign`, { method: 'POST' });
            }
        }
    },

    // Manually reassign to a specific staff member with fallback paths
    reassign: async (loanId: string, toStaffId: string, reason?: string) => {
        const body = JSON.stringify({ toStaffId, reason: reason || 'manual' });
        const runReq = async (url: string) => {
            const res: any = await apiFetch(url, { method: 'POST', body });
            if (res && res.success === false) {
                throw new Error(res.message || 'Reassignment failed');
            }
            return res;
        };

        try {
            return await runReq(`${API_URL}/assignment/reassign/${loanId}`);
        } catch (e1) {
            try {
                return await runReq(`${API_URL}/admin/applications/reassign/${loanId}`);
            } catch (e2) {
                try {
                    return await runReq(`${API_URL}/admin/applications/${loanId}/reassign`);
                } catch (e3) {
                    return await runReq(`${API_URL}/auth/reassign/${loanId}`);
                }
            }
        }
    },

    // Bulk reassign multiple applications with fallback paths
    bulkReassign: async (loanIds: string[], toStaffId: string, reason?: string) => {
        const body = JSON.stringify({ loanIds, toStaffId, reason: reason || 'bulk_reassign_admin' });
        try {
            return await apiFetch(`${API_URL}/assignment/bulk-reassign`, { method: 'POST', body });
        } catch (e1) {
            return await apiFetch(`${API_URL}/admin/applications/bulk-reassign`, { method: 'POST', body });
        }
    },

    // Assign all unassigned applications via round robin with fallback paths
    assignAllUnassigned: async () => {
        try {
            return await apiFetch(`${API_URL}/assignment/assign-all-unassigned`, { method: 'POST' });
        } catch (e1) {
            try {
                return await apiFetch(`${API_URL}/admin/applications/assign-all-unassigned`, { method: 'POST' });
            } catch (e2) {
                return await apiFetch(`${API_URL}/auth/assign-all-unassigned`, { method: 'POST' });
            }
        }
    },

    autoAssignAllUnassigned: async () => {
        try {
            return await apiFetch(`${API_URL}/assignment/assign-all-unassigned`, { method: 'POST' });
        } catch (e1) {
            try {
                return await apiFetch(`${API_URL}/admin/applications/assign-all-unassigned`, { method: 'POST' });
            } catch (e2) {
                return await apiFetch(`${API_URL}/auth/assign-all-unassigned`, { method: 'POST' });
            }
        }
    },


    // Get all applications assigned to the current (or specified) staff member (optionally including unassigned)
    getMyApplications: (staffId?: string, status?: string, includeUnassigned?: boolean) => {
        const params = new URLSearchParams();
        if (staffId) params.set('staffId', staffId);
        if (status) params.set('status', status);
        if (includeUnassigned) params.set('includeUnassigned', 'true');
        const queryStr = params.toString();
        return apiFetch(`${API_URL}/assignment/my-applications${queryStr ? `?${queryStr}` : ''}`);
    },

    // Get all unassigned applications queue
    getUnassignedQueue: () =>
        apiFetch(`${API_URL}/assignment/unassigned-queue`),

    // Get team workload summary
    getTeamDashboard: () =>
        apiFetch(`${API_URL}/assignment/team-dashboard`),

    // Get assignment history for a loan or all loans
    getHistory: (loanId?: string) => {
        const url = loanId
            ? `${API_URL}/assignment/history/${loanId}`
            : `${API_URL}/assignment/history`;
        return apiFetch(url);
    },

    // Update staff availability / workload settings
    updateStaffAvailability: (staffId: string, data: {
        isAvailable?: boolean;
        isOnLeave?: boolean;
        maxWorkload?: number;
        specialization?: string[];
    }) =>
        apiFetch(`${API_URL}/assignment/staff/${staffId}/availability`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

export const bankApi = {
    getIncomingFiles: (limit?: number, offset?: number) => apiFetch(HttpApiPaths.bank.incomingFiles(limit, offset)),
    logFile: (id: string, data: { lanNumber: string }) => apiFetch(HttpApiPaths.bank.logFile(id), { method: "POST", body: JSON.stringify(data) }),
    getDocuments: (applicationId: string) => apiFetch(HttpApiPaths.bank.documents(applicationId)),
    downloadDocumentsZip: (applicationId: string) => fetchBlob(HttpApiPaths.bank.documentsZip(applicationId)),
    submitDecision: (data: any) => apiFetch(HttpApiPaths.bank.decisions(), { method: "POST", body: JSON.stringify(data) }),
    raiseQuery: (data: any) => apiFetch(HttpApiPaths.bank.queries(), { method: "POST", body: JSON.stringify(data) }),
    confirmDisbursement: (data: any) => apiFetch(HttpApiPaths.bank.confirmDisbursement(), { method: "POST", body: JSON.stringify(data) }),
    conditionalSanction: (data: any) => apiFetch(HttpApiPaths.bank.conditionalSanctions(), { method: "POST", body: JSON.stringify(data) }),
    saveConditionalSanctions: (id: string, data: any) => apiFetch(HttpApiPaths.bank.saveConditionalSanctions(id), { method: "POST", body: JSON.stringify(data) }),
    partialSanction: (data: any) => apiFetch(HttpApiPaths.bank.partialSanctions(), { method: "POST", body: JSON.stringify(data) }),
    counterOffer: (data: any) => apiFetch(HttpApiPaths.bank.counterOffers(), { method: "POST", body: JSON.stringify(data) }),
    fileQualityScore: (data: any) => apiFetch(HttpApiPaths.bank.fileQualityScore(), { method: "POST", body: JSON.stringify(data) }),
    getChannelAnalytics: () => apiFetch(HttpApiPaths.bank.analyticsChannel()),
    getRejectionAnalytics: () => apiFetch(HttpApiPaths.bank.analyticsRejections()),
    getSlaTracker: () => apiFetch(HttpApiPaths.bank.slaTracker()),
    getLoanProducts: () => apiFetch(HttpApiPaths.bank.loanProducts()),
    createLoanProduct: (data: any) => apiFetch(HttpApiPaths.bank.loanProducts(), { method: "POST", body: JSON.stringify(data) }),
    updateLoanProduct: (id: string, data: any) => apiFetch(HttpApiPaths.bank.updateLoanProduct(id), { method: "PUT", body: JSON.stringify(data) }),
    getBranches: () => apiFetch(HttpApiPaths.bank.branches()),
    createBranch: (data: any) => apiFetch(HttpApiPaths.bank.branches(), { method: "POST", body: JSON.stringify(data) }),
    getOfficers: () => apiFetch(HttpApiPaths.bank.officers()),
    getFileDetail: (id: string) => apiFetch<any>(HttpApiPaths.bank.fileDetail(id)),
    lookupByLan: (lan: string) => apiFetch(HttpApiPaths.bank.lookupByLan(lan)),
    getMyFiles: (filters?: any) => apiFetch(HttpApiPaths.bank.myFiles(filters)),
    amendDecision: (decisionId: string, data: any) => apiFetch(HttpApiPaths.bank.amendDecision(decisionId), { method: "PUT", body: JSON.stringify(data) }),
    uploadSanctionLetter: (id: string, fileUrl: string) => apiFetch(HttpApiPaths.bank.sanctionLetter(id), { method: "POST", body: JSON.stringify({ fileUrl }) }),
    setRoi: (id: string, data: any) => apiFetch(HttpApiPaths.bank.roi(id), { method: "POST", body: JSON.stringify(data) }),
    setProcessingFee: (id: string, data: any) => apiFetch(HttpApiPaths.bank.fee(id), { method: "POST", body: JSON.stringify(data) }),
    updateProcessingFee: (id: string, data: any) => apiFetch(HttpApiPaths.bank.fee(id), { method: "PUT", body: JSON.stringify(data) }),
    getQueryThread: (queryId: string) => apiFetch(HttpApiPaths.bank.queryThread(queryId)),
    resolveQuery: (queryId: string) => apiFetch(HttpApiPaths.bank.resolveQuery(queryId), { method: "POST" }),
    getAnalyticsMetrics: () => apiFetch(HttpApiPaths.bank.analyticsMetrics()),
    exportCsv: () => apiFetch(HttpApiPaths.bank.exportCsv()),
    exportMis: () => apiFetch(HttpApiPaths.bank.exportMis()),
    getConsent: (applicationId: string) => apiFetch<any>(HttpApiPaths.bank.consent(applicationId)),
    recordConsent: (applicationId: string, data: any) => apiFetch<any>(HttpApiPaths.bank.consent(applicationId), { method: "POST", body: JSON.stringify(data) }),
    sendApplicationEmail: (data: { applicationId: string; bankId: string; bankName: string; sentBy: string; recipientEmail?: string }) =>
        apiFetch(`${API_URL}/bank/workflow/send-application-email`, { method: "POST", body: JSON.stringify(data) }),
};

// ─── Campaigns ─────────────────────────────────────────────────────────
export const campaignApi = {
    create: (data: any) => apiFetch(`${API_URL}/campaigns`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`${API_URL}/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    generate: (data: any) => apiFetch(`${API_URL}/campaigns/generate`, { method: "POST", body: JSON.stringify(data) }),
    getAll: (limit = 50, offset = 0, status?: string) => {
        let url = `${API_URL}/campaigns?limit=${limit}&offset=${offset}`;
        if (status) url += `&status=${status}`;
        return apiFetch(url);
    },
    getAudience: (filters: Record<string, any> = {}) => {
        const q = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
        });
        return apiFetch(`${API_URL}/campaigns/audience?${q.toString()}`);
    },
    saveAudience: (data: any) => apiFetch(`${API_URL}/campaigns/audience/save`, { method: "POST", body: JSON.stringify(data) }),
    getSavedAudiences: () => apiFetch(`${API_URL}/campaigns/audience/saved`),
    getById: (id: string) => apiFetch(`${API_URL}/campaigns/${id}`),
    delete: (id: string) => apiFetch(`${API_URL}/campaigns/${id}`, { method: "DELETE" }),
    queue: (id: string, recipientIds: string[]) => apiFetch(`${API_URL}/campaigns/${id}/queue`, { method: "POST", body: JSON.stringify({ recipientIds }) }),
    cancel: (id: string) => apiFetch(`${API_URL}/campaigns/${id}/cancel`, { method: "POST" }),
    validate: (id: string) => apiFetch(`${API_URL}/campaigns/${id}/validate`, { method: "POST" }),
    sendTest: (id: string, email: string) => apiFetch(`${API_URL}/campaigns/${id}/test-email`, { method: "POST", body: JSON.stringify({ email }) }),
    getTemplates: () => apiFetch(`${API_URL}/campaigns/templates`),
    createTemplate: (data: any) => apiFetch(`${API_URL}/campaigns/templates`, { method: "POST", body: JSON.stringify(data) }),
    getAutomationRules: () => apiFetch(`${API_URL}/campaigns/automation`),
    createAutomationRule: (data: any) => apiFetch(`${API_URL}/campaigns/automation`, { method: "POST", body: JSON.stringify(data) }),
    getPromptHistory: () => apiFetch(`${API_URL}/campaigns/prompt-history`),
    getOverviewStats: () => apiFetch(`${API_URL}/campaigns/analytics/overview`),
    getRecipients: (filters: { campaignId?: string; status?: string; search?: string; limit?: number; offset?: number } = {}) => {
        const q = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
        });
        return apiFetch(`${API_URL}/campaigns/recipients?${q.toString()}`);
    },
    getRecipientPreview: (recipientId: string) => apiFetch(`${API_URL}/campaigns/recipients/${recipientId}`),
    getEmailLogs: (limit = 100, offset = 0, status?: string) => {
        let url = `${API_URL}/campaigns/logs?limit=${limit}&offset=${offset}`;
        if (status) url += `&status=${status}`;
        return apiFetch(url);
    },
};

// ─── Support Ticket API ───────────────────────────────────────────────────────

export const supportApi = {
    // Tickets
    getTickets: (params: Record<string, any> = {}) => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) q.set(k, String(v)); });
        return apiFetch(`${API_URL}/support/tickets?${q.toString()}`);
    },
    getTicket: (id: string) => apiFetch(`${API_URL}/support/tickets/${id}`),
    createTicket: (data: any) => apiFetch(`${API_URL}/support/tickets`, { method: "POST", body: JSON.stringify(data) }),
    updateTicket: (id: string, data: any) => apiFetch(`${API_URL}/support/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string, reason?: string) =>
        apiFetch(`${API_URL}/support/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
    updatePriority: (id: string, priority: string) =>
        apiFetch(`${API_URL}/support/tickets/${id}/priority`, { method: "PATCH", body: JSON.stringify({ priority }) }),
    assignTicket: (id: string, data: any) =>
        apiFetch(`${API_URL}/support/tickets/${id}/assign`, { method: "PATCH", body: JSON.stringify(data) }),
    addComment: (id: string, content: string) =>
        apiFetch(`${API_URL}/support/tickets/${id}/comment`, { method: "POST", body: JSON.stringify({ content, isInternal: false }) }),
    addInternalNote: (id: string, content: string) =>
        apiFetch(`${API_URL}/support/tickets/${id}/internal-note`, { method: "POST", body: JSON.stringify({ content, isInternal: true }) }),
    uploadAttachment: async (ticketId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}/attachment`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to upload attachment");
        }
        return res.json();
    },

    // Dashboard & Analytics
    getDashboard: () => apiFetch(`${API_URL}/support/dashboard`),
    getAnalytics: (params: Record<string, any> = {}) => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
        return apiFetch(`${API_URL}/support/analytics?${q.toString()}`);
    },

    // Categories
    getCategories: () => apiFetch(`${API_URL}/support/categories`),
    createCategory: (data: any) => apiFetch(`${API_URL}/support/categories`, { method: "POST", body: JSON.stringify(data) }),

    // Teams
    getTeams: () => apiFetch(`${API_URL}/support/teams`),
    createTeam: (data: any) => apiFetch(`${API_URL}/support/teams`, { method: "POST", body: JSON.stringify(data) }),

    // SLA
    getSLA: () => apiFetch(`${API_URL}/support/sla`),
    updateSLA: (priority: string, data: any) =>
        apiFetch(`${API_URL}/support/sla/${priority}`, { method: "PATCH", body: JSON.stringify(data) }),

    // Knowledge Base
    getKBArticles: (params: Record<string, any> = {}) => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
        return apiFetch(`${API_URL}/support/knowledge-base?${q.toString()}`);
    },
    createKBArticle: (data: any) => apiFetch(`${API_URL}/support/knowledge-base`, { method: "POST", body: JSON.stringify(data) }),

    // Notifications
    getNotifications: () => apiFetch(`${API_URL}/support/notifications`),
    markNotificationRead: (id: string) => apiFetch(`${API_URL}/support/notifications/${id}/read`, { method: "PATCH" }),
};

export const mailApi = {
    getInbox: (params: { folder?: string; staffEmail?: string } = {}) => {
        const q = new URLSearchParams();
        if (params.folder) q.set("folder", params.folder);
        if (params.staffEmail) q.set("staffEmail", params.staffEmail);
        const queryStr = q.toString() ? `?${q.toString()}` : "";
        return apiFetch(`${API_URL}/mail/inbox${queryStr}`);
    },
    getFolders: () => apiFetch(`${API_URL}/mail/folders`),
    getMail: (id: string) => apiFetch(`${API_URL}/mail/inbox/${id}`),
    getStats: () => apiFetch(`${API_URL}/mail/stats`),
    sendMail: (data: {
        to: string | string[];
        cc?: string | string[];
        bcc?: string | string[];
        subject: string;
        text?: string;
        html?: string;
        replyTo?: string;
        attachments?: { filename: string; content: string; contentType?: string }[];
    }) => apiFetch(`${API_URL}/mail/send`, {
        method: "POST",
        body: JSON.stringify(data),
    }),
    updateState: (id: string, data: { isRead?: boolean; isStarred?: boolean; isSpam?: boolean | null; isTrashed?: boolean }) =>
        apiFetch(`${API_URL}/mail/state/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),
    batchUpdateState: (emailIds: string[], data: { isRead?: boolean; isStarred?: boolean; isSpam?: boolean | null; isTrashed?: boolean }) =>
        apiFetch(`${API_URL}/mail/state/batch`, {
            method: "POST",
            body: JSON.stringify({ emailIds, ...data }),
        }),
    getUserStates: () => apiFetch(`${API_URL}/mail/states`),
};

export const siteSettingsApi = {
    getPublicSettings: () => adminApi.getPublicSiteSettings(),
    getSettings: () => adminApi.getSiteSettings(),
    updateSettings: (data: any) => adminApi.updateSiteSettings(data),
    resetDefaults: () => adminApi.resetSiteSettings(),
};

/** Shared REST path builders + staff-dashboard catalog (single source for URLs). */
export { HTTP_API_PREFIX, HttpApiPaths, staffDashboardApiCatalog } from "./http-api-paths";

