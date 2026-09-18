"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { adminApi, documentApi } from "@/lib/api";

interface UserDossierContextType {
    userId: string;
    userData: any;
    setUserData: (data: any) => void;
    userApplications: any[];
    setUserApplications: (apps: any[]) => void;
    userDocuments: any[];
    setUserDocuments: (docs: any[]) => void;
    notes: any[];
    setNotes: (notes: any[]) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    actionLoading: boolean;
    setActionLoading: (loading: boolean) => void;
    refreshData: () => Promise<void>;
    
    // Co-applicant states and actions
    isCoAppModalOpen: boolean;
    setIsCoAppModalOpen: (open: boolean) => void;
    coAppName: string;
    setCoAppName: (name: string) => void;
    coAppRelation: string;
    setCoAppRelation: (relation: string) => void;
    coAppPhone: string;
    setCoAppPhone: (phone: string) => void;
    coAppEmail: string;
    setCoAppEmail: (email: string) => void;
    coAppIncome: string;
    setCoAppIncome: (income: string) => void;
    openCoAppModal: () => void;
    handleSaveCoApp: () => Promise<void>;

    // Share with bank states
    routingApp: any;
    setRoutingApp: (app: any) => void;
    isShareModalOpen: boolean;
    setIsShareModalOpen: (open: boolean) => void;
}

const UserDossierContext = createContext<UserDossierContextType | undefined>(undefined);

export function UserDossierProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
    const [userData, setUserData] = useState<any>(null);
    const [userApplications, setUserApplications] = useState<any[]>([]);
    const [userDocuments, setUserDocuments] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Co-applicant modal states
    const [isCoAppModalOpen, setIsCoAppModalOpen] = useState(false);
    const [coAppName, setCoAppName] = useState("");
    const [coAppRelation, setCoAppRelation] = useState("");
    const [coAppPhone, setCoAppPhone] = useState("");
    const [coAppEmail, setCoAppEmail] = useState("");
    const [coAppIncome, setCoAppIncome] = useState("");

    // Share with bank states
    const [routingApp, setRoutingApp] = useState<any>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const refreshData = async () => {
        try {
            // Fetch User
            const userRes = await adminApi.getUserById(userId) as any;
            if (userRes && userRes.data) {
                const userClone = { ...userRes.data };
                if (typeof userClone.family === 'string') {
                    try { userClone.family = JSON.parse(userClone.family); } catch {}
                }
                if (typeof userClone.coApplicant === 'string') {
                    try { userClone.coApplicant = JSON.parse(userClone.coApplicant); } catch {}
                }
                if (typeof userClone.academic === 'string') {
                    try { userClone.academic = JSON.parse(userClone.academic); } catch {}
                }
                setUserData(userClone);
            }

            // Fetch Applications — pass userId so the server only returns this user's applications
            const appsRes = await adminApi.getApplications({ userId }) as any;
            const fetchedApps = appsRes.data || [];
            // Keep the client-side filter as a safety net
            const userApps = fetchedApps.filter((app: any) =>
                app.userId === userId || app.user_id === userId || app.applicantId === userId || app.linkedUserId === userId ||
                (userRes.data && (app.userId === userRes.data.id || app.user_id === userRes.data.id || app.applicantId === userRes.data.id))
            ).length > 0 ? fetchedApps.filter((app: any) =>
                app.userId === userId || app.user_id === userId || app.applicantId === userId || app.linkedUserId === userId ||
                (userRes.data && (app.userId === userRes.data.id || app.user_id === userRes.data.id || app.applicantId === userRes.data.id))
            ) : fetchedApps; // if filter results in nothing (e.g. userId mismatch), fall back to all returned apps
            setUserApplications(userApps);

            // Fetch Documents
            try {
                const docsRes = await documentApi.getUserDocuments(userId) as any;
                const fetchedDocs = Array.isArray(docsRes) ? docsRes : (docsRes?.data || []);
                setUserDocuments(fetchedDocs);
            } catch (docErr) {
                console.error("Failed to fetch user documents:", docErr);
            }

            // Fetch Internal Notes
            if (userApps.length > 0) {
                const activeApp = userApps[0];
                const appRefId = activeApp?.id || activeApp?._id;
                if (appRefId) {
                    const notesRes = await adminApi.getRemarks(appRefId) as any;
                    if (notesRes && notesRes.data) {
                        const filteredNotes = notesRes.data.filter((r: any) => r.isInternal === true || r.type === 'note' || r.type === 'admin_note' || r.type === 'staff_note');
                        setNotes(filteredNotes);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load user dossier info:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            refreshData();
        }
    }, [userId]);

    const openCoAppModal = () => {
        const coApp = typeof userData?.coApplicant === 'object' && userData?.coApplicant !== null
            ? userData.coApplicant
            : {};
            
        let name = coApp.name || coApp.coApplicantName || userData?.coApplicantName || "";
        let relation = coApp.relation || coApp.relationship || userData?.coApplicantRelation || "";
        let phone = coApp.mobile || coApp.phone || coApp.coApplicantPhone || userData?.coApplicantPhone || "";
        let email = coApp.email || coApp.coApplicantEmail || userData?.coApplicantEmail || "";
        let income = coApp.monthlyIncome || coApp.income || userData?.coApplicantIncome || "";

        if (userApplications && userApplications.length > 0) {
            const firstApp = userApplications.find(app => app.coApplicantName || app.coApplicantRelation || app.coApplicantPhone || app.coApplicantEmail);
            if (firstApp) {
                if (!name) name = firstApp.coApplicantName || "";
                if (!relation) relation = firstApp.coApplicantRelation || "";
                if (!phone) phone = firstApp.coApplicantPhone || "";
                if (!email) email = firstApp.coApplicantEmail || "";
                if (!income) income = firstApp.coApplicantIncome || "";
            }
        }

        setCoAppName(name);
        setCoAppRelation(relation);
        setCoAppPhone(phone);
        setCoAppEmail(email);
        setCoAppIncome(income);
        setIsCoAppModalOpen(true);
    };

    const handleSaveCoApp = async () => {
        try {
            setActionLoading(true);
            const updatedCoApp = {
                name: coAppName,
                relation: coAppRelation,
                relationship: coAppRelation,
                mobile: coAppPhone,
                phone: coAppPhone,
                email: coAppEmail,
                monthlyIncome: coAppIncome,
                income: coAppIncome
            };
            
            // 1. Update user profile
            await documentApi.updateProfile(userId, { coApplicant: updatedCoApp });

            // 2. Update active applications if any
            if (userApplications && userApplications.length > 0) {
                for (const app of userApplications) {
                    await adminApi.updateApplication(app.id, {
                        coApplicantName: coAppName,
                        coApplicantRelation: coAppRelation,
                        coApplicantPhone: coAppPhone,
                        coApplicantEmail: coAppEmail,
                        coApplicantIncome: coAppIncome ? parseFloat(coAppIncome) : null,
                    });
                }
            }

            // 3. Reload data
            await refreshData();

            setIsCoAppModalOpen(false);
            alert("Co-applicant details updated successfully!");
        } catch (err: any) {
            console.error("Failed to update co-applicant:", err);
            alert("Failed to update co-applicant: " + (err.message || err));
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <UserDossierContext.Provider
            value={{
                userId,
                userData,
                setUserData,
                userApplications,
                setUserApplications,
                userDocuments,
                setUserDocuments,
                notes,
                setNotes,
                loading,
                setLoading,
                actionLoading,
                setActionLoading,
                refreshData,
                
                isCoAppModalOpen,
                setIsCoAppModalOpen,
                coAppName,
                setCoAppName,
                coAppRelation,
                setCoAppRelation,
                coAppPhone,
                setCoAppPhone,
                coAppEmail,
                setCoAppEmail,
                coAppIncome,
                setCoAppIncome,
                openCoAppModal,
                handleSaveCoApp,

                routingApp,
                setRoutingApp,
                isShareModalOpen,
                setIsShareModalOpen
            }}
        >
            {children}
        </UserDossierContext.Provider>
    );
}

export function useUserDossier() {
    const context = useContext(UserDossierContext);
    if (!context) {
        throw new Error("useUserDossier must be used within UserDossierProvider");
    }
    return context;
}
