"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, bankApi } from "@/lib/api";
import { PageHeader, StatusBadge, Spinner, EmptyState } from "@/components/bank/SharedUI";

export default function DocumentReviewCenter() {
    const [mounted, setMounted] = useState(false);
    const [currentBankId, setCurrentBankId] = useState<string>("idfc");
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [appDocs, setAppDocs] = useState<Record<string, any[]>>({});
    const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});

    // Inline PDF Viewer & Fullscreen States
    const [activeViewerDoc, setActiveViewerDoc] = useState<any | null>(null);
    const [viewerAppId, setViewerAppId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(100);
    const [rotate, setRotate] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [selectedThumb, setSelectedThumb] = useState(1);

    // Verify modal state
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState<"verified" | "rejected">("verified");
    const [rejectionReason, setRejectionReason] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [zippingId, setZippingId] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
            if (saved) setCurrentBankId(saved);

            const params = new URLSearchParams(window.location.search);
            const appId = params.get("id");
            if (appId) {
                setSelectedAppId(appId);
            }
        }
    }, []);

    const fetchApplications = async (bankId: string) => {
        setLoading(true);
        try {
            const res: any = await adminApi.getApplications({ bank: bankId });
            if (res && res.success) {
                setApplications(res.data || []);
            }
        } catch (err) {
            console.error("Failed to load applications for documents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchApplications(currentBankId);
        }
    }, [currentBankId, mounted]);

    const fetchAppDocuments = async (appId: string) => {
        if (appDocs[appId]) return; // already loaded
        setDocsLoading(prev => ({ ...prev, [appId]: true }));
        try {
            const res: any = await adminApi.getApplicationDocuments(appId);
            const docs = Array.isArray(res) ? res : (res?.data || []);
            setAppDocs(prev => ({ ...prev, [appId]: docs }));
        } catch (err) {
            console.error("Failed to fetch documents for application:", appId, err);
        } finally {
            setDocsLoading(prev => ({ ...prev, [appId]: false }));
        }
    };

    useEffect(() => {
        if (selectedAppId) {
            fetchAppDocuments(selectedAppId);
        }
    }, [selectedAppId]);

    const selectApplication = (appId: string) => {
        setSelectedAppId(appId);
        fetchAppDocuments(appId);
    };

    // Status groups that indicate staff has NOT yet forwarded to bank
    const STAFF_PENDING_STATUSES = new Set(["draft"]);

    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            // Only show applications that have been explicitly forwarded by staff to the bank
            // (i.e., exclude applications still in student/staff review stage)
            const status = (app.status || "").toLowerCase();
            if (STAFF_PENDING_STATUSES.has(status)) return false;

            const matchesSearch =
                (app.applicationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
                (`${app.firstName || ""} ${app.lastName || ""}`).toLowerCase().includes(search.toLowerCase()) ||
                (app.lanNumber || "").toLowerCase().includes(search.toLowerCase());
            return matchesSearch;
        });
    }, [applications, search]);

    // Zero-Click auto-selection of the first student in the list
    useEffect(() => {
        if (mounted && filteredApps.length > 0) {
            const exists = filteredApps.some(app => app.id === selectedAppId);
            if (!exists) {
                setSelectedAppId(filteredApps[0].id);
                fetchAppDocuments(filteredApps[0].id);
            }
        } else if (mounted && filteredApps.length === 0) {
            setSelectedAppId(null);
        }
    }, [filteredApps, selectedAppId, mounted]);

    const currentDocs = useMemo(() => {
        const docs = selectedAppId ? appDocs[selectedAppId] || [] : [];
        return docs.filter((doc: any) => doc.status !== 'not_uploaded');
    }, [selectedAppId, appDocs]);

    // Auto-select first document of selected applicant for preview
    useEffect(() => {
        if (selectedAppId && currentDocs && currentDocs.length > 0) {
            if (!activeViewerDoc || !currentDocs.some((d: any) => d.id === activeViewerDoc.id)) {
                setActiveViewerDoc(currentDocs[0]);
                setViewerAppId(selectedAppId);
                setZoom(100);
                setRotate(0);
                setSelectedThumb(1);
            }
        } else if (selectedAppId && currentDocs && currentDocs.length === 0) {
            setActiveViewerDoc(null);
            setViewerAppId(null);
        }
    }, [selectedAppId, currentDocs, activeViewerDoc]);

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoc || !selectedAppId) return;
        setVerifying(true);

        try {
            const docId = selectedDoc.id.startsWith('vault_') ? selectedDoc.id : `vault_${selectedDoc.id}`;
            const res: any = await adminApi.verifyDocument(
                selectedAppId,
                docId,
                verifyStatus,
                verifyStatus === "rejected" ? rejectionReason : undefined
            );
            if (res && res.success) {
                setShowVerifyModal(false);
                setSelectedDoc(null);
                setRejectionReason("");

                // Force reload documents for this application
                setDocsLoading(prev => ({ ...prev, [selectedAppId]: true }));
                const docsRes: any = await adminApi.getApplicationDocuments(selectedAppId);
                if (docsRes && docsRes.success) {
                    const updatedDocs = docsRes.data || [];
                    setAppDocs(prev => ({ ...prev, [selectedAppId]: updatedDocs }));

                    // If the active viewer document was this document, update its status
                    if (activeViewerDoc && activeViewerDoc.id === selectedDoc.id) {
                        const newDoc = updatedDocs.find((d: any) => d.id === selectedDoc.id);
                        if (newDoc) setActiveViewerDoc(newDoc);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to verify document:", err);
            alert("Failed to submit verification status");
        } finally {
            setVerifying(false);
            setDocsLoading(prev => ({ ...prev, [selectedAppId]: false }));
        }
    };

    const handleDownloadAllZip = async (appId: string) => {
        setZippingId(appId);
        try {
            const blob = await bankApi.downloadDocumentsZip(appId);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `applicant-documents-${appId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to download ZIP file:", err);
            // Simulate ZIP download if endpoint doesn't exist
            alert("📦 ZIP generation triggered. Since the server environment is offline/mocked, the browser will download a mock bundle.zip.");
            const link = document.createElement("a");
            link.href = "/docs/mock-bundle.zip";
            link.setAttribute("download", `bundle-${appId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } finally {
            setZippingId(null);
        }
    };

    const handleOpenViewer = (appId: string, doc: any) => {
        setViewerAppId(appId);
        setActiveViewerDoc(doc);
        setZoom(100);
        setRotate(0);
        setSelectedThumb(1);
    };

    const getDocumentViewUrl = (appId: string, docId: string) => {
        const token = typeof window !== "undefined"
            ? (localStorage.getItem("bankAccessToken") || localStorage.getItem("adminAccessToken") || localStorage.getItem("staffAccessToken") || "")
            : "";
        // If we have a token, pass it as a query param for optional auth
        // The endpoint works without auth too, so this is best-effort
        const base = `/api/applications/admin/${appId}/documents/${docId}/view`;
        return token ? `${base}?token=${token}` : base;
    };

    const getDocumentDownloadUrl = (appId: string, docId: string) => {
        const viewUrl = getDocumentViewUrl(appId, docId);
        // Properly append download param with correct separator
        const sep = viewUrl.includes('?') ? '&' : '?';
        return `${viewUrl}${sep}download=true`;
    };

    const renderThumbnailPreview = (doc: any, page: number) => {
        if (!doc) return null;
        const appId = viewerAppId || selectedAppId;
        if (!appId) return null;

        const url = getDocumentViewUrl(appId, doc.id);
        const fileName = (doc.fileName || "").toLowerCase();
        const filePath = (doc.filePath || "").toLowerCase();
        const mimeType = (doc.mimeType || "").toLowerCase();

        const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf") || filePath.endsWith(".pdf");
        const isDigilocker = filePath.startsWith("in.gov.");
        const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)/i.test(fileName) || /\.(jpg|jpeg|png|webp|gif)/i.test(filePath);

        if (isPdf || isDigilocker) {
            return (
                <iframe
                    src={`${url}#page=${page}&toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-[300%] h-[300%] pointer-events-none scale-[0.33] origin-top-left border-none bg-white"
                    title={`Thumb P${page}`}
                />
            );
        }

        if (isImage) {
            let containerStyle: React.CSSProperties = {
                overflow: "hidden",
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f1f5f9"
            };

            let imgStyle: React.CSSProperties = {
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                pointerEvents: "none"
            };

            if (page === 1) {
                containerStyle.alignItems = "flex-start";
                imgStyle.objectFit = "cover";
                imgStyle.objectPosition = "top center";
                imgStyle.height = "200%";
                imgStyle.maxHeight = "none";
            } else if (page === 2) {
                containerStyle.alignItems = "flex-end";
                imgStyle.objectFit = "cover";
                imgStyle.objectPosition = "bottom center";
                imgStyle.height = "200%";
                imgStyle.maxHeight = "none";
            }

            return (
                <div style={containerStyle}>
                    <img
                        src={url}
                        alt={`Thumb P${page}`}
                        style={imgStyle}
                    />
                </div>
            );
        }

        return <span className="text-[6px] font-bold text-gray-300">P. {page}</span>;
    };

    const renderDocumentPreview = (doc: any, full = false) => {
        if (!doc || !selectedAppId) return null;

        const url = getDocumentViewUrl(selectedAppId, doc.id);
        const downloadUrl = getDocumentDownloadUrl(selectedAppId, doc.id);
        const fileName = (doc.fileName || "").toLowerCase();
        const filePath = (doc.filePath || "").toLowerCase();
        const mimeType = (doc.mimeType || "").toLowerCase();

        const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf") || filePath.endsWith(".pdf");
        const isDigilocker = filePath.startsWith("in.gov.");
        const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)/i.test(fileName) || /\.(jpg|jpeg|png|webp|gif)/i.test(filePath);

        if (isPdf || isDigilocker) {
            return (
                <iframe
                    key={selectedThumb}
                    src={`${url}#page=${selectedThumb}`}
                    className="w-full h-full min-h-[550px] bg-white rounded-lg border border-gray-200 shadow-sm"
                    title={doc.docType || "Document PDF"}
                />
            );
        }

        if (isImage) {
            let containerStyle: React.CSSProperties = {
                overflow: "hidden",
                position: "relative",
                width: "100%",
                height: full ? "80vh" : "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f1f5f9",
                borderRadius: "12px",
                border: "1px solid #e2e8f0"
            };

            let imgStyle: React.CSSProperties = {
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                transform: `scale(${zoom / 100}) rotate(${rotate}deg)`,
                transition: "all 0.2s ease-in-out"
            };

            if (selectedThumb === 1) {
                containerStyle.alignItems = "flex-start";
                imgStyle.objectFit = "cover";
                imgStyle.objectPosition = "top center";
                imgStyle.maxHeight = "none";
                imgStyle.height = "200%";
            } else if (selectedThumb === 2) {
                containerStyle.alignItems = "flex-end";
                imgStyle.objectFit = "cover";
                imgStyle.objectPosition = "bottom center";
                imgStyle.maxHeight = "none";
                imgStyle.height = "200%";
            }

            return (
                <div style={containerStyle}>
                    <motion.img
                        key={selectedThumb}
                        src={url}
                        alt={doc.docType || "Document Image"}
                        style={imgStyle}
                        className="rounded-lg shadow-md"
                    />
                </div>
            );
        }

        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center max-w-md mx-auto">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">draft</span>
                <h4 className="text-sm font-bold text-gray-900 uppercase">{doc.docType?.replace(/_/g, " ")}</h4>
                <p className="text-xs text-gray-500 mt-2">This file type ({doc.mimeType || "Binary"}) cannot be previewed inline.</p>
                <div className="flex gap-2 justify-center mt-4">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md text-xs font-black uppercase tracking-wider transition-all"
                    >
                        <span className="material-symbols-outlined text-xs">open_in_new</span> View Full
                    </a>
                    <a
                        href={downloadUrl}
                        download
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6605c7] hover:bg-[#5203a4] text-white rounded-md text-xs font-black uppercase tracking-wider transition-all"
                    >
                        <span className="material-symbols-outlined text-xs">download</span> Download
                    </a>
                </div>
            </div>
        );
    };

    if (!mounted) return null;

    const selectedApp = applications.find(app => app.id === selectedAppId);
    const isAbroad = selectedApp && selectedApp.universityName && !selectedApp.universityName.toLowerCase().includes("india") && (selectedApp.universityName.toLowerCase().includes("stanford") || selectedApp.universityName.toLowerCase().includes("usc") || selectedApp.universityName.toLowerCase().includes("carnegie") || selectedApp.universityName.toLowerCase().includes("abroad") || selectedApp.universityName.toLowerCase().includes("nyu") || selectedApp.universityName.toLowerCase().includes("london") || selectedApp.universityName.toLowerCase().includes("mit") || selectedApp.universityName.toLowerCase().includes("harvard") || selectedApp.universityName.toLowerCase().includes("university of") || true);

    return (
        <div className="w-full space-y-6 relative z-10">

                {/* Page Header */}
                <PageHeader
                    title="Document Vault"
                    description="Verify identity proofs, academic degrees, and financial assets uploaded by students."
                    moduleName="Document Vault"
                    icon="folder_shared"
                />

                {/* Action Slot & Global Content Layout */}
                <div className="space-y-6">
                    {/* Search student panel */}
                    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-sm">
                        <div className="relative max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                            <input
                                type="text"
                                placeholder="Search Student..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-6 py-2.5 bg-white border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:border-gray-400 transition-all shadow-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                        {/* LEFT PANE: DENSE LEDGER LIST */}
                        <div className="lg:col-span-4 flex flex-col bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden h-[780px]">
                            <div className="p-4 border-b border-[#E2E8F0] bg-gray-50/50 flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Student Ledger ({filteredApps.length})
                                </span>
                            </div>

                            {loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <Spinner message="Syncing document directories..." size="sm" />
                                </div>
                            ) : filteredApps.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <EmptyState message="No concurrent student records match." icon="folder_off" />
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0] no-scrollbar">
                                    {filteredApps.map((app) => {
                                        const isSelected = selectedAppId === app.id;
                                        const isAppAbroad = app.universityName && !app.universityName.toLowerCase().includes("india") && (app.universityName.toLowerCase().includes("stanford") || app.universityName.toLowerCase().includes("usc") || app.universityName.toLowerCase().includes("carnegie") || app.universityName.toLowerCase().includes("abroad") || app.universityName.toLowerCase().includes("nyu") || app.universityName.toLowerCase().includes("london") || app.universityName.toLowerCase().includes("mit") || app.universityName.toLowerCase().includes("harvard") || app.universityName.toLowerCase().includes("university of") || true);
                                        const isPending = !app.lanNumber || app.lanNumber.toLowerCase() === "pending";

                                        return (
                                            <div
                                                key={app.id}
                                                onClick={() => selectApplication(app.id)}
                                                className={`p-4 cursor-pointer transition-all relative select-none ${isSelected
                                                    ? "bg-[#6605c7]/[0.03] border-l-4 border-l-[#6605c7]"
                                                    : "hover:bg-gray-50 border-l-4 border-l-transparent"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight flex items-center gap-1">
                                                            {app.firstName} {app.lastName}
                                                            {isAppAbroad && (
                                                                <span className="material-symbols-outlined text-blue-500 text-[14px] animate-pulse cursor-help" title="Study Abroad Case">public</span>
                                                            )}
                                                        </h3>

                                                        <div className="mt-1 space-y-0.5">
                                                            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>
                                                                ID: {app.applicationNumber}
                                                            </div>
                                                            <div className="flex items-center gap-1.5" style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>
                                                                <span>LAN:</span>
                                                                {isPending ? (
                                                                    <span
                                                                        className="inline-block px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] font-bold text-[11px] uppercase select-none align-middle"
                                                                        style={{ letterSpacing: "0.05em" }}
                                                                    >
                                                                        Pending
                                                                    </span>
                                                                ) : (
                                                                    <span>{app.lanNumber}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate mt-1.5">
                                                            {app.universityName || "Stanford University"}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1.5 text-right shrink-0">
                                                        <span className="text-[10px] font-black text-gray-800">
                                                            {app.amount ? `₹${app.amount.toLocaleString()}` : "—"}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${app.status === "approved" || app.status === "verified" ? "bg-emerald-50 text-emerald-700" :
                                                            app.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                                            }`}>
                                                            {app.status || "pending"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RIGHT PANE: DOCUMENT COMMAND CENTER */}
                        <div className="lg:col-span-8 flex flex-col bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden h-[780px]">
                            {selectedApp ? (
                                <div className="flex flex-col h-full">

                                    {/* Command Center Header */}
                                    <div className="p-5 border-b border-[#E2E8F0] bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
                                                Active Command Center
                                            </span>
                                            <h2 className="text-sm font-black text-gray-950 uppercase tracking-tight mt-0.5">
                                                SELECTED: {selectedApp.firstName} {selectedApp.lastName}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex items-center gap-1.5" style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>
                                                    <span>LAN:</span>
                                                    {(!selectedApp.lanNumber || selectedApp.lanNumber.toLowerCase() === "pending") ? (
                                                        <span
                                                            className="inline-block px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] font-bold text-[11px] uppercase select-none align-middle"
                                                            style={{ letterSpacing: "0.05em" }}
                                                        >
                                                            Pending
                                                        </span>
                                                    ) : (
                                                        <span>{selectedApp.lanNumber}</span>
                                                    )}
                                                </div>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    {selectedApp.universityName || "Stanford University"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Cleanliness: Download All ZIP */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadAllZip(selectedApp.id);
                                            }}
                                            disabled={zippingId === selectedApp.id}
                                            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:text-[#6605c7] hover:border-[#6605c7]/40 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <span className="material-symbols-outlined text-sm">archive</span>
                                            {zippingId === selectedApp.id ? "Zipping..." : "Download All ZIP (.zip)"}
                                        </button>
                                    </div>

                                    {/* Study Abroad Travel & Visa Validation Banner */}
                                    {/* {isAbroad && (
                                        <div className="px-5 py-3.5 bg-blue-50/15 border-b border-[#E2E8F0] space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-sm">public</span>
                                                    Education Abroad Travel & Visa Validation
                                                </h4>
                                                <span className="px-1.5 py-0.2 bg-blue-100/60 text-blue-800 rounded text-[8px] font-black uppercase tracking-widest font-mono">
                                                    Abroad Case
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="flex items-start gap-2 p-2 bg-white border border-gray-100 rounded-md shadow-sm">
                                                    <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                                    <div>
                                                        <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block">Student Visa Status</span>
                                                        <span className="text-[10px] font-bold text-gray-800">F1 Approved (USA)</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2 p-2 bg-white border border-gray-100 rounded-md shadow-sm">
                                                    <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                                    <div>
                                                        <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block">Passport Validity</span>
                                                        <span className="text-[10px] font-bold text-gray-800">Valid (Expires 2031)</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2 p-2 bg-white border border-gray-100 rounded-md shadow-sm">
                                                    <span className="material-symbols-outlined text-amber-500 text-sm">pending</span>
                                                    <div>
                                                        <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block">Flight Booking Proof</span>
                                                        <span className="text-[10px] font-bold text-gray-800">Awaiting schedule</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )} */}

                                    {/* Workspace Body: Split Document Selection Hub & Inline PDF Previewer */}
                                    <div className="flex-1 min-h-0 flex flex-col md:flex-row">

                                        {/* Inline Document Hub */}
                                        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E2E8F0] overflow-y-auto p-4 flex flex-col gap-2 shrink-0">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                                                Inline Document Hub
                                            </span>

                                            {docsLoading[selectedApp.id] ? (
                                                <div className="py-8 flex justify-center">
                                                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            ) : currentDocs.length === 0 ? (
                                                <span className="text-xs text-gray-400 italic py-4 text-center">
                                                    No files uploaded.
                                                </span>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {currentDocs.map((doc: any) => {
                                                        const isDocSelected = activeViewerDoc?.id === doc.id;

                                                        // Format Status Indicators
                                                        const normStatus = (doc.status || "pending").toLowerCase();
                                                        let statusLabel = "Unverified";
                                                        let statusClass = "bg-amber-100 text-amber-800";
                                                        if (normStatus === "verified" || normStatus === "approved") {
                                                            statusLabel = "Checked";
                                                            statusClass = "bg-emerald-100 text-emerald-800";
                                                        } else if (normStatus === "rejected" || normStatus === "cancelled") {
                                                            statusLabel = "Defective";
                                                            statusClass = "bg-rose-100 text-rose-800";
                                                        }

                                                        const docName = (doc.docType || "Document").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

                                                        return (
                                                            <button
                                                                key={doc.id}
                                                                onClick={() => handleOpenViewer(selectedApp.id, doc)}
                                                                className={`w-full text-left p-3 rounded-md border text-xs font-semibold transition-all flex flex-col gap-1.5 ${isDocSelected
                                                                    ? "bg-gray-50 border-gray-400 shadow-sm"
                                                                    : "border-gray-150 bg-white hover:bg-gray-50/50"
                                                                    }`}
                                                            >
                                                                <span className="text-gray-900 font-bold block truncate">
                                                                    {docName}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] text-gray-400 font-bold uppercase">
                                                                        {doc.docType?.toLowerCase().includes("pdf") ? "PDF" : "IMAGE"}
                                                                    </span>
                                                                    <span className="text-gray-300">•</span>
                                                                    <span className={`px-1.5 py-0.2 rounded-[3px] text-[8px] font-black uppercase ${statusClass}`}>
                                                                        {statusLabel}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Inline High-Speed PDF Previewer */}
                                        <div className="flex-1 min-w-0 bg-gray-50/30 overflow-y-auto p-4 flex flex-col">
                                            {activeViewerDoc ? (
                                                <div className="flex-1 flex flex-col h-full min-h-[500px]">

                                                    {/* Active File Header Actions */}
                                                    <div className="mb-3 p-3 bg-white border border-[#E2E8F0] rounded-md flex items-center justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="material-symbols-outlined text-rose-600 text-sm">picture_as_pdf</span>
                                                                <span className="text-xs font-black text-gray-900 uppercase truncate">
                                                                    {activeViewerDoc.docType?.replace(/_/g, " ")}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Status:</span>
                                                                <StatusBadge status={activeViewerDoc.status} />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            {activeViewerDoc.status !== "verified" && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDoc(activeViewerDoc);
                                                                        setVerifyStatus("verified");
                                                                        setShowVerifyModal(true);
                                                                    }}
                                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">done</span>
                                                                    Verify
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedDoc(activeViewerDoc);
                                                                    setVerifyStatus("rejected");
                                                                    setShowVerifyModal(true);
                                                                }}
                                                                className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-xs">close</span>
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Toolbar Controls */}
                                                    <div className="flex items-center justify-between p-2.5 bg-white border-t border-x border-[#E2E8F0] rounded-t-md text-gray-500 text-xs">
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Zoom Out">
                                                                <span className="material-symbols-outlined text-sm">zoom_out</span>
                                                            </button>
                                                            <span className="px-1.5 text-[10px] font-black font-mono">{zoom}%</span>
                                                            <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1 hover:bg-gray-150 rounded text-gray-600" title="Zoom In">
                                                                <span className="material-symbols-outlined text-sm">zoom_in</span>
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => setRotate(r => (r + 90) % 360)} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Rotate document">
                                                                <span className="material-symbols-outlined text-sm">rotate_right</span>
                                                            </button>
                                                            {/* <button onClick={() => setFullscreen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Fullscreen Toggle">
                                                                <span className="material-symbols-outlined text-sm">fullscreen</span>
                                                            </button> */}
                                                            <a
                                                                href={getDocumentViewUrl(selectedApp.id, activeViewerDoc.id)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1 hover:bg-gray-100 rounded text-gray-600 flex items-center"
                                                                title="Full Screen"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                            </a>
                                                            <a
                                                                href={getDocumentDownloadUrl(selectedApp.id, activeViewerDoc.id)}
                                                                download
                                                                className="p-1 hover:bg-gray-100 rounded text-gray-600 flex items-center"
                                                                title="Download document"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">download</span>
                                                            </a>
                                                        </div>
                                                    </div>

                                                    {/* Canvas Container */}
                                                    <div className="flex-1 min-h-[350px] border border-[#E2E8F0] bg-gray-100/60 flex rounded-b-md overflow-hidden">

                                                        {/* Preview Thumbnails */}
                                                        <div className="w-16 border-r border-[#E2E8F0] bg-white p-2 overflow-y-auto flex flex-col gap-2 shrink-0 no-scrollbar">
                                                            {[1, 2, 3].map((page) => (
                                                                <button
                                                                    key={page}
                                                                    onClick={() => setSelectedThumb(page)}
                                                                    className={`p-1 rounded border text-center transition-all flex flex-col items-center gap-1 ${selectedThumb === page
                                                                        ? "border-[#6605c7] bg-[#6605c7]/5 shadow-sm"
                                                                        : "border-gray-200 hover:bg-gray-50"
                                                                        }`}
                                                                >
                                                                    <div className="w-10 h-14 bg-gray-50 border border-gray-200 rounded flex items-center justify-center shadow-inner relative overflow-hidden select-none">
                                                                        {renderThumbnailPreview(activeViewerDoc, page)}
                                                                    </div>
                                                                    <span className="text-[8px] font-semibold text-gray-500">Page {page}</span>
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Preview Main Frame */}
                                                        <div className="flex-1 overflow-auto p-6 flex items-center justify-center h-full min-h-[500px]">
                                                            {renderDocumentPreview(activeViewerDoc, false)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-md bg-white">
                                                    <span className="material-symbols-outlined text-gray-300 text-5xl mb-2">visibility_off</span>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                        Select document asset to preview
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <span className="material-symbols-outlined text-gray-300 text-5xl mb-3">account_box</span>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                        No Student Selected
                                    </h3>
                                    <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                                        Click a student on the left ledger to review educational credentials and assets.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            {/* Premium Fullscreen View Modal */}
            <AnimatePresence>
                {fullscreen && activeViewerDoc && viewerAppId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFullscreen(false)} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-none border border-gray-100 shadow-2xl z-10 relative overflow-hidden flex flex-col w-screen h-screen max-w-none max-h-none p-0"
                        >
                            {/* Viewer Header */}
                            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-rose-500 bg-rose-50 p-2 rounded-xl text-xl">
                                        picture_as_pdf
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                            {activeViewerDoc.docType?.replace(/_/g, " ")}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Verification:</span>
                                            <StatusBadge status={activeViewerDoc.status} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Action Bar */}
                                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/50 p-1.5 rounded-xl text-gray-500 text-xs font-semibold">
                                        <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1.5 hover:bg-white rounded-lg hover:text-gray-800" title="Zoom Out">
                                            <span className="material-symbols-outlined text-sm">zoom_out</span>
                                        </button>
                                        <span className="px-2 text-[10px] font-black font-mono">{zoom}%</span>
                                        <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1.5 hover:bg-white rounded-lg hover:text-gray-800" title="Zoom In">
                                            <span className="material-symbols-outlined text-sm">zoom_in</span>
                                        </button>
                                        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
                                        <button onClick={() => setRotate(r => (r + 90) % 360)} className="p-1.5 hover:bg-white rounded-lg hover:text-gray-800" title="Rotate">
                                            <span className="material-symbols-outlined text-sm">rotate_right</span>
                                        </button>
                                        <button onClick={() => setFullscreen(false)} className="p-1.5 hover:bg-white rounded-lg hover:text-gray-800" title="Exit Fullscreen">
                                            <span className="material-symbols-outlined text-sm">fullscreen_exit</span>
                                        </button>
                                    </div>

                                    {/* Open in New Tab */}
                                    <a
                                        href={getDocumentViewUrl(viewerAppId || "", activeViewerDoc.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                                        View Full
                                    </a>

                                    {/* Direct Download */}
                                    <a
                                        href={getDocumentDownloadUrl(viewerAppId || "", activeViewerDoc.id)}
                                        download
                                        className="px-3.5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-xs">download</span>
                                        Download
                                    </a>

                                    <button
                                        onClick={() => setFullscreen(false)}
                                        className="w-10 h-10 bg-gray-50 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Viewer Body: Thumbnails + Main View */}
                            <div className="flex-1 min-h-0 flex bg-gray-100">
                                {/* Thumbnails Column */}
                                <div className="w-40 border-r border-gray-200 bg-white/70 backdrop-blur-sm p-4 overflow-y-auto shrink-0 flex flex-col gap-3">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Page Index</span>
                                    {[1, 2, 3].map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setSelectedThumb(page)}
                                            className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${selectedThumb === page
                                                ? "border-[#6605c7] bg-[#6605c7]/5 shadow-sm"
                                                : "border-gray-200 hover:bg-gray-50"
                                                }`}
                                        >
                                            <div className="w-24 h-32 bg-gray-50 border border-gray-200 rounded flex items-center justify-center shadow-inner relative overflow-hidden select-none">
                                                {renderThumbnailPreview(activeViewerDoc, page)}
                                            </div>
                                            <span className="text-[9px] font-black text-gray-500">Page {page}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Main Document Canvas */}
                                <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                                    {renderDocumentPreview(activeViewerDoc, true)}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Document Verify Modal */}
            <AnimatePresence>
                {showVerifyModal && selectedDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowVerifyModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-lg border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Verify Document Asset</h3>
                            <p className="text-xs text-gray-400 mb-6 font-bold uppercase tracking-wider">Acknowledge suitability or specify defects for resubmission.</p>

                            <form onSubmit={handleVerifySubmit} className="space-y-5">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Audit Verdict</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setVerifyStatus("verified")}
                                            className={`py-3 px-4 border rounded-md flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all ${verifyStatus === "verified"
                                                ? "border-emerald-600 bg-emerald-50 text-emerald-600"
                                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            Accept Asset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setVerifyStatus("rejected")}
                                            className={`py-3 px-4 border rounded-md flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all ${verifyStatus === "rejected"
                                                ? "border-rose-600 bg-rose-50 text-rose-600"
                                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">cancel</span>
                                            Reject Asset
                                        </button>
                                    </div>
                                </div>

                                {verifyStatus === "rejected" && (
                                    <div>
                                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Defect description</label>
                                        <textarea
                                            required
                                            rows={3}
                                            placeholder="Provide reasoning for reject verdict (e.g. Blurry photo, expired date)..."
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-4 pt-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowVerifyModal(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={verifying}
                                        className="flex-1 py-3 bg-[#6605c7] text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-[#5203a4] shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center"
                                    >
                                        {verifying ? "..." : "Save Audit"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
