"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi, subscribeToTokenChange, notifyTokenChange, initializeCsrf } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    mobile?: string;
    role?: string;
    goal?: string;
    studyDestination?: string;
    courseName?: string;
    targetUniversity?: string;
    intakeSeason?: string;
    bachelorsDegree?: string;
    workExp?: number;
    gpa?: number;
    entranceTest?: string;
    entranceScore?: string;
    englishTest?: string;
    englishScore?: string;
    budget?: string;
    loanAmount?: string;
    admitStatus?: string;
    pincode?: string;
    referralCode?: string;
    bankId?: string;
    bankName?: string;
    bankLogo?: string;
    bank?: string;
    fatherName?: string;
    fatherAadhar?: string;
    fatherPan?: string;
    fatherPhone?: string;
    fatherEmail?: string;
    motherName?: string;
    motherAadhar?: string;
    motherPan?: string;
    motherPhone?: string;
    motherEmail?: string;
    coApplicantName?: string;
    coApplicantAadhar?: string;
    coApplicantPan?: string;
    coApplicantRelation?: string;
    coApplicantPhone?: string;
    coApplicantEmail?: string;
    coApplicantIncome?: number | string;
    family?: any;
    coApplicant?: any;
    parents?: any[];
    passportOriginalName?: string;
    nameAsInPassport?: string;
    passport?: any;
    mailboxEmail?: string;
    mailboxPrefix?: string;
    canAccessSupport?: boolean;
    staffId?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isBank: boolean;
    isStaff: boolean;
    isAgent: boolean;
    isLoading: boolean;
    login: (accessToken: string, userData?: Partial<AuthUser> & { refresh_token?: string }) => void;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<boolean>;
    refreshUser: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getStoredUser(portal: Portal): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
        const keys = getStorageKeys(portal);
        const raw = localStorage.getItem(keys.user);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
}

function getStoredToken(portal: Portal): string | null {
    if (typeof window === "undefined") return null;
    const keys = getStorageKeys(portal);
    const token = localStorage.getItem(keys.token);
    if (token) return token;
    if (portal === "student") {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || localStorage.getItem("userToken") || null;
    }
    return null;
}

function getStoredRefreshToken(portal: Portal): string | null {
    if (typeof window === "undefined") return null;
    const keys = getStorageKeys(portal);
    const token = localStorage.getItem(keys.refreshToken);
    if (token) return token;
    if (portal === "student") {
        return localStorage.getItem("refreshToken") || null;
    }
    return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const portal = getPortalFromPathname(pathname);

    // Initialize CSRF token and double submit cookie on application load
    useEffect(() => {
        initializeCsrf().catch(() => {});
    }, []);

    // Subscribe to token updates from apiFetch (silent refreshes)
    useEffect(() => {
        const unsubscribe = subscribeToTokenChange((newToken) => {
            setToken(newToken);
        });
        return unsubscribe;
    }, []);

    // Handle session expiry without a full page reload
    useEffect(() => {
        const onSessionExpired = (event: Event) => {
            const loginPath = (event as CustomEvent<{ loginPath: string }>).detail?.loginPath || "/login";
            setUser(null);
            setToken(null);
            router.replace(`${loginPath}?expired=true`);
        };

        window.addEventListener("auth:session-expired", onSessionExpired);
        return () => window.removeEventListener("auth:session-expired", onSessionExpired);
    }, [router]);

    // Restore session from localStorage — trust cached tokens, no refresh on load
    useEffect(() => {
        const keys = getStorageKeys(portal);
        const storedUser = getStoredUser(portal);
        const storedToken = getStoredToken(portal);

        if (storedUser && storedToken) {
            setUser(storedUser);
            setToken(storedToken);
            if (typeof window !== "undefined") {
                if (portal === "staff") {
                    // Session-only cookie for staff
                    document.cookie = `${keys.token}=${storedToken}; path=/; SameSite=Lax`;
                } else {
                    document.cookie = `${keys.token}=${storedToken}; path=/; max-age=2592000; SameSite=Lax`;
                }
            }
        } else if (storedToken && !storedUser) {
            const email = localStorage.getItem(keys.email);
            const userId = localStorage.getItem(keys.userId);
            if (email) {
                setUser({ id: userId || "", email });
                setToken(storedToken);
            } else {
                setUser(null);
                setToken(null);
            }
        } else {
            setUser(null);
            setToken(null);
        }

        setIsLoading(false);
    }, [portal]);

    /** Re-fetch the latest user profile from the backend and update state */
    const refreshUser = useCallback(async (): Promise<void> => {
        const keys = getStorageKeys(portal);
        const email = localStorage.getItem(keys.email);
        const accessToken = getStoredToken(portal);
        if (!email || !accessToken) return;
        try {
            const data = await authApi.getDashboard(email) as {
                success?: boolean;
                user?: Partial<AuthUser>;
                data?: Partial<AuthUser>;
            };
            const freshUser = data?.user ?? data?.data ?? null;
            if (freshUser && (freshUser as AuthUser).email) {
                setUser(prev => {
                    function pickVal<T>(fresh: T | undefined | null, existing: T | undefined | null): T | undefined {
                        if (fresh !== undefined && fresh !== null && fresh !== '') return fresh as T;
                        return existing ? (existing as T) : undefined;
                    }
                    const updated: AuthUser = {
                        ...(prev as AuthUser),
                        ...(freshUser as AuthUser),
                        id: (freshUser as any).id || (freshUser as any)._id || prev?.id || localStorage.getItem(keys.userId) || '',
                        email: freshUser.email || prev?.email || email,
                        firstName: pickVal(freshUser.firstName, prev?.firstName),
                        lastName: pickVal(freshUser.lastName, prev?.lastName),
                        phoneNumber: pickVal(freshUser.phoneNumber, prev?.phoneNumber),
                        dateOfBirth: pickVal(freshUser.dateOfBirth, prev?.dateOfBirth),
                        role: pickVal(freshUser.role, prev?.role),
                        intakeSeason: pickVal((freshUser as any).intakeSeason, prev?.intakeSeason),
                        studyDestination: pickVal((freshUser as any).studyDestination, prev?.studyDestination),
                        courseName: pickVal((freshUser as any).courseName, prev?.courseName),
                        targetUniversity: pickVal((freshUser as any).targetUniversity, prev?.targetUniversity),
                        family: (freshUser as any).family !== undefined && (freshUser as any).family !== null ? (freshUser as any).family : prev?.family,
                        coApplicant: (freshUser as any).coApplicant !== undefined && (freshUser as any).coApplicant !== null ? (freshUser as any).coApplicant : prev?.coApplicant,
                        motherName: pickVal((freshUser as any).motherName, prev?.motherName),
                        motherAadhar: pickVal((freshUser as any).motherAadhar, (prev as any)?.motherAadhar),
                        motherPan: pickVal((freshUser as any).motherPan, (prev as any)?.motherPan),
                        fatherName: pickVal((freshUser as any).fatherName, prev?.fatherName),
                        fatherAadhar: pickVal((freshUser as any).fatherAadhar, (prev as any)?.fatherAadhar),
                        fatherPan: pickVal((freshUser as any).fatherPan, (prev as any)?.fatherPan),
                        coApplicantName: pickVal((freshUser as any).coApplicantName, prev?.coApplicantName),
                        coApplicantAadhar: pickVal((freshUser as any).coApplicantAadhar, (prev as any)?.coApplicantAadhar),
                        coApplicantPan: pickVal((freshUser as any).coApplicantPan, (prev as any)?.coApplicantPan),
                        parents: (freshUser as any).parents !== undefined && (freshUser as any).parents !== null ? (freshUser as any).parents : (prev as any)?.parents,
                        passportOriginalName: pickVal((freshUser as any).passportOriginalName, prev?.passportOriginalName),
                        nameAsInPassport: pickVal((freshUser as any).nameAsInPassport, prev?.nameAsInPassport),
                        passport: (freshUser as any).passport !== undefined && (freshUser as any).passport !== null ? (freshUser as any).passport : prev?.passport,
                        mailboxEmail: pickVal((freshUser as any).mailboxEmail, prev?.mailboxEmail),
                        mailboxPrefix: pickVal((freshUser as any).mailboxPrefix, prev?.mailboxPrefix),
                        canAccessSupport: (freshUser as any).canAccessSupport !== undefined ? (freshUser as any).canAccessSupport : prev?.canAccessSupport,
                        staffId: pickVal((freshUser as any).staffId, prev?.staffId),
                    };
                    localStorage.setItem(keys.user, JSON.stringify(updated));
                    if (updated.id) localStorage.setItem(keys.userId, updated.id);
                    return updated;
                });
            }
        } catch (err) {
            console.warn("refreshUser failed:", err);
        }
    }, [portal]);

    /** Called after a successful OTP verification / login */
    const login = useCallback(
        (
            accessToken: string,
            userData?: Partial<AuthUser> & { refresh_token?: string }
        ) => {
            const keys = getStorageKeys(portal);
            const email = userData?.email ?? localStorage.getItem(keys.email) ?? "";
            const newUser: AuthUser = {
                id: userData?.id ?? localStorage.getItem(keys.userId) ?? "",
                email,
                firstName: userData?.firstName,
                lastName: userData?.lastName,
                role: userData?.role,
                ...userData,
            };

            localStorage.setItem(keys.token, accessToken);
            if (userData?.refresh_token) {
                localStorage.setItem(keys.refreshToken, userData.refresh_token);
            }
            localStorage.setItem(keys.email, email);
            if (newUser.id) localStorage.setItem(keys.userId, newUser.id);
            localStorage.setItem(keys.user, JSON.stringify(newUser));

            if (typeof window !== "undefined") {
                if (portal === "staff") {
                    // Session-only cookie for staff (expires when browser closes)
                    document.cookie = `${keys.token}=${accessToken}; path=/; SameSite=Lax`;
                } else {
                    document.cookie = `${keys.token}=${accessToken}; path=/; max-age=2592000; SameSite=Lax`;
                }
            }

            notifyTokenChange(accessToken);

            setToken(accessToken);
            setUser(newUser);
        },
        [portal]
    );

    /** Attempt a silent token refresh; returns true on success */
    const refreshAuth = useCallback(async (): Promise<boolean> => {
        const keys = getStorageKeys(portal);
        const storedRefreshToken = getStoredRefreshToken(portal);
        if (!storedRefreshToken) return false;

        try {
            const data = (await authApi.refresh(storedRefreshToken)) as {
                access_token?: string;
                accessToken?: string;
                refresh_token?: string;
            };
            const newToken = data.access_token ?? data.accessToken;
            if (!newToken) return false;

            localStorage.setItem(keys.token, newToken);
            if (data.refresh_token) {
                localStorage.setItem(keys.refreshToken, data.refresh_token);
            }
            if (typeof window !== "undefined") {
                document.cookie = `${keys.token}=${newToken}; path=/; max-age=2592000; SameSite=Lax`;
            }
            notifyTokenChange(newToken);
            setToken(newToken);
            return true;
        } catch {
            return false;
        }
    }, [portal]);

    const logout = useCallback(async () => {
        const keys = getStorageKeys(portal);
        const email = user?.email ?? localStorage.getItem(keys.email) ?? "";

        // Best-effort server logout
        if (email) {
            try {
                await authApi.logout(email);
            } catch {
                // ignore network errors on logout
            }
        }

        // Clear current portal auth state only
        localStorage.removeItem(keys.token);
        localStorage.removeItem(keys.refreshToken);
        localStorage.removeItem(keys.email);
        localStorage.removeItem(keys.userId);
        localStorage.removeItem(keys.user);

        if (typeof window !== "undefined") {
            document.cookie = `${keys.token}=; path=/; max-age=0;`;
        }

        notifyTokenChange(null);

        setUser(null);
        setToken(null);
    }, [user, portal]);

    const isAuthenticated = user !== null && !!token;
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isBank = user?.role === 'bank' || user?.role === 'partner_bank';
    const isStaff = user?.role === 'staff';
    const isAgent = user?.role === 'agent' || user?.role === 'partner_agent' || isAdmin;

    return (
        <AuthContext.Provider
            value={{ user, token, isAuthenticated, isAdmin, isBank, isStaff, isAgent, isLoading, login, logout, refreshAuth, refreshUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
