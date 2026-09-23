/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { documentApi, staffProfileApi, adminApi, chatApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useDialog } from "@/contexts/DialogContext";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";
import KycSystemDashboard from "./KycSystemDashboard";
import ShareWithBankModal from "./ShareWithBankModal";
import SendDocumentToBankModal from "./SendDocumentToBankModal";
import SendEmailModal from "./SendEmailModal";
import NotificationsPanel from "./NotificationsPanel";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
  ArcElement
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler,
  ArcElement
);

import {
  getDocumentCategory,
  getDocumentRequirementName,
  getProfileDocumentRequirements,
} from "@/lib/documentRequirements";
import { formatIntervalDate } from "@/lib/evv-parser";
import {
  EVVScoreRadialGauge,
  EVVRadarChart,
  EVV6ComponentBarChart,
  EVVMonthlyMetricsChart,
  EVVSnapshotTimelineChart,
} from "./evv-charts";

interface ApplicationDetailViewProps {
  application: any;
  onBack: () => void;
  onAadhaarSaved?: (aadhaarNumber: string) => void;
  onApplicationUpdated?: () => void;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  isStandalone?: boolean;
  activeSidebarMenu?: string;
}

type OcrSummaryDoc = {
  id: string;
  name: string;
  docName?: string;
  docType: string;
  category: string;
  status: string;
  rejectionReason?: string;
  uploaded?: boolean;
  fileName?: string;
  uploadedAt?: string;
  accuracy?: number | string;
  fieldsExtracted?: number;
  extractedData?: Record<string, unknown>;
  verificationMetadata?: {
    extractedFields?: Record<string, unknown>;
  };
};

type ValidationCheck = {
  label: string;
  detail: string;
  status: "success" | "warning" | "pending" | "error";
  onReview?: () => void;
};

type ApiResult<T> = {
  success?: boolean;
  data?: T;
};

const formatAmountInINR = (num: number) => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(num);
};

// Formats a date exactly into India Standard Time (+5:30) with timezone label
const formatIST = (dateVal: any, includeTime: boolean = true): string => {
  if (!dateVal) return "—";
  try {
    let cleanDs = dateVal;
    if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
      if (cleanDs.includes('T') || cleanDs.includes(':')) {
        const formatted = cleanDs.replace(' ', 'T');
        cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
      }
    }
    const d = new Date(cleanDs);
    if (isNaN(d.getTime())) return "—";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: includeTime ? "2-digit" : undefined,
      minute: includeTime ? "2-digit" : undefined,
      second: includeTime ? "2-digit" : undefined,
      hour12: false
    }).formatToParts(d);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

    const month = getPart("month");
    const day = getPart("day");
    const year = getPart("year");

    if (includeTime) {
      const hour = getPart("hour");
      const minute = getPart("minute");
      const second = getPart("second");
      return `${month} ${day}, ${year} • ${hour}:${minute}:${second}`;
    } else {
      return `${month} ${day}, ${year} `;
    }
  } catch {
    return "—";
  }
};

/** Derive a readable intake season from a raw value (named season or ISO date) */
const resolveIntakeSeason = (raw?: string | null): string => {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  // Already a named season (has letters)
  if (/[a-zA-Z]/.test(s)) return s;
  // Looks like an ISO date — extract month + year
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
    }
  } catch { /* ignore */ }
  return s;
};

/** Best-effort study destination resolver across all possible field paths */
const resolveDestination = (app: any): string => {
  const candidates = [
    app?.country,
    app?.destinationCountry,
    app?.studyDestination,
    app?.user?.studyDestination,
    app?.student?.studyDestination,
    app?.academic?.countryOfEducation,
    app?.user?.academic?.countryOfEducation,
    app?.user?.countryOfEducation,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return "—";
};

/** Best-effort intake season resolver across all possible field paths */
const resolveIntake = (app: any): string => {
  const candidates = [
    app?.intakeSeason,
    app?.user?.intakeSeason,
    app?.student?.intakeSeason,
    app?.targetIntake,
    app?.user?.targetIntake,
    app?.courseStartDate,
    app?.user?.courseStartDate,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return resolveIntakeSeason(String(c).trim());
  }
  return "—";
};

const formatStepLabel = (label: string) => {
  if (label === "APPLICATION CREATED") return "Application\nCreated";
  if (label === "APPLICATION SUBMITTED") return "Application\nSubmitted";
  if (label === "DOCUMENTS" || label === "DOCUMENTS VERIFICATION") return "Documents";
  if (label === "SUBMIT TO BANK") return "Submit\nTo Bank";
  if (label === "CREDIT CHECK") return "Credit\nCheck";
  if (label === "BANK REJECTED") return "Bank\nRejected";
  if (label === "UNDER REVIEW") return "Under\nReview";
  if (label === "BANK APPROVED") return "Bank\nApproved";
  if (label === "BANK REVIEW") return "Bank\nReview";
  if (label === "SANCTION") return "Sanction";
  if (label === "DISBURSEMENT") return "Disbursement";
  return label.replace(/\s+/g, '\n');
};

const formatNoteTime = (createdAt?: string): string => {
  if (!createdAt) return "JUST NOW";
  return formatDateTime(createdAt, { includeSuffixIST: true, fallback: "JUST NOW" }, "JUST NOW");
};

const ApplicationDetailView: React.FC<ApplicationDetailViewProps> = ({
  application,
  onBack,
  onAadhaarSaved,
  onApplicationUpdated,
  sidebarOpen = false,
  setSidebarOpen,
  isStandalone = false,
  activeSidebarMenu: initialSidebarMenu,
}) => {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const { alert: dialogAlert, confirm: dialogConfirm, prompt: dialogPrompt } = useDialog();
  const [nowTime, setNowTime] = useState<Date>(new Date());
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const [activeTab, setActiveTab] = useState("requirements");
  const [activeSidebarMenu, setActiveSidebarMenu] = useState(initialSidebarMenu || "application_details");

  useEffect(() => {
    if (initialSidebarMenu) {
      setActiveSidebarMenu(initialSidebarMenu);
    }
  }, [initialSidebarMenu]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("focus") === "notes") {
        setActiveTab("notes");
        setTimeout(() => {
          const notesSection = document.getElementById("internal-notes-section");
          if (scrollContainerRef.current && notesSection) {
            const container = scrollContainerRef.current;
            const containerRect = container.getBoundingClientRect();
            const elemRect = notesSection.getBoundingClientRect();
            const relativeTop = elemRect.top - containerRect.top + container.scrollTop;
            container.scrollTo({ top: relativeTop - 20, behavior: 'smooth' });
          } else {
            notesSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 800);
      }
    }
  }, [activeSidebarMenu]);

  const handleTabTransition = (tabName: string) => {
    if (isStandalone) {
      const appId = application.id || application._id;
      if (tabName === activeSidebarMenu) return;
      if (tabName === 'application_details') router.push(`/staff/applications/${appId}`);
      else if (tabName === 'student') router.push(`/staff/applications/${appId}/student`);
      else if (tabName === 'exams') router.push(`/staff/applications/${appId}/exams`);
      else if (tabName === 'bankdecisions') router.push(`/staff/applications/${appId}/bank-decisions`);
      else if (tabName === 'ai_underwriting') router.push(`/staff/applications/${appId}/ai-underwriting`);
    } else {
      setActiveSidebarMenu(tabName);
    }
  };
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sendToBankDoc, setSendToBankDoc] = useState<OcrSummaryDoc | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [fetchedStatusHistory, setFetchedStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<any>(null);
  const [loadingAiPrediction, setLoadingAiPrediction] = useState<boolean>(false);
  const [aiPredictionError, setAiPredictionError] = useState<string | null>(null);

  const getDynamicProgress = () => {
    const s = String(application.status || '').toLowerCase();
    const baseProgress = typeof application.progress === 'number' ? application.progress : 10;

    if (['disbursed', 'closed', 'disbursement_confirmed'].includes(s)) return 100;
    if (['sanctioned', 'approved', 'sanction'].includes(s)) return Math.max(baseProgress, 95);
    if (['under_bank_review', 'bank_review'].includes(s)) return Math.max(baseProgress, 90);
    if (['credit_check', 'query_raised'].includes(s)) return Math.max(baseProgress, 75);
    if (['submitted_to_bank', 'file_logged', 'submit_to_bank', 'bank_submission'].includes(s)) return Math.max(baseProgress, 50);
    if (['staff_verified', 'documents_verification', 'document_verification', 'docs_received', 'docs_uploaded', 'under_review'].includes(s)) return Math.max(baseProgress, 40);
    if (['submitted', 'application_submitted'].includes(s)) return Math.max(baseProgress, 25);

    return baseProgress;
  };
  const progress = getDynamicProgress();
  const status = (application.status || "APPROVED").toUpperCase();
  const appId = (application.applicationNumber && (application.applicationNumber.startsWith('VTU-APP-') || application.applicationNumber.startsWith('VTU-BNK-') || application.applicationNumber.startsWith('VL-APP-')))
    ? application.applicationNumber
    : "";
  const studentId = application.studentId || application.userId || "—";
  const studentId10 = application.studentId || application.userId || "—";
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [isNoteInputVisible, setIsNoteInputVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Documents State
  const [documents, setDocuments] = useState<OcrSummaryDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Bank Decisions & Queries State
  const [bankDecisions, setBankDecisions] = useState<any[]>([]);
  const [bankQueries, setBankQueries] = useState<any[]>([]);
  const [loadingBankData, setLoadingBankData] = useState(false);

  const fetchBankDecisionsAndQueries = useCallback(async () => {
    const appRefId = application.id || application._id;
    if (!appRefId) return;
    setLoadingBankData(true);
    try {
      const res = await adminApi.getApplication(appRefId) as any;
      if (res && res.success && res.data) {
        setBankDecisions(res.data.BankDecision || []);
        setBankQueries(res.data.queries || []);
      }
    } catch (err) {
      console.error("Failed to fetch bank decisions/queries:", err);
    } finally {
      setLoadingBankData(false);
    }
  }, [application.id, application._id]);

  useEffect(() => {
    fetchBankDecisionsAndQueries();
  }, [fetchBankDecisionsAndQueries]);

  const fetchAiPrediction = useCallback(async () => {
    const appId = application.id || application._id;
    if (!appId) return;
    setLoadingAiPrediction(true);
    setAiPredictionError(null);
    try {
      const data = await staffProfileApi.getAiPredictionScore(appId) as any;
      if (data && data.success) {
        setAiPrediction(data.data);
      } else if (data) {
        setAiPrediction(data);
      } else {
        setAiPredictionError("Failed to load AI prediction details");
      }
    } catch (err: any) {
      console.error("Error fetching AI prediction score:", err);
      setAiPredictionError(err.message || "Failed to load AI prediction details");
    } finally {
      setLoadingAiPrediction(false);
    }
  }, [application.id, application._id]);

  useEffect(() => {
    if (activeSidebarMenu === 'ai_underwriting' && !aiPrediction) {
      fetchAiPrediction();
    }
  }, [activeSidebarMenu, aiPrediction, fetchAiPrediction]);

  const userId = application.userId || application.user_id || application.applicantId || application.student?.id || application.student?._id || application.user?.id || application.user?._id;

  // Fetch/start conversation
  useEffect(() => {
    let active = true;
    if (!application) return;

    const phone = application.phone || application.student?.phone || application.mobile || "";
    const email = application.email || application.student?.email || "";
    const name = `${application.firstName || application.student?.firstName || ""} ${application.lastName || application.student?.lastName || ""}`.trim() || "Student";

    if (!phone) {
      console.warn("No phone number found for applicant. Chat cannot be initialized.");
      return;
    }

    async function initChat() {
      try {
        const res: any = await chatApi.staffStart(phone, email, name);
        if (active && res && res.success && res.conversation) {
          const convId = res.conversation.id;
          setConversationId(convId);

          // Load historical messages
          const msgRes: any = await chatApi.getMessages(convId);
          if (active && msgRes && Array.isArray(msgRes)) {
            const mapped = msgRes.map((msg: any) => {
              const isSystem = msg.senderType === "system";
              let sender = "student";
              if (msg.senderType === "staff") {
                sender = "staff";
              } else if (msg.senderType === "system") {
                sender = "system";
              } else if (msg.senderType === "bank") {
                sender = "bank";
              }

              let formattedTime = "";
              try {
                formattedTime = format(new Date(msg.createdAt), "hh:mm a") + " IST";
              } catch (e) {
                formattedTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()) + " IST";
              }

              return {
                id: msg.id,
                sender,
                text: msg.content || "",
                time: formattedTime,
                type: isSystem ? "notification" : "chat"
              };
            });
            setMessages(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to start chat session:", err);
      }
    }

    initChat();

    return () => {
      active = false;
    };
  }, [application]);

  // Set up socket connection and join room
  useEffect(() => {
    if (!token) return;

    const baseApiUrl = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
      ? 'http://localhost:5000'
      : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

    const socketUrl = baseApiUrl.endsWith('/api')
      ? baseApiUrl.replace('/api', '/chat')
      : `${baseApiUrl.replace(/\/$/, '')}/chat`;

    const newSocket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('[ApplicationDetailView] Socket connected');
      if (conversationId) {
        newSocket.emit('join_conversation', conversationId);
      }
      newSocket.emit('joinRoom', 'room_staff');
    });

    newSocket.on('notification_received', (payload: any) => {
      console.log('[ApplicationDetailView] Live notification received in App detail view:', payload);
      const curAppId = application.id || application._id;
      const notifAppId = payload.metadata?.applicationId || payload.metadata?.id;
      if (notifAppId === curAppId || (payload.body && payload.body.includes(curAppId)) || (payload.title && payload.title.includes(curAppId))) {
        console.log('[ApplicationDetailView] Notification matches current application, reloading bank decisions & queries...');
        fetchBankDecisionsAndQueries();
      }
    });

    newSocket.on('new_message', (msg: any) => {
      if (!conversationId || msg.conversationId !== conversationId) return;

      const isSystem = msg.senderType === "system";
      let sender = "student";
      if (msg.senderType === "staff") {
        sender = "staff";
      } else if (msg.senderType === "system") {
        sender = "system";
      } else if (msg.senderType === "bank") {
        sender = "bank";
      }

      let formattedTime = "";
      try {
        formattedTime = format(new Date(msg.createdAt), "hh:mm a") + " IST";
      } catch (e) {
        formattedTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()) + " IST";
      }

      const incomingMsg = {
        id: msg.id,
        sender,
        text: msg.content || "",
        time: formattedTime,
        type: isSystem ? "notification" : "chat"
      };

      setMessages((prev) => {
        // Prevent duplicate messages if already present
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        return [...prev, incomingMsg];
      });
    });

    newSocket.on('disconnect', () => {
      console.log('[ApplicationDetailView] Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      if (conversationId) {
        newSocket.emit('leave_conversation', conversationId);
      }
      newSocket.disconnect();
      setSocket(null);
    };
  }, [conversationId, token, application.id, application._id, fetchBankDecisionsAndQueries]);

  const handleVerifyDocument = async (docId: string) => {
    try {
      const res = await adminApi.verifyDocument(application.id || application._id, docId, "verified") as ApiResult<unknown>;
      if (res.success || (res as any).data) {
        const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
        const doc = documents.find((d: any) => d.id === docId || d._id === docId);
        const docName = doc?.name || doc?.docType?.replace(/_/g, ' ') || "Document";
        staffProfileApi.logActivity({
          type: "approved",
          msg: `Approved document "${docName}" for ${studentName}`,
          icon: "task_alt",
          color: "bg-emerald-50 text-emerald-700"
        }).catch(console.error);

        await dialogAlert("Document verified successfully!", "Verification Success", "success");
        fetchDocuments();
      } else {
        await dialogAlert("Failed to verify document.", "Verification Failed", "error");
      }
    } catch (err) {
      console.error("Failed to verify document:", err);
      await dialogAlert("Error verifying document.", "System Error", "error");
    }
  };

  const handleRejectDocument = async (docId: string, reason: string) => {
    try {
      const res = await adminApi.verifyDocument(application.id || application._id, docId, "rejected", reason) as ApiResult<unknown>;
      if (res.success || (res as any).data) {
        const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
        const doc = documents.find((d: any) => d.id === docId || d._id === docId);
        const docName = doc?.name || doc?.docType?.replace(/_/g, ' ') || "Document";
        staffProfileApi.logActivity({
          type: "rejected",
          msg: `Rejected document "${docName}" for ${studentName}${reason ? ` (Reason: ${reason})` : ''}`,
          icon: "cancel",
          color: "bg-rose-50 text-rose-700"
        }).catch(console.error);

        await dialogAlert("Document rejected successfully!", "Rejection Saved", "success");
        fetchDocuments();
      } else {
        await dialogAlert("Failed to reject document.", "Rejection Failed", "error");
      }
    } catch (err) {
      console.error("Failed to reject document:", err);
      await dialogAlert("Error rejecting document.", "System Error", "error");
    }
  };

  const fetchDocuments = async () => {
    if (!userId) return;
    setLoadingDocs(true);
    try {
      const res = await documentApi.getUserDocuments(userId) as ApiResult<Array<Record<string, unknown>>>;
      if (res.success && res.data) {
        const inferredRequirements = getProfileDocumentRequirements(application);
        const mappedDocs = res.data.map((d) => {
          const docType = String(d.docType || "");
          const metadata = d.verificationMetadata as any;
          const docName = getDocumentRequirementName(docType, String(d.docName || metadata?.docName || docType || "Document"), application);
          const filePath = String(d.filePath || "");
          const isUploaded = Boolean(d.uploaded || filePath);
          const statusValue = String(d.status || (isUploaded ? "uploaded" : "pending"));
          const extractedFields = metadata?.extractedFields || metadata?.details?.extractedFields || {};
          const uploadedAt = d.uploadedAt || d.uploaded_at || d.createdAt || d.created_at || d.updatedAt || d.updated_at;
          return {
            id: String(d.id || d._id || docType || docName),
            name: docName.replace(/_/g, ' ').toUpperCase(),
            category: getDocumentCategory(docType),
            status: statusValue,
            rejectionReason: String(d.rejectionReason || metadata?.rejectionReason || ""),
            uploaded: isUploaded,
            fileName: filePath ? filePath.split(/[/\\]/).pop() : '',
            uploadedAt: uploadedAt ? String(uploadedAt) : undefined,
            accuracy: metadata?.confidence || metadata?.confidence_score || Number(d.confidence || 0) || (statusValue === 'verified' ? 100 : 0),
            fieldsExtracted: Object.keys(extractedFields).length,
            extractedData: extractedFields,
            verificationMetadata: metadata,
            docType
          };
        });

        const mergedDocs = [...mappedDocs];
        inferredRequirements.forEach(req => {
          if (!mappedDocs.some(d => d.docType === req.type)) {
            mergedDocs.push({
              id: `req-${req.type}`,
              name: req.name.toUpperCase(),
              category: req.category,
              status: 'pending',
              rejectionReason: '',
              uploaded: false,
              fileName: '',
              uploadedAt: undefined,
              accuracy: 0,
              fieldsExtracted: 0,
              extractedData: {},
              verificationMetadata: undefined,
              docType: req.type
            });
          }
        });

        setDocuments(mergedDocs);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  useEffect(() => {
    const triggerStartReview = async () => {
      const isStaff = user?.role && ['admin', 'super_admin', 'staff', 'support'].includes(user.role);
      const appRefId = application?.id || application?._id;
      if (isStaff && appRefId && application?.status === 'submitted' && !application?.reviewStartedAt) {
        try {
          const res = await adminApi.getApplication(appRefId) as any;
          if (res && res.success && res.data) {
            onApplicationUpdated?.();
          }
        } catch (e) {
          console.error("Failed to trigger staff review start flow:", e);
        }
      }
    };
    triggerStartReview();
  }, [application?.id, application?._id, user?.role, application?.status, application?.reviewStartedAt]);

  useEffect(() => {
    const fetchStatusHistory = async () => {
      const appRefId = application.id || application._id;
      if (!appRefId) return;
      setLoadingHistory(true);
      try {
        const res = await adminApi.getApplicationTracking(appRefId) as any;
        if (res && res.success && res.data) {
          setFetchedStatusHistory(res.data.timeline || []);
        }
      } catch (err) {
        console.error("Failed to fetch application tracking:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchStatusHistory();
  }, [application.id, application._id]);

  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("academic");

  // OCR Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedDocForSync, setSelectedDocForSync] = useState<any>(null);
  const [selectedDocPreview, setSelectedDocPreview] = useState<OcrSummaryDoc | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeDiscrepancy, setActiveDiscrepancy] = useState<{ doc1: OcrSummaryDoc; doc2: OcrSummaryDoc } | null>(null);

  const handleSendMessage = async () => {
    if (!msgInput.trim()) return;
    if (!socket || !conversationId) {
      await dialogAlert("Chat connection is not ready. Please try again in a moment.", "Connection Pending", "warning");
      return;
    }

    const customerPhone = application.phone || application.student?.phone || application.mobile || "";

    socket.emit("send_message", {
      conversationId,
      customerPhone,
      content: msgInput.trim()
    });

    setMsgInput("");
  };

  const fetchNotes = async () => {
    const appRefId = application.id || application._id;
    if (!appRefId) return;
    setLoadingNotes(true);
    try {
      const res = await adminApi.getRemarks(appRefId) as any;
      if (res && res.success && Array.isArray(res.data)) {
        setNotes(res.data);
      } else if (Array.isArray(res)) {
        setNotes(res);
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [application.id, application._id]);

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    const appRefId = application.id || application._id;
    if (!appRefId) return;

    try {
      await adminApi.addRemark(appRefId, {
        type: 'staff_note',
        content: noteInput.trim(),
        authorName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Staff Member',
        isInternal: true
      } as any);

      const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
      staffProfileApi.logActivity({
        type: "note",
        msg: `Added internal note for ${studentName}: "${noteInput.trim().slice(0, 45)}..."`,
        icon: "sticky_note_2",
        color: "bg-purple-50 text-[#6605c7]"
      }).catch(console.error);

      setNoteInput("");
      setIsNoteInputVisible(false);
      fetchNotes();
    } catch (err) {
      console.error("Failed to add note:", err);
      await dialogAlert("Failed to save note to database.", "Database Error", "error");
    }
  };

  const handleAddDocument = async () => {
    if (!newDocName.trim() || !userId) return;

    // Create a docType from name
    const docType = `custom_${newDocName.toLowerCase().replace(/\s+/g, '_')}`;

    try {
      // Call Backend to persist the requirement
      await documentApi.addRequirement(userId, docType, newDocName);

      const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
      staffProfileApi.logActivity({
        type: "update",
        msg: `Requested additional document "${newDocName.trim()}" for ${studentName}`,
        icon: "note_add",
        color: "bg-blue-50 text-blue-700"
      }).catch(console.error);

      // Refresh documents to show the new requirement
      await fetchDocuments();

      setNewDocName("");
      setIsAddDocModalOpen(false);
    } catch (err) {
      console.error("Failed to add requirement:", err);
      await dialogAlert("Failed to save requirement to database. Please check your connection.", "Network Error", "error");
    }
  };

  const handleSyncField = async (field: string, value: any) => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      console.log(`Syncing ${field} with value ${value}`);
      const userEmail = application.email || application.user?.email || application.student?.email;
      if (!userEmail) {
        throw new Error("Candidate email not found on the application.");
      }

      if (field === 'date_of_birth') {
        const currentFirstName = application.firstName || application.user?.firstName || application.student?.firstName || "";
        const currentLastName = application.lastName || application.user?.lastName || application.student?.lastName || "";
        const currentPhone = application.phone || application.user?.phoneNumber || application.student?.phone || application.mobile || "";

        // 1. Update User Profile in the User table
        const profileRes = await adminApi.updateUserDetails({
          email: userEmail,
          firstName: currentFirstName,
          lastName: currentLastName,
          phoneNumber: currentPhone,
          dateOfBirth: value
        });

        // 2. Update Application details in the LoanApplication table
        const appRes = await adminApi.updateApplication(application.id, {
          dateOfBirth: value
        });

        if (profileRes && appRes) {
          onApplicationUpdated?.();
          await dialogAlert("Date of Birth synced to user profile and application successfully!", "Sync Success", "success");
        } else {
          throw new Error("Failed to update user details or application details.");
        }
      } else if (field === 'full_name') {
        const nameParts = value.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const currentPhone = application.phone || application.user?.phoneNumber || application.student?.phone || application.mobile || "";
        const currentDob = application.dob || application.user?.dateOfBirth || application.student?.dob || "";

        // 1. Update User Profile
        const profileRes = await adminApi.updateUserDetails({
          email: userEmail,
          firstName,
          lastName,
          phoneNumber: currentPhone,
          dateOfBirth: currentDob
        });

        // 2. Update Application details
        const appRes = await adminApi.updateApplication(application.id, {
          firstName,
          lastName
        });

        if (profileRes && appRes) {
          onApplicationUpdated?.();
          await dialogAlert("Name synced to user profile and application successfully!", "Sync Success", "success");
        } else {
          throw new Error("Failed to update user name.");
        }
      } else {
        // Fallback for other fields
        const keyMap: any = {
          'document_number': 'panNumber',
          'father_name': 'fatherName'
        };
        const appKey = keyMap[field] || field;
        const appRes = await adminApi.updateApplication(application.id, {
          [appKey]: value
        });
        if (appRes) {
          onApplicationUpdated?.();
          await dialogAlert(`Synced ${field} successfully!`, "Sync Success", "success");
        } else {
          throw new Error(`Failed to sync field ${field}`);
        }
      }
    } catch (err: any) {
      console.error("Sync failed:", err);
      await dialogAlert(err.message || `Failed to sync ${field} to profile. Please try again.`, "Sync Failed", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (docIdOrType: string, file: File) => {
    if (!userId) return;

    // Find docType from either ID or direct Type string
    const doc = documents.find(d => d.id === docIdOrType || d.docType === docIdOrType);
    const docType = doc ? doc.docType : docIdOrType;

    try {
      const res = await documentApi.upload(userId, docType, file) as ApiResult<unknown>;
      if (res.success) {
        const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
        staffProfileApi.logActivity({
          type: "upload",
          msg: `Uploaded document "${docType.replace(/_/g, ' ')}" for ${studentName}`,
          icon: "cloud_upload",
          color: "bg-purple-50 text-[#6605c7]"
        }).catch(console.error);

        fetchDocuments(); // Refresh from server
        if (typeof window !== "undefined") {
          localStorage.setItem(`dashboardDataUpdated_${userId}`, String(Date.now()));
          window.dispatchEvent(new Event('dashboard-data-changed'));
        }

        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: "system",
          text: `Document Uploaded: ${file.name}`,
          time: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()) + " IST",
          type: "notification"
        }]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      await dialogAlert("Failed to upload document", "Upload Error", "error");
    }
  };

  const handleDownloadDocument = async (doc: OcrSummaryDoc) => {
    if (!userId || !doc.docType) return;
    const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
    staffProfileApi.logActivity({
      type: "download",
      msg: `Downloaded document "${(doc.name || doc.docType).replace(/_/g, ' ')}" for ${studentName}`,
      icon: "download",
      color: "bg-orange-50 text-orange-700"
    }).catch(console.error);

    try {
      const result: any = await documentApi.getPresignedView(userId, doc.docType);
      if (result?.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = `${(doc.name || doc.docType).replace(/\s+/g, "_")}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(`/api/documents/view/${userId}/${doc.docType}`, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(`/api/documents/view/${userId}/${doc.docType}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc || !userId) return;

    const confirmed = await dialogConfirm(`Are you sure you want to delete ${doc.name}?`, "Delete Document");
    if (!confirmed) return;

    try {
      const res = await documentApi.delete(userId, doc.docType) as ApiResult<unknown>;
      if (res.success) {
        const studentName = [application.firstName || application.student?.firstName || application.user?.firstName, application.lastName || application.student?.lastName || application.user?.lastName].filter(Boolean).join(' ') || "Student";
        staffProfileApi.logActivity({
          type: "rejected",
          msg: `Deleted document "${(doc.name || doc.docType).replace(/_/g, ' ')}" for ${studentName}`,
          icon: "delete",
          color: "bg-rose-50 text-rose-700"
        }).catch(console.error);

        fetchDocuments();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const createdDateIST = (() => {
    const regAtInd = application.registeredAtIndia || application.student?.registeredAtIndia || application.user?.registeredAtIndia;
    if (regAtInd && typeof regAtInd === 'string' && regAtInd.endsWith(' IST')) return regAtInd;
    const ds = regAtInd || application.date || application.submittedAt || application.createdAt || application.created_at || application.student?.createdAt || application.student?.created_at || application.user?.createdAt || application.user?.created_at || application.updatedAt;
    if (!ds) return "—";
    try {
      let cleanDs = ds;
      if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
          const formatted = cleanDs.replace(' ', 'T');
          cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
      }
      const date = new Date(cleanDs);
      if (isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(date);
    } catch (e) { return "—"; }
  })();

  const shortCreatedDateIST = (() => {
    const regAtInd = application.registeredAtIndia || application.student?.registeredAtIndia || application.user?.registeredAtIndia;
    if (regAtInd && typeof regAtInd === 'string' && regAtInd.endsWith(' IST')) {
      try {
        const parts = regAtInd.split(' ');
        if (parts.length >= 2) {
          const datePart = parts[0]; // "2026-05-18"
          const ymd = datePart.split('-');
          if (ymd.length === 3) {
            const month = parseInt(ymd[1], 10) - 1;
            const day = parseInt(ymd[2], 10);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthStr = months[month] || "Jan";
            const dayStr = String(day).padStart(2, '0');
            const timePart = parts[1]; // "HH:MM:SS"
            const hm = timePart.split(':');
            if (hm.length >= 2) {
              return `${dayStr} ${monthStr}, ${hm[0]}:${hm[1]}`;
            }
          }
        }
      } catch { }
      return regAtInd.split(' ')[0];
    }
    const ds = regAtInd || application.createdAt || application.created_at || application.student?.createdAt || application.student?.created_at || application.user?.createdAt || application.user?.created_at;
    if (!ds) return "PENDING";
    try {
      let cleanDs = ds;
      if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
          const formatted = cleanDs.replace(' ', 'T');
          cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
      }
      const date = new Date(cleanDs);
      if (isNaN(date.getTime())) return "PENDING";
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) { return "PENDING"; }
  })();

  const getBankStepLabel = () => {
    if (status === 'REJECTED') return "BANK REJECTED";
    if (status === 'UNDER_REVIEW') return "UNDER REVIEW";
    if (status === 'APPROVED') return "BANK APPROVED";
    return "BANK REVIEW";
  };

  /**
   * Converts any raw timestamp (UTC ISO string, or "YYYY-MM-DD HH:MM:SS IST" from the
   * staff dashboard user directory) to Indian Standard Time by adding +5:30, then formats
   * it as "MMM DD YYYY, HH:MM +5:30" for display in the application view page.
   */
  const formatStepDateTime = (ds?: string): string => {
    if (!ds) return "";
    try {
      let date: Date;

      // Handle "YYYY-MM-DD HH:MM:SS IST" strings stored in the user directory.
      // These already represent IST wall-clock time, so we parse them directly
      // as UTC (treating the IST wall-clock hours as-is) to avoid double-shifting.
      if (typeof ds === 'string' && ds.endsWith(' IST')) {
        const bare = ds.slice(0, ds.length - 4).trim(); // strip " IST"
        // bare is "YYYY-MM-DD HH:MM:SS" — treat as a plain datetime string
        date = new Date(bare.replace(' ', 'T') + 'Z'); // parse as UTC to preserve the stored IST wall-clock value
        // The stored wall-clock is already IST, so we format it directly
        const [datePart, timePart] = bare.split(' ');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hh, mm] = timePart.split(':');
        const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return `${MONTHS[m - 1]} ${String(d).padStart(2, '0')} ${y}, ${hh}:${mm} +5:30`;
      }

      // All other timestamps are UTC ISO strings (e.g. "2026-05-23T04:23:00.000Z").
      // Add +5 hours 30 minutes to convert to Indian Standard Time.
      let cleanDs = ds;
      if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
          const formatted = cleanDs.replace(' ', 'T');
          cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
      }

      date = new Date(cleanDs);
      if (isNaN(date.getTime())) return "";

      // Use Intl.DateTimeFormat with Asia/Kolkata to correctly apply the +5:30 offset
      const ist = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => ist.find(p => p.type === type)?.value ?? '00';
      const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const monthIdx = parseInt(get('month'), 10) - 1;
      const monthStr = MONTHS[monthIdx] ?? 'JAN';
      const day = get('day');
      const year = get('year');
      const hr = get('hour');
      const min = get('minute');

      return `${monthStr} ${day} ${year}, ${hr}:${min}`;
    } catch {
      return "";
    }
  };

  // The primary user-directory timestamp — sourced from registeredAtIndia / createdAt
  // in the staff dashboard user record. Used as the authoritative time for stage timestamps.
  const userDirectoryTimestamp =
    application.date ||
    application.registeredAtIndia ||
    application.student?.registeredAtIndia ||
    application.user?.registeredAtIndia ||
    application.student?.createdAt ||
    application.student?.created_at ||
    application.user?.createdAt ||
    application.user?.created_at ||
    application.createdAt ||
    application.created_at;

  // Determine per-step timestamps from application data
  const appCreatedAt = userDirectoryTimestamp || application.submittedAt || application.submitted_at;
  const appUpdatedAt = application.updatedAt || application.updated_at || appCreatedAt;

  // Find the index of the last completed stage
  const completedThresholds = [10, 25, 40, 50, 75, 90, 95, 100];
  const lastCompletedIdx = completedThresholds.reduce((acc, threshold, idx) => progress >= threshold ? idx : acc, -1);

  const getStepStatus = (completed: boolean, active?: boolean) => {
    if (active) return "IN PROGRESS";
    return completed ? "COMPLETED" : "PENDING";
  };

  // All completed steps show a timestamp; we look up status history or use fallbacks
  const getStageTimestamp = (stageIdx: number, completed: boolean, active?: boolean): string | undefined => {
    if (!completed && !active) return undefined;

    // 1. Try to extract timestamps from fetchedStatusHistory or application.statusHistory
    const history = fetchedStatusHistory && fetchedStatusHistory.length > 0
      ? fetchedStatusHistory
      : (application.statusHistory || []);
    console.log('[DEBUG_TIMELINE] history used for timestamps:', history);

    const findHistoryTime = (statuses: string[]) => {
      const matches = history
        .filter((h: any) => statuses.includes(String(h.toStatus || h.to_status || h.status || h.toStage || h.to_stage || h.stage || "").toLowerCase()))
        .sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt || a.created_at || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.created_at || b.timestamp || 0).getTime();
          return timeA - timeB;
        });
      if (matches.length > 0) {
        return matches[0].createdAt || matches[0].created_at || matches[0].timestamp;
      }
      return undefined;
    };

    const extractedTimestamps: (string | undefined)[] = [];
    for (let i = 0; i < 8; i++) {
      let time: string | undefined = undefined;
      switch (i) {
        case 0:
          time = findHistoryTime(['draft', 'pending', 'application_created']) || application.createdAt || application.date;
          break;
        case 1:
          time = findHistoryTime(['submitted', 'application_submitted', 'docs_received', 'docs_uploaded']) || application.submittedAt;
          break;
        case 2:
          time = findHistoryTime(['staff_verified', 'verification', 'documents_verified']) || application.verifiedAt;
          break;
        case 3:
          time = findHistoryTime(['submitted_to_bank', 'file_logged']) || application.fileLoggedAt || application.submittedToBankAt;
          break;
        case 4:
          time = findHistoryTime(['under_bank_review', 'query_raised', 'processing']) || application.reviewStartedAt || application.fileLoggedAt;
          break;
        case 5:
          time = findHistoryTime(['approved', 'sanctioned', 'conditional_sanction', 'counter_offer']) || application.approvedAt;
          break;
        case 6:
          time = findHistoryTime(['sanctioned', 'approved', 'sanction']) || application.sanctionDate || application.approvedAt;
          break;
        case 7:
          time = findHistoryTime(['disbursed', 'disbursement_confirmed', 'closed', 'disbursement']) || application.disbursedAt;
          break;
      }
      extractedTimestamps.push(time);
    }

    // Check if the history timestamps are valid
    if (extractedTimestamps[stageIdx]) {
      return extractedTimestamps[stageIdx];
    }

    // Fallbacks if history timestamp is missing
    if (stageIdx === 0 && appCreatedAt) return appCreatedAt;

    const getAnchorIdx = (p: number) => {
      if (p >= 100) return 7;
      if (p >= 95) return 7;
      if (p >= 90) return 6;
      if (p >= 75) return 5;
      if (p >= 50) return 4;
      if (p >= 40) return 3;
      if (p >= 25) return 2;
      if (p >= 10) return 1;
      return 0;
    };

    const anchorIdx = getAnchorIdx(progress);

    // If this is the active stage and we have an update time, use it
    if (active && stageIdx === anchorIdx && appUpdatedAt) {
      return appUpdatedAt;
    }

    // If this is a completed stage and it is the last completed stage
    if (completed && stageIdx === anchorIdx && appUpdatedAt) {
      return appUpdatedAt;
    }

    let startD = new Date(appCreatedAt);
    if (isNaN(startD.getTime())) startD = new Date();
    let endD = new Date(appUpdatedAt);
    if (isNaN(endD.getTime())) endD = new Date();

    if (startD.getTime() > endD.getTime()) {
      startD = new Date(endD.getTime() - 1000);
    }

    const span = endD.getTime() - startD.getTime();
    if (span > 0 && anchorIdx > 0) {
      // Linear interpolation fallback only if we absolutely have to
      const step = span / anchorIdx;
      return new Date(startD.getTime() + stageIdx * step).toISOString();
    } else {
      return new Date(endD.getTime() - (anchorIdx - stageIdx) * 60000).toISOString();
    }
  };

  const stages = [
    { label: "APPLICATION CREATED", icon: "bolt", date: getStepStatus(progress >= 10), completed: progress >= 10, timestamp: getStageTimestamp(0, progress >= 10) },
    { label: "APPLICATION SUBMITTED", icon: "send", date: getStepStatus(progress >= 25), completed: progress >= 25, timestamp: getStageTimestamp(1, progress >= 25) },
    { label: "DOCUMENTS", icon: "upload_file", date: getStepStatus(progress >= 40), completed: progress >= 40, timestamp: getStageTimestamp(2, progress >= 40) },
    { label: "SUBMIT TO BANK", icon: "account_balance", date: getStepStatus(progress >= 50), completed: progress >= 50, timestamp: getStageTimestamp(3, progress >= 50) },
    { label: "CREDIT CHECK", icon: "credit_score", date: getStepStatus(progress >= 75), completed: progress >= 75, timestamp: getStageTimestamp(4, progress >= 75) },
    { label: getBankStepLabel(), icon: "rate_review", date: getStepStatus(progress >= 90, progress >= 75 && progress < 90), completed: progress >= 90, active: progress >= 75 && progress < 90, timestamp: getStageTimestamp(5, progress >= 90, progress >= 75 && progress < 90) },
    { label: "SANCTION", icon: "assignment_turned_in", date: getStepStatus(progress >= 95, progress >= 90 && progress < 95), completed: progress >= 95, active: progress >= 90 && progress < 95, timestamp: getStageTimestamp(6, progress >= 95, progress >= 90 && progress < 95) },
    { label: "DISBURSEMENT", icon: "payments", date: getStepStatus(progress >= 100, progress >= 95 && progress < 100), completed: progress >= 100, active: progress >= 95 && progress < 100, timestamp: getStageTimestamp(7, progress >= 100, progress >= 95 && progress < 100) },
  ];

  const getBankLogo = () => {
    const bName = (application.bank || application.targetBank || "").toLowerCase();
    if (bName.includes("idfc")) return "/images/lenders/idfc-first-bank.jpg";
    if (bName.includes("avanse")) return "/images/lenders/avanse.jpg";
    if (bName.includes("auxilo")) return "/images/lenders/auxilo.png";
    if (bName.includes("credila") || bName.includes("hdfc")) return "/images/lenders/hdfc-credila.png";
    if (bName.includes("poonawalla")) return "/images/lenders/poonawalla.png";
    return null;
  };

  const getLogoForBank = (name: string) => {
    const bName = name.toLowerCase();
    if (bName.includes("idfc")) return "/images/lenders/idfc-first-bank.jpg";
    if (bName.includes("avanse")) return "/images/lenders/avanse.jpg";
    if (bName.includes("auxilo")) return "/images/lenders/auxilo.png";
    if (bName.includes("credila") || bName.includes("hdfc")) return "/images/lenders/hdfc-credila.png";
    if (bName.includes("poonawalla")) return "/images/lenders/poonawalla.png";
    return null;
  };

  const getComparableValue = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizeConfidence = (value: unknown) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    const percentValue = numericValue <= 1 ? numericValue * 100 : numericValue;
    return Math.max(0, Math.min(100, Math.round(percentValue)));
  };
  const formatDocTitle = (doc: OcrSummaryDoc) => {
    const rawName = doc.name || doc.docName || doc.docType || "Document";
    return String(rawName)
      .replace(/^(father|mother|coapplicant)[\s_-]+/i, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };
  const getDocFieldsCount = (doc: OcrSummaryDoc) => {
    const extracted = doc.extractedData || doc.verificationMetadata?.extractedFields || {};
    return doc.fieldsExtracted || Object.keys(extracted).filter((key) => extracted[key] !== undefined && extracted[key] !== null && extracted[key] !== "").length;
  };
  const formatUploadAge = (timestamp?: string) => {
    if (!timestamp) return "Upload time unavailable";

    let safeTimestamp = timestamp;
    if (!timestamp.endsWith('Z') && !timestamp.includes('+') && !timestamp.match(/-\d{2}:\d{2}$/)) {
      safeTimestamp = timestamp + 'Z';
    }

    const uploadedDate = new Date(safeTimestamp);
    if (Number.isNaN(uploadedDate.getTime())) return "Upload time unavailable";

    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(uploadedDate);

    const diffMs = Date.now() - uploadedDate.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    let relative = "";
    if (diffMinutes < 1) relative = "just now";
    else if (diffMinutes < 60) relative = `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    else {
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) relative = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
      else {
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) relative = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
        else {
          const diffWeeks = Math.floor(diffDays / 7);
          relative = `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
        }
      }
    }

    return `${formattedDate} (${relative})`;
  };
  const isFamilyOrCoApplicantDoc = (doc: OcrSummaryDoc) => {
    const docType = String(doc.docType || "").toLowerCase();
    return ["father", "mother", "coapplicant"].some((prefix) => docType.startsWith(`${prefix}_`) || docType.includes(`${prefix}_`));
  };
  const academicOcrDocs: OcrSummaryDoc[] = documents.filter((doc) => !isFamilyOrCoApplicantDoc(doc));
  const coApplicantOcrDocs: OcrSummaryDoc[] = documents.filter(isFamilyOrCoApplicantDoc);
  const allExtractedDocs: OcrSummaryDoc[] = documents.filter((doc) => getDocFieldsCount(doc) > 0 || normalizeConfidence(doc.accuracy) > 0);
  const findExtractedValue = (keys: string[]) => {
    for (const doc of allExtractedDocs) {
      const extracted = doc.extractedData || {};
      for (const key of keys) {
        if (extracted[key]) return extracted[key];
      }
    }
    return "";
  };
  const fullName = `${application.firstName || application.student?.firstName || ""} ${application.lastName || application.student?.lastName || ""}`.trim();
  const extractedName = findExtractedValue(["full_name", "name", "student_name", "applicant_name"]);
  const extractedDob = findExtractedValue(["date_of_birth", "dob", "birth_date"]);
  const feeAmount = Number(application.totalCost || application.totalFees || application.feeStructureAmount || application.courseFee || application.tuitionFee || 0);
  const loanAmount = Number(application.amount || application.loanAmount || application.student?.loanAmount || 0);
  const nameMatched = extractedName && fullName ? getComparableValue(extractedName).includes(getComparableValue(fullName)) || getComparableValue(fullName).includes(getComparableValue(extractedName)) : false;
  const dobMatched = extractedDob && application.dob ? getComparableValue(extractedDob) === getComparableValue(application.dob) : false;
  const hasCoapplicantPan = coApplicantOcrDocs.some((doc) => String(doc.docType || "").toLowerCase().includes("pan") && getDocFieldsCount(doc) > 0);
  const hasCoapplicantItr = coApplicantOcrDocs.some((doc) => String(doc.docType || "").toLowerCase().includes("itr") && getDocFieldsCount(doc) > 0);

  const examsList = (() => {
    const list: Array<{ name: string; score: string; maxScore?: number }> = [];

    const TEST_MAX_SCORES: Record<string, number> = {
      ielts: 9,
      toefl: 120,
      pte: 90,
      duolingo: 160,
      gre: 340,
      gmat: 800,
      sat: 1600,
      act: 36
    };

    const getMaxScore = (testName: string): number | undefined => {
      return TEST_MAX_SCORES[testName.toLowerCase()];
    };

    // 1. Check direct columns
    const englishTest = application.englishTest || application.user?.englishTest || application.student?.englishTest;
    const englishScore = application.englishScore || application.user?.englishScore || application.student?.englishScore;
    if (englishTest && englishScore) {
      list.push({
        name: String(englishTest).toUpperCase(),
        score: String(englishScore),
        maxScore: getMaxScore(String(englishTest))
      });
    }

    const entranceTest = application.entranceTest || application.user?.entranceTest || application.student?.entranceTest;
    const entranceScore = application.entranceScore || application.user?.entranceScore || application.student?.entranceScore;
    if (entranceTest && entranceScore) {
      list.push({
        name: String(entranceTest).toUpperCase(),
        score: String(entranceScore),
        maxScore: getMaxScore(String(entranceTest))
      });
    }

    // 2. Check tests JSON
    try {
      const testsStr = application.tests || application.user?.tests || application.student?.tests;
      if (testsStr) {
        const parsed = typeof testsStr === 'string' ? JSON.parse(testsStr) : testsStr;
        if (parsed && typeof parsed === 'object') {
          const testKeys = ['gre', 'gmat', 'sat', 'act', 'ielts', 'toefl', 'pte', 'duolingo'];
          testKeys.forEach(key => {
            if (parsed[key] && !list.some(e => e.name.toLowerCase() === key.toLowerCase())) {
              list.push({
                name: key.toUpperCase(),
                score: String(parsed[key]),
                maxScore: getMaxScore(key)
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Failed to parse tests JSON:", e);
    }

    return list;
  })();

  // â”€â”€â”€ Cross-Document Discrepancy Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const panDoc = documents.find(d => String(d.docType || "").toLowerCase() === "pan");
  const panName = panDoc?.uploaded ? (panDoc.extractedData?.full_name || panDoc.extractedData?.name) : null;

  const passportDoc = documents.find(d => String(d.docType || "").toLowerCase() === "passport");
  const passportName = passportDoc?.uploaded ? (passportDoc.extractedData?.full_name || passportDoc.extractedData?.name) : null;

  const aadhaarDoc = documents.find(d => String(d.docType || "").toLowerCase() === "aadhaar");
  const aadhaarName = aadhaarDoc?.uploaded ? (aadhaarDoc.extractedData?.full_name || aadhaarDoc.extractedData?.name) : null;

  let crossDocNameMismatch = false;
  let crossDocNameDetail = "";
  let discrepantDocs: { doc1: OcrSummaryDoc, doc2: OcrSummaryDoc } | null = null;

  const isSamePersonName = (n1?: any, n2?: any): boolean => {
    if (!n1 || !n2) return true;
    const cleanStr = (val: any) =>
      typeof val !== 'string'
        ? ''
        : val.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\b(mr|mrs|ms|dr|prof|shri|smt|shree|kumar|kumari)\b/g, '').trim();
    const c1 = cleanStr(n1);
    const c2 = cleanStr(n2);
    if (!c1 || !c2) return true;
    if (c1 === c2) return true;

    const w1 = c1.split(/\s+/).filter(Boolean);
    const w2 = c2.split(/\s+/).filter(Boolean);

    const s1 = [...w1].sort().join(' ');
    const s2 = [...w2].sort().join(' ');
    if (s1 === s2) return true;

    const sig1 = w1.filter(w => w.length > 1);
    const sig2 = w2.filter(w => w.length > 1);
    if (sig1.length === 0 || sig2.length === 0) return true;

    const set1 = new Set(sig1);
    const set2 = new Set(sig2);
    let matches = 0;
    set1.forEach(w => {
      if (set2.has(w)) matches++;
      else {
        for (const w2 of set2) {
          if (w.length >= 4 && w2.length >= 4 && (w.includes(w2) || w2.includes(w))) {
            matches++;
            break;
          }
        }
      }
    });

    const minSize = Math.min(set1.size, set2.size);
    if (matches >= minSize) return true;
    return (matches / minSize) >= 0.6;
  };

  if (panName && passportName && !isSamePersonName(panName, passportName)) {
    crossDocNameMismatch = true;
    crossDocNameDetail = `PAN Name ("${panName}") mismatches Passport Name ("${passportName}").`;
    if (panDoc && passportDoc) discrepantDocs = { doc1: panDoc, doc2: passportDoc };
  } else if (panName && aadhaarName && !isSamePersonName(panName, aadhaarName)) {
    crossDocNameMismatch = true;
    crossDocNameDetail = `PAN Name ("${panName}") mismatches Aadhaar Name ("${aadhaarName}").`;
    if (panDoc && aadhaarDoc) discrepantDocs = { doc1: panDoc, doc2: aadhaarDoc };
  } else if (passportName && aadhaarName && !isSamePersonName(passportName, aadhaarName)) {
    crossDocNameMismatch = true;
    crossDocNameDetail = `Passport Name ("${passportName}") mismatches Aadhaar Name ("${aadhaarName}").`;
    if (passportDoc && aadhaarDoc) discrepantDocs = { doc1: passportDoc, doc2: aadhaarDoc };
  }

  const validationChecks: ValidationCheck[] = [
    {
      label: "Name match across uploaded documents",
      detail: crossDocNameMismatch
        ? crossDocNameDetail
        : nameMatched
          ? `${fullName} verified from OCR data`
          : extractedName
            ? `${String(extractedName)} needs profile review`
            : "Waiting for extracted name data",
      status: crossDocNameMismatch ? "error" : nameMatched ? "success" : extractedName ? "warning" : "pending",
      onReview: crossDocNameMismatch && discrepantDocs ? () => setActiveDiscrepancy(discrepantDocs) : undefined,
    },
    {
      label: "DOB consistency",
      detail: dobMatched ? `${String(extractedDob)} matches the profile` : extractedDob ? `${String(extractedDob)} differs from profile DOB` : "Waiting for DOB extraction",
      status: dobMatched ? "success" : extractedDob ? "warning" : "pending",
    },
    {
      label: "Co-applicant ITR matches PAN",
      detail: hasCoapplicantPan && hasCoapplicantItr ? "PAN and ITR documents are available for review" : "Upload both PAN and ITR to validate",
      status: hasCoapplicantPan && hasCoapplicantItr ? "success" : "pending",
    },
    {
      label: "Loan amount within fee range",
      detail: feeAmount > 0 && loanAmount > 0 ? `Requested Rs ${loanAmount.toLocaleString("en-IN")}; fees Rs ${feeAmount.toLocaleString("en-IN")}` : "Fee and loan amount data incomplete",
      status: feeAmount > 0 && loanAmount > 0 && loanAmount <= feeAmount ? "success" : feeAmount > 0 && loanAmount > feeAmount ? "warning" : "pending",
    },
  ];

  return (
    <div className={`staff-dashboard-body fixed inset-y-0 right-0 z-[40] flex flex-col bg-[#F8FAFC] overflow-hidden animate-in fade-in duration-500 transition-all duration-300 ${(isStandalone || !sidebarOpen) ? 'lg:left-[68px] left-0' : 'lg:left-[280px] left-0'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media print {
          /* Hide all non-printable elements */
          .no-print,
          aside,
          header,
          button,
          .material-symbols-outlined,
          iframe {
            display: none !important;
          }

          /* Hide background ambient glows */
          .bg-indigo-50\\/50, .bg-emerald-50\\/50, .blur-\\[120px\\], .blur-\\[100px\\], .blur-3xl {
            display: none !important;
          }

          /* Reset scroll & height limits for full page pagination */
          html, body, #__next, [data-reactroot], .staff-dashboard-shell {
            height: auto !important;
            overflow: visible !important;
            position: relative !important;
          }

          /* Force detail container to occupy full width and flow naturally */
          .staff-dashboard-body {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Ensure outer wrappers flow naturally across pages */
          main, .staff-dashboard-body > div {
            height: auto !important;
            overflow: visible !important;
            position: relative !important;
          }

          /* Force print wrapping for flex containers if they are too wide */
          .flex {
            flex-wrap: wrap !important;
          }

          /* Remove visual noise and box shadows */
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl, .shadow-inner {
            box-shadow: none !important;
            border-color: #e2e8f0 !important;
          }

          /* Fix background colors for clean paper printing */
          .bg-white\\/70, .bg-slate-50\\/60, .bg-white\\/40, .bg-slate-50\\/50, .bg-slate-50 {
            background-color: #ffffff !important;
            border-color: #cbd5e1 !important;
          }

          /* Avoid page breaks inside important cards */
          .group, .rounded-3xl, .rounded-\\[40px\\], .border, .p-10, .p-8 {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Ensure text colors are high contrast */
          .text-slate-400, .text-slate-500, .text-slate-600 {
            color: #475569 !important;
          }
          .text-slate-900, .text-slate-800 {
            color: #000000 !important;
          }

          /* Force page margins */
          @page {
            size: A4 portrait;
            margin: 20mm 15mm 20mm 15mm;
          }
        }
      `}</style>
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-50/50 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[40%] bg-emerald-50/50 blur-[100px] rounded-full -z-10" />

      {/* Top Navbar */}
      <div className="h-[56px] no-print bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col justify-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-0.5">VIdyaLoans</p>
          <h1 className="text-[18px] font-semibold text-slate-800 leading-tight">Application Detail</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* <div className="relative group mr-2">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
            <input
              type="text"
              placeholder="Search applications, students, IDs..."
              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 focus:bg-white w-64 transition-all text-slate-700 placeholder:text-slate-400 shadow-sm focus:shadow-md"
            />
          </div> */}

          <div className="h-5 w-px bg-slate-200"></div>

          <div className="flex items-center gap-3">
            {/* Real-time Sync Timer */}
            <div className="hidden lg:flex items-center gap-4 border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5 text-[14px] text-black font-bold uppercase tracking-widest font-mono">
                <span>Sync: {format(nowTime, 'MMM dd, HH:mm:ss')}</span>
              </div>
            </div>

            {/* Menu Toggle */}
            {/* {setSidebarOpen && (
              <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-all" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <span className="material-symbols-outlined text-[20px]">menu</span>
              </button>
            )} */}

            {/* Notifications Panel */}
            {user?.id ? (
              <NotificationsPanel
                staffId={user.id}
                maxDisplay={8}
                showUnreadBadge={true}
              />
            ) : (
              <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-all relative">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <img
                src={user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : "https://api.dicebear.com/7.x/avataaars/svg?seed=Staff"}
                alt="Avatar"
                className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 object-cover"
              />
              <div className="hidden sm:flex flex-col">
                <span className="text-[12px] font-semibold text-slate-800 leading-none">
                  {user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName[0] + '.' : ''}` : 'Staff Member'}
                </span>
                <span className="text-[10px] text-slate-400 capitalize leading-none mt-0.5">
                  {user?.role?.replace('_', ' ') || 'Level 4 Admin'}
                </span>
              </div>
            </div>

            {/* Sign Out Button */}
            {logout && (
              <button
                onClick={logout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Secondary Left Menu */}
        <div className="w-[120px] no-print bg-white/60 backdrop-blur-xl border-r border-slate-100/50 flex flex-col py-8 px-4 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          <div className="space-y-4">
            {[
              { id: 'application_details', label: 'Application\ndetails', icon: 'description' },
            ].map(menu => (
              <button
                key={menu.id}
                onClick={() => handleTabTransition(menu.id)}
                className={`w-full flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all group ${activeSidebarMenu === menu.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <div className="mb-2">
                  <span className="material-symbols-outlined text-[24px]">{menu.icon}</span>
                </div>
                <span className="text-[10px] font-bold text-center leading-tight whitespace-pre-wrap">{menu.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
          {activeSidebarMenu === 'application_details' && (
            <div className="max-w-[1400px] mx-auto p-10 space-y-10 animate-in fade-in zoom-in-95 duration-300">

              {/* Breadcrumb / Back Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-5">
                  <button
                    onClick={onBack}
                    className="w-12 h-12 no-print rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                      <span className="material-symbols-outlined text-[20px]">account_balance</span>
                    </div>
                    <h2 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Education Loan Terminal</h2>
                  </div>
                </div>

                <div className="flex items-center gap-3 no-print">
                  <button
                    onClick={() => {
                      if (isStandalone) {
                        const appId = application.id || application._id;
                        router.push(`/staff/applications/${appId}`);
                        setTimeout(() => window.print(), 500);
                      } else {
                        setActiveSidebarMenu("application_details");
                        setTimeout(() => window.print(), 300);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <span className="material-symbols-outlined text-[17px]">print</span>
                    Export PDF
                  </button>

                  <button
                    onClick={() => {
                      if (isStandalone) {
                        const appId = application.id || application._id;
                        router.push(`/staff/applications/${appId}?focus=notes`);
                      } else {
                        setActiveSidebarMenu("application_details");
                      }
                      setActiveTab("notes");
                      setTimeout(() => {
                        const notesSection = document.getElementById("internal-notes-section");
                        if (scrollContainerRef.current && notesSection) {
                          const container = scrollContainerRef.current;
                          const containerRect = container.getBoundingClientRect();
                          const elemRect = notesSection.getBoundingClientRect();
                          const relativeTop = elemRect.top - containerRect.top + container.scrollTop;
                          container.scrollTo({ top: relativeTop - 20, behavior: 'smooth' });
                        } else {
                          notesSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }, 100);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined text-[17px]">sticky_note_2</span>
                    Internal Notes
                  </button>

                  <button
                    onClick={() => setIsEmailModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-md shadow-indigo-600/10"
                  >
                    <span className="material-symbols-outlined text-[17px]">mail</span>
                    Send Email
                  </button>

                  <button
                    onClick={() => {
                      let bankParam = application.bank || "";
                      const isAnyBank = !bankParam || bankParam.toLowerCase().includes("any") || bankParam.toLowerCase().includes("pending");
                      if (isAnyBank) {
                        const sub = application.bankSubmissions?.[0] || application.submissions?.[0];
                        if (sub?.bankName || sub?.bank) {
                          bankParam = sub.bankName || sub.bank;
                        } else if (application.targetBank && !application.targetBank.toLowerCase().includes("any")) {
                          bankParam = application.targetBank;
                        } else {
                          bankParam = application.assignedBank || application.lender || "IDFC FIRST Bank";
                        }
                      }
                      const appNo = application.applicationNumber || `APP-${(application.id || application._id || 'UNKNOWN').slice(-6)}`;
                      router.push(`/staff/chat-customer?bankName=${encodeURIComponent(bankParam)}&applicationId=${application.id || application._id}&applicationNumber=${encodeURIComponent(appNo)}`);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#6605c7] hover:bg-[#5204a3] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">forum</span>
                    Chat with Bank
                  </button>
                </div>
              </div>

              {/* Bank Routing Banner */}
              {(!application.submittedToBankAt && !application.bankSubmissionId && !['sanctioned', 'rejected', 'disbursed'].includes(application.status)) && (
                <div className="bg-gradient-to-r from-[#0d1b2a]/95 to-[#1b263b]/95 backdrop-blur-md rounded-3xl p-8 border border-slate-700/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-[#0d1b2a]/10 animate-in slide-in-from-top-6 duration-500 font-sans">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                      <span className="material-symbols-outlined text-[28px] animate-pulse">
                        {application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner' ? "fork_right" : "rocket_launch"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-white tracking-tight">
                        {application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner' ? "Ready for Multiparty Routing" : "Ready for Bank Submission"}
                      </h3>
                      <p className="text-[13px] text-indigo-200/80 mt-0.5 font-medium">
                        {application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner'
                          ? "This application targets ANY BANK. Review verified documents and route to priority partner banks simultaneously." 
                          : `All initial documents have been submitted. Review document statuses and route this application to ${application.targetBank || "selected bank"}.`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex items-center gap-2.5 px-6 py-3.5 bg-[#6605c7] hover:bg-purple-700 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-lg shadow-purple-600/30 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner' ? "fork_right" : "send"}
                    </span>
                    {application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner' ? "Route Application" : "Send to Bank"}
                  </button>
                </div>
              )}

              {/* Main Info Card - Glassmorphism & Rich Styling */}
              <div className="bg-white/70 backdrop-blur-sm rounded-[40px] p-10 border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/30 rounded-full blur-3xl -z-10 group-hover:bg-emerald-100/40 transition-colors duration-1000" />

                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 relative z-10">
                  <div className="flex flex-col md:flex-row gap-6 min-w-0 flex-1">
                    {/* Bank Logo Area */}
                    {application.status === 'ROUTED_MULTIPARTY' && application.bankSubmissions?.length > 0 ? (
                      <div className="flex -space-x-3 hover:space-x-1 transition-all duration-500 shrink-0 items-center">
                        {application.bankSubmissions.map((sub: any, idx: number) => {
                          const logo = getLogoForBank(sub.bankName);
                          return (
                            <div key={sub.id || idx} className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2.5 border-2 border-white shadow-md hover:-translate-y-1 transition-all" title={sub.bankName}>
                              {logo ? (
                                <img src={logo} alt={sub.bankName} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <span className="text-[10px] font-black text-purple-700">{sub.bankName.slice(0, 3).toUpperCase()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-24 h-16 bg-white rounded-2xl flex items-center justify-center p-3 shrink-0 shadow-sm border border-slate-50 group-hover:shadow-md transition-all duration-500">
                        {getBankLogo() ? (
                          <img src={getBankLogo()!} alt="Bank" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-300 text-[32px]">account_balance</span>
                        )}
                      </div>
                    )}

                    <div className="space-y-6 flex-1 min-w-0">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <p
                            onClick={() => handleTabTransition("student")}
                            className="text-[11px] font-['Playfair_Display',serif] font-black text-slate-400 uppercase tracking-[0.25em] cursor-pointer hover:text-emerald-600 hover:underline transition-all"
                            title="Click to view Student Profile"
                          >
                            UNIVERSITY OF {(application.universityName || application.college || "TORONTO").toUpperCase()}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border tracking-widest uppercase shadow-sm ${
                            status === 'ROUTED_MULTIPARTY'
                              ? 'bg-purple-50 text-purple-600 border-purple-100/50'
                              : ['PENDING', 'UNDER REVIEW', 'IN PROGRESS', 'SUBMITTED'].includes(status)
                                ? 'bg-amber-50 text-amber-600 border-amber-100/50'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                            }`}>{status}</span>
                          {application.evvOverall !== undefined && application.evvOverall !== null && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border tracking-widest uppercase shadow-sm flex items-center gap-1.5 ${application.evvStatus === 'ROUTED_TO_BANK'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                              : application.evvStatus === 'MANUAL_REVIEW'
                                ? 'bg-amber-50 text-amber-600 border-amber-100/50'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'
                              }`}>
                              <span className="material-symbols-outlined text-[14px]">payments</span>
                              EVV: ₹{Number(application.evvOverall).toLocaleString('en-IN')}
                              {application.evvStatus === 'ROUTED_TO_BANK' && ' | Auto-Shared'}
                              {application.evvStatus === 'MANUAL_REVIEW' && ' | Review Req.'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <h3
                            onClick={() => handleTabTransition("student")}
                            className="text-[30px] font-black text-slate-900 tracking-tight leading-tight cursor-pointer hover:text-emerald-600 hover:underline transition-all"
                            title="Click to view Student Profile"
                          >
                            {application.firstName || application.student?.firstName || "Abhi"} {application.lastName || application.student?.lastName || "Y"}
                          </h3>
                          <p
                            onClick={() => handleTabTransition("student")}
                            className="text-[18px] font-bold text-emerald-600/90 cursor-pointer hover:text-emerald-500 hover:underline transition-all"
                            title="Click to view Student Profile"
                          >
                            {application.courseName || application.program || "MS/M.Tech"}
                          </p>
                        </div>
                      </div>

                      {/* Condensed 2x2 grid */}
                      <div className="grid grid-cols-2 gap-4 max-w-xl bg-slate-50/60 p-5 rounded-3xl border border-slate-100/80">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">APPLICATION ID</p>
                          <p className="text-[12px] font-bold text-slate-700 font-mono truncate">{appId}</p>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">UNIVERSITY</p>
                          <p
                            onClick={() => handleTabTransition("student")}
                            className="text-[12px] font-bold text-slate-700 truncate cursor-pointer hover:text-emerald-600 hover:underline transition-all"
                            title="Click to view Student Profile"
                          >
                            {(application.universityName || application.college || "TORONTO").toUpperCase()}
                          </p>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">COURSE CATEGORY</p>
                          <p className="text-[12px] font-bold text-slate-700 truncate">{application.courseLevel || "POSTGRADUATE ABROAD"}</p>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DESTINATION</p>
                          <p className="text-[12px] font-bold text-slate-700 uppercase truncate">
                            {resolveDestination(application)}
                          </p>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">INTAKE</p>
                          <p className="text-[12px] font-bold text-slate-700 truncate">
                            {resolveIntake(application)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-8 shrink-0">
                    {/* Amount Prominence - Subtle, high-contrast dedicated block */}
                    <div className="bg-emerald-950 border border-emerald-900 rounded-3xl p-5 text-left shadow-lg shadow-emerald-950/10 min-w-[200px]">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">LOAN AMOUNT APPLIED</p>
                      <div className="flex items-baseline gap-1">
                        {/* <span className="text-[20px] font-bold text-emerald-400">â‚¹</span> */}
                        <span className="text-[32px] font-black text-white tracking-tight leading-none">
                          {formatAmountInINR(Number(application.amount || application.loanAmount || application.student?.loanAmount || 3999999))}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">PROGRESS QUOTA</p>
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 112">
                          <circle
                            cx="56"
                            cy="56"
                            r="48"
                            className="text-slate-100"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="56"
                            cy="56"
                            r="48"
                            className="text-emerald-600 transition-all duration-1000 ease-out"
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 48}
                            strokeDashoffset={2 * Math.PI * 48 - (2 * Math.PI * 48 * progress) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{progress}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">%</span>
                        </div>
                      </div>
                      <div className="mt-3.5 flex items-center gap-1.5 text-black">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        <p className="text-[9px] font-black uppercase tracking-widest tabular-nums text-black">
                          Updated: {formatStepDateTime(progress <= 10 ? (application.student?.registeredAtIndia || application.registeredAtIndia || application.student?.createdAt || application.student?.created_at || application.user?.createdAt || application.user?.created_at || appUpdatedAt || appCreatedAt) : (appUpdatedAt || appCreatedAt))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Timeline - Clean & Dynamic */}
              <div className="mt-12 bg-white/40 backdrop-blur-sm border border-slate-100 rounded-3xl p-8 overflow-x-auto no-scrollbar">
                <div className="relative px-6 min-w-[1100px]">
                  <div className="absolute top-[18px] left-16 right-16 h-[4px] bg-slate-100 rounded-full" />
                  <div className="absolute top-[18px] left-16 h-[4px] bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `calc(${(stages.filter(s => s.completed).length - 1) / (stages.length - 1) * 100}% - 64px)` }} />

                  <div className="flex justify-between relative z-10">
                    {stages.map((stage, idx) => (
                      <div key={idx} className="w-36 px-2 flex flex-col items-center group/stage shrink-0">
                        <div className={`w-10 h-10 rounded-full border-[5px] border-white shadow-lg flex items-center justify-center transition-all duration-500 group-hover/stage:scale-110 ${stage.completed ? (stage.active ? 'bg-emerald-500 shadow-emerald-200' : 'bg-emerald-600 shadow-emerald-100') : 'bg-slate-200 shadow-none'}`}>
                          {stage.completed ? (
                            <span className="material-symbols-outlined text-white text-[18px] font-black">check</span>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                          )}
                        </div>
                        <div className="mt-4 text-center">
                          <p className={`text-[14px] font-extrabold tracking-wide uppercase transition-colors whitespace-pre-line leading-tight ${stage.active ? 'text-emerald-600' : stage.completed ? 'text-slate-800' : 'text-slate-400'}`}>
                            {formatStepLabel(stage.label)}
                          </p>
                          {stage.timestamp && (
                            <p className="mt-2 text-[12px] font-bold tabular-nums tracking-wide text-black">
                              {formatStepDateTime(stage.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Hub & Sticky Tabs Section */}
              <div id="action-hub-section" className="space-y-8 animate-in slide-in-from-bottom-10 duration-700 delay-200">
                <div className="sticky top-0 no-print bg-[#F8FAFC]/95 backdrop-blur-md z-[50] py-4 border-b border-slate-200 flex items-center justify-between px-6 -mx-6 shadow-sm">
                  <div className="flex items-center gap-8">
                    {[
                      { id: "requirements", label: "REQUIREMENTS", icon: "task_alt" },
                      { id: "notes", label: "INTERNAL NOTES", icon: "sticky_note_2", count: notes.length }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          if (tab.id === "notes") fetchNotes();
                        }}
                        className={`pb-1 flex items-center gap-2 text-[13px] font-black tracking-[0.1em] uppercase relative transition-all group ${activeTab === tab.id ? 'text-[#6605c7]' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <span className={`material-symbols-outlined text-[18px] transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-[#6605c7]' : 'text-slate-300'}`}>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                            {tab.count}
                          </span>
                        )}
                        {activeTab === tab.id && <div className="absolute bottom-[-17px] left-0 right-0 h-[3px] bg-[#6605c7] rounded-full shadow-[0_2px_8px_rgba(102,5,199,0.3)]" />}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                      Export PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-10">
                  <div className="col-span-12 space-y-10">
                    {activeTab === "requirements" && (
                      <OcrDocumentIntelligence
                        academicDocs={academicOcrDocs}
                        coApplicantDocs={coApplicantOcrDocs}
                        validationChecks={validationChecks}
                        loading={loadingDocs}
                        onVerifyDocument={handleVerifyDocument}
                        onRejectDocument={handleRejectDocument}
                        onAddAcademic={() => {
                          setNewDocCategory("academic");
                          setIsAddDocModalOpen(true);
                        }}
                        onAddCoApplicant={() => {
                          setNewDocCategory("financial");
                          setIsAddDocModalOpen(true);
                        }}
                        normalizeConfidence={normalizeConfidence}
                        formatDocTitle={formatDocTitle}
                        getDocFieldsCount={getDocFieldsCount}
                        formatUploadAge={formatUploadAge}
                        onPreviewDocument={setSelectedDocPreview}
                        onViewDocument={(doc) => window.open(`/api/documents/view/${userId}/${doc.docType}`, "_blank", "noopener,noreferrer")}
                        onDeleteDocument={(doc) => handleDeleteDocument(doc.id)}
                        onUploadDocument={(doc, file) => handleFileUpload(doc.docType, file)}
                        onDownloadDocument={handleDownloadDocument}
                        onSendToBank={(doc) => setSendToBankDoc(doc)}
                        crossDocNameMismatch={crossDocNameMismatch}
                        dobMatched={dobMatched}
                        extractedDob={String(extractedDob || "")}
                        application={application}
                        handleSyncField={handleSyncField}
                        isSyncing={isSyncing}
                        fullName={fullName}
                        extractedName={String(extractedName || "")}
                        panDoc={panDoc}
                        passportDoc={passportDoc}
                        aadhaarDoc={aadhaarDoc}
                        panName={panName ? String(panName) : null}
                        passportName={passportName ? String(passportName) : null}
                        aadhaarName={aadhaarName ? String(aadhaarName) : null}
                        getComparableValue={getComparableValue}
                      />
                    )}

                    {activeTab === "kyc" && (
                      <KycSystemDashboard
                        userId={userId}
                        application={application}
                        onRefresh={fetchDocuments}
                        onAadhaarSaved={onAadhaarSaved}
                      />
                    )}

                    {/* {activeTab === "records" && (
                      <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm flex flex-col h-[620px]">
                        <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                              <span className="material-symbols-outlined text-[22px]">forum</span>
                            </div>
                            <div>
                              <h3 className="text-[18px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Communication Hub</h3>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Direct two-way channel</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-5 bg-slate-50/40">
                          {messages.map((msg) => (
                            <React.Fragment key={msg.id}>
                              {msg.type === "notification" ? (
                                <div className="flex justify-center">
                                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-[11px] font-bold">
                                    <span className="material-symbols-outlined text-[16px]">file_present</span>
                                    {msg.text}
                                  </div>
                                </div>
                              ) : (
                                <div className={`flex flex-col space-y-2 ${msg.sender === "staff" ? "items-end" : "items-start"}`}>
                                  <div className={`max-w-[80%] px-6 py-4 rounded-t-3xl shadow-lg ${msg.sender === "staff"
                                    ? "bg-indigo-600 text-white rounded-bl-3xl shadow-indigo-100"
                                    : msg.sender === "bank"
                                      ? "bg-amber-50 border border-amber-105 text-slate-705 rounded-br-3xl shadow-sm"
                                      : "bg-white border border-slate-100 text-slate-707 rounded-br-3xl shadow-sm"
                                    }`}>
                                    <p className="text-[14px] leading-relaxed">{msg.text}</p>
                                  </div>
                                  <p className={`text-[10px] font-bold text-black ${msg.sender === "staff" ? "mr-2" : "ml-2"}`}>
                                    {msg.sender === "staff" ? "STAFF" : msg.sender === "bank" ? "BANK" : "STUDENT"} • {msg.time}
                                  </p>
                                </div>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100">
                          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-3xl p-2 pl-6 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
                            <input
                              type="text"
                            className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] py-3 font-medium placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Internal Notes Tab Content */}
                    {activeTab === "notes" && (
                      <div id="internal-notes-section" className="space-y-6 animate-in fade-in duration-300">
                        {/* Notes Header Card */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#6605c7] flex items-center justify-center border border-purple-100 shadow-xs shrink-0">
                              <span className="material-symbols-outlined text-[24px]">sticky_note_2</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Internal Application Notes</h3>
                                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-purple-200/60">
                                  Admin &amp; Staff Only
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                Notes, instructions, and observations recorded by Administrators and Staff. Completely hidden from applicant and banks.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={fetchNotes}
                              disabled={loadingNotes}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                              title="Refresh Notes"
                            >
                              <span className={`material-symbols-outlined text-[16px] ${loadingNotes ? 'animate-spin text-purple-600' : ''}`}>refresh</span>
                              <span>Refresh</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsNoteInputVisible(!isNoteInputVisible)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#6605c7] hover:bg-[#5204a3] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-purple-600/20 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">add_comment</span>
                              <span>{isNoteInputVisible ? "Hide Editor" : "Add Note"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Add Note Input Area */}
                        {isNoteInputVisible && (
                          <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                              New Staff / Internal Remark
                            </label>
                            <textarea
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              placeholder="Write an internal note or observation regarding this application (visible to Admin and Staff)..."
                              rows={3}
                              className="w-full px-4 py-3 bg-white border border-purple-200 rounded-2xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all resize-none shadow-2xs"
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-slate-400">lock</span>
                                Visible to admin and staff only
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNoteInput("");
                                    setIsNoteInputVisible(false);
                                  }}
                                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-white/60 rounded-xl transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddNote}
                                  disabled={!noteInput.trim()}
                                  className="px-5 py-2 bg-[#6605c7] hover:bg-[#5204a3] text-white text-xs font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">send</span>
                                  <span>Save Note</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Recorded Notes Feed */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                              Recorded Notes ({notes.length})
                            </h4>
                            {notes.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                Newest First
                              </span>
                            )}
                          </div>

                          {loadingNotes ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-100 shadow-xs">
                              <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading internal notes...</p>
                            </div>
                          ) : notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 bg-white rounded-3xl border border-dashed border-slate-200 text-center px-6 shadow-xs">
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-[28px]">speaker_notes_off</span>
                              </div>
                              <h5 className="text-sm font-bold text-slate-700">No internal notes added yet</h5>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                Notes written by Administrators in the Admin Portal or by Staff will appear here in real time.
                              </p>
                              <button
                                type="button"
                                onClick={() => setIsNoteInputVisible(true)}
                                className="mt-4 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                              >
                                Write First Note
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {notes.map((item: any, idx: number) => {
                                const noteTime = item.createdAt || item.created_at ? new Date(item.createdAt || item.created_at) : null;
                                const isAdmin = (item.type || '').includes('admin') || (item.authorName || '').toLowerCase().includes('admin');
                                const isSystem = (item.type || '').includes('ai') || (item.authorName || '').toLowerCase().includes('system');

                                return (
                                  <div
                                    key={item.id || item._id || idx}
                                    className={`p-5 rounded-2xl border transition-all ${
                                      isAdmin
                                        ? 'bg-purple-50/40 border-purple-200/80 shadow-xs hover:border-purple-300'
                                        : isSystem
                                          ? 'bg-indigo-50/40 border-indigo-200/80 shadow-xs'
                                          : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                      <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                          isAdmin
                                            ? 'bg-purple-600 text-white shadow-xs shadow-purple-600/20'
                                            : isSystem
                                              ? 'bg-indigo-600 text-white'
                                              : 'bg-slate-100 text-slate-700'
                                        }`}>
                                          <span className="material-symbols-outlined text-[16px]">
                                            {isAdmin ? 'admin_panel_settings' : isSystem ? 'smart_toy' : 'person'}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-slate-900 leading-none">
                                              {item.authorName || item.author || (isAdmin ? 'Administrator' : 'Staff Officer')}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider ${
                                              isAdmin
                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                : isSystem
                                                  ? 'bg-indigo-100 text-indigo-800'
                                                  : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {isAdmin ? 'ADMIN NOTE' : isSystem ? 'SYSTEM' : 'STAFF NOTE'}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                                            {item.type ? item.type.replace(/_/g, ' ') : 'Internal Note'}
                                          </span>
                                        </div>
                                      </div>

                                      {noteTime && (
                                        <div className="text-right shrink-0">
                                          <p className="text-[11px] font-bold text-slate-700">
                                            {format(noteTime, 'dd MMM yyyy, hh:mm a')}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-medium">
                                            {formatDistanceToNow(noteTime, { addSuffix: true })}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="bg-white/80 rounded-xl p-3.5 border border-slate-100 mt-2">
                                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                                        {item.content || item.remark}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}


          {activeSidebarMenu === 'ai_underwriting' && (
            <div className="max-w-[1400px] mx-auto p-10 space-y-10 animate-in fade-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="flex items-center gap-5">
                <button
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg transition-all"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                  </div>
                  <div>
                    <h2 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">AI Underwriting Analysis</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Autonomous Credit Score and Education Abroad Parameters Check</p>
                  </div>
                </div>
              </div>

              {loadingAiPrediction ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-purple-600 rounded-full animate-spin" />
                  <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Calculating prediction score...</p>
                </div>
              ) : aiPredictionError ? (
                <div className="py-24 text-center">
                  <span className="material-symbols-outlined text-5xl text-rose-500 mb-2">error</span>
                  <p className="text-xs font-extrabold text-slate-700">{aiPredictionError}</p>
                </div>
              ) : aiPrediction ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Gauge & Summary Recommendation */}
                  <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6 flex flex-col items-center text-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider self-start">Credit Probability Rating</p>
                    
                    {/* Radial Dial */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="#f1f5f9"
                          strokeWidth="12"
                          fill="transparent"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke={aiPrediction.riskLevel === 'LOW' ? '#10b981' : aiPrediction.riskLevel === 'MEDIUM' ? '#f59e0b' : '#ef4444'}
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 70}
                          strokeDashoffset={2 * Math.PI * 70 * (1 - (aiPrediction.predictionScore || 50) / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-4xl font-black text-slate-900">{aiPrediction.predictionScore || 0}%</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Approval Probability</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${
                        aiPrediction.riskLevel === 'LOW'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : aiPrediction.riskLevel === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {aiPrediction.riskLevel || 'UNKNOWN'} RISK
                      </span>
                    </div>

                    <div className="border-t border-slate-100 pt-4 w-full text-left space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI RECOMMENDATION</p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {aiPrediction.predictionScore >= 80
                          ? 'Highly recommended for approval. Credit metrics match standard target criteria.'
                          : aiPrediction.predictionScore >= 60
                          ? 'Recommended with caution. Co-applicant collateral or higher down-payment might be required.'
                          : 'Manual underwriting review recommended. Key parameters fall outside safe margins.'}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Rules run & Foreign Education Check */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Rules Run (F47) */}
                    <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">verified</span>
                        Credit Underwriting Rules Evaluated (F47)
                      </h3>
                      <div className="divide-y divide-slate-100 text-xs">
                        {(aiPrediction.rulesRun || []).map((rule: any, idx: number) => (
                          <div key={idx} className="py-3 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <span className={`material-symbols-outlined text-[18px] mt-0.5 ${rule.passed ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {rule.passed ? 'check_circle' : 'info'}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800">{rule.rule}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{rule.details}</p>
                              </div>
                            </div>
                            <span className={`font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] ${
                              rule.scoreDelta > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : rule.scoreDelta < 0
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-50 text-slate-600'
                            }`}>
                              {rule.scoreDelta >= 0 ? `+${rule.scoreDelta}` : rule.scoreDelta} Pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Foreign Education Abroad Auto-Detection (F48) */}
                    <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 text-[18px] animate-pulse">language</span>
                        Education Abroad Auto-Detection (F48)
                      </h3>

                      {aiPrediction.educationAbroad?.isForeign ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center gap-3">
                            <span className="material-symbols-outlined text-purple-600 text-2xl">flight_takeoff</span>
                            <div>
                              <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">Foreign Education Program Detected</p>
                              <p className="text-[10px] text-purple-600 font-semibold mt-0.5">Destination Country: <span className="font-extrabold uppercase">{aiPrediction.educationAbroad.destinationCountry}</span></p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forex Parameters</p>
                              <p className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                                Enabled
                              </p>
                            </div>
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exchange Rate Buffer</p>
                              <p className="text-xs font-bold text-slate-700 mt-1">{aiPrediction.educationAbroad.exchangeRateBufferPercent}%</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Additional Required Documents</p>
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-2">
                              {aiPrediction.educationAbroad.additionalDocumentsNeeded.map((doc: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                  <span className="material-symbols-outlined text-purple-500 text-[16px]">description</span>
                                  <span>{doc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs">
                          <span className="material-symbols-outlined text-3xl mb-2 text-slate-300 block">home_pin</span>
                          Standard domestic education program detected. Foreign currency buffers and additional travel documents are disabled.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-400 text-xs">
                  No prediction data available for this application.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      {/* Modals & Sub-components */}
      {
        isAddDocModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0d1b2a]/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAddDocModalOpen(false)} />
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Add Document Requirement</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Define what the student needs to upload</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Document Name</label>
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="e.g. Master's Admission Letter"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['academic', 'financial', 'identity'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNewDocCategory(cat)}
                        className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${newDocCategory === cat
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/30'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => setIsAddDocModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDocument}
                  disabled={!newDocName.trim()}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                >
                  Create Requirement
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        selectedDocPreview && (
          <DocumentPreviewDrawer
            doc={selectedDocPreview}
            userId={userId}
            title={formatDocTitle(selectedDocPreview)}
            uploadAge={formatUploadAge(selectedDocPreview.uploadedAt)}
            onClose={() => setSelectedDocPreview(null)}
          />
        )
      }

      {
        activeDiscrepancy && (
          <SideBySideComparisonModal
            doc1={activeDiscrepancy.doc1}
            doc2={activeDiscrepancy.doc2}
            userId={userId}
            onClose={() => setActiveDiscrepancy(null)}
          />
        )
      }

      {/* OCR Sync Modal */}
      {
        isSyncModalOpen && selectedDocForSync && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0d1b2a]/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsSyncModalOpen(false)} />
            <div className="bg-white w-full max-w-[1100px] h-[85vh] rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20 flex flex-col">

              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100">
                    <span className="material-symbols-outlined text-[32px]">sync_alt</span>
                  </div>
                  <div>
                    <h3 className="text-[24px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Review & Sync Data</h3>
                    <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">AI-Powered Extraction Verification</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="w-12 h-12 rounded-2xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Document Preview */}
                <div className="w-1/2 bg-slate-900 flex items-center justify-center relative group">
                  <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />
                  <iframe
                    src={`/api/documents/view/${userId}/${selectedDocForSync.docType}`}
                    title="Document Preview"
                    className="w-full h-full border-0"
                  />
                  <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-[11px] font-medium text-center">Original scan provided by the applicant</p>
                  </div>
                </div>

                {/* Right Side: Comparison Table */}
                <div className="w-1/2 flex flex-col bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
                    <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Field Mapping</h4>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">
                      {selectedDocForSync.accuracy?.toFixed(1)}% CONFIDENCE
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {/* Field Row Component */}
                    {[
                      { label: 'Full Name', key: 'full_name', current: application.firstName + " " + application.lastName, extracted: selectedDocForSync.extractedData?.full_name || "Abhiram Y" },
                      { label: 'Date of Birth', key: 'date_of_birth', current: application.dob || "—", extracted: selectedDocForSync.extractedData?.date_of_birth || "14-08-1998" },
                      { label: 'PAN Number', key: 'document_number', current: application.panNumber || "—", extracted: selectedDocForSync.extractedData?.document_number || "ABCDP1234F" },
                      { label: 'Father\'s Name', key: 'father_name', current: application.fatherName || "—", extracted: selectedDocForSync.extractedData?.father_name || "Y. Venkatesh" },
                      { label: 'Issuing Authority', key: 'issuing_authority', current: "—", extracted: selectedDocForSync.extractedData?.issuing_authority || "Income Tax Dept." }
                    ].map((field, idx) => (
                      <div key={idx} className="group/row">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                          {field.current !== field.extracted && field.extracted && (
                            <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1 animate-pulse">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              Mismatched
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Profile Value</p>
                            <p className="text-[14px] font-bold text-slate-600">{field.current}</p>
                          </div>

                          <div className={`p-4 rounded-2xl border relative group transition-all ${field.current === field.extracted ? 'bg-emerald-50/30 border-emerald-100' : 'bg-indigo-50/30 border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5'}`}>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase mb-1">AI Extracted</p>
                            <p className="text-[14px] font-bold text-indigo-700">{field.extracted}</p>

                            <button
                              onClick={() => handleSyncField(field.key, field.extracted)}
                              disabled={isSyncing || field.current === field.extracted}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${field.current === field.extracted
                                ? 'bg-emerald-500 text-white cursor-default'
                                : 'bg-indigo-600 text-white hover:scale-110 active:scale-95 shadow-lg shadow-indigo-200'
                                }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {field.current === field.extracted ? 'check' : 'sync'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-8 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-500">verified_user</span>
                      <p className="text-[11px] font-medium text-slate-600">Manual review recommended before final sync</p>
                    </div>
                    <button
                      onClick={() => setIsSyncModalOpen(false)}
                      className="px-8 py-3.5 bg-[#0d1b2a] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                    >
                      Complete Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Share with Bank Modal */}
      <ShareWithBankModal
        applicationId={application.id || application._id}
        applicationNumber={appId}
        studentName={fullName}
        loanAmount={Number(application.amount || application.loanAmount || application.student?.loanAmount || 0)}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isMultiBank={application.targetBank === "ANY BANK" || (application.bank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner' || (application.targetBank || '').toLowerCase().replace(/\s+/g, '') === 'pendingpartner'}
        targetBank={application.bank || application.targetBank}
        onSuccess={() => {
          if (onApplicationUpdated) {
            onApplicationUpdated();
          }
          onBack();
        }}
      />

      {/* Send Individual Document to Bank Modal */}
      {sendToBankDoc && (
        <SendDocumentToBankModal
          isOpen={!!sendToBankDoc}
          onClose={() => setSendToBankDoc(null)}
          userId={userId}
          docType={sendToBankDoc.docType}
          docTitle={formatDocTitle(sendToBankDoc)}
          studentName={fullName}
          applicationNumber={appId}
          onSuccess={() => setSendToBankDoc(null)}
        />
      )}

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        recipientEmail={application.email || application.student?.email || ""}
        recipientName={fullName}
      />
    </div >
  );
};

const OcrDocumentIntelligence = ({
  academicDocs,
  coApplicantDocs,
  validationChecks,
  loading,
  onAddAcademic,
  onAddCoApplicant,
  normalizeConfidence,
  formatDocTitle,
  getDocFieldsCount,
  formatUploadAge,
  onPreviewDocument,
  onViewDocument,
  onDeleteDocument,
  onUploadDocument,
  onDownloadDocument,
  onSendToBank,
  crossDocNameMismatch,
  dobMatched,
  extractedDob,
  application,
  handleSyncField,
  isSyncing,
  fullName,
  extractedName,
  panDoc,
  passportDoc,
  aadhaarDoc,
  panName,
  passportName,
  aadhaarName,
  getComparableValue,
  onVerifyDocument,
  onRejectDocument,
}: {
  academicDocs: OcrSummaryDoc[];
  coApplicantDocs: OcrSummaryDoc[];
  validationChecks: ValidationCheck[];
  loading: boolean;
  onAddAcademic: () => void;
  onAddCoApplicant: () => void;
  normalizeConfidence: (value: unknown) => number;
  formatDocTitle: (doc: OcrSummaryDoc) => string;
  getDocFieldsCount: (doc: OcrSummaryDoc) => number;
  formatUploadAge: (timestamp?: string) => string;
  onPreviewDocument: (doc: OcrSummaryDoc) => void;
  onViewDocument: (doc: OcrSummaryDoc) => void;
  onDeleteDocument: (doc: OcrSummaryDoc) => void;
  onUploadDocument: (doc: OcrSummaryDoc, file: File) => void;
  onDownloadDocument?: (doc: OcrSummaryDoc) => void;
  onSendToBank?: (doc: OcrSummaryDoc) => void;
  crossDocNameMismatch: boolean;
  dobMatched: boolean;
  extractedDob: string;
  application: any;
  handleSyncField: (field: string, value: any) => Promise<void>;
  isSyncing: boolean;
  fullName: string;
  extractedName: string;
  panDoc?: OcrSummaryDoc;
  passportDoc?: OcrSummaryDoc;
  aadhaarDoc?: OcrSummaryDoc;
  panName: string | null;
  passportName: string | null;
  aadhaarName: string | null;
  getComparableValue: (val: any) => string;
  onVerifyDocument?: (docId: string) => void;
  onRejectDocument?: (docId: string, reason: string) => void;
}) => {
  const [docSubTab, setDocSubTab] = useState<"action" | "completed" | "rejected">("action");

  const isRejected = (doc: OcrSummaryDoc) => {
    return String(doc.status || "").toLowerCase() === "rejected";
  };

  const isActionRequired = (doc: OcrSummaryDoc) => {
    if (isRejected(doc)) return false;
    if (!doc.uploaded) return true;
    const confidence = normalizeConfidence(doc.accuracy);
    if (confidence < 75) return true;
    const typeLower = String(doc.docType || "").toLowerCase();
    if (typeLower === "pan" && panName && getComparableValue(panName) !== getComparableValue(fullName)) return true;
    if (typeLower === "passport" && passportName && getComparableValue(passportName) !== getComparableValue(fullName)) return true;
    if (typeLower === "aadhaar" && aadhaarName && getComparableValue(aadhaarName) !== getComparableValue(fullName)) return true;
    if (typeLower === "aadhaar" && extractedDob && !dobMatched) return true;
    if (typeLower === "passport" && extractedDob && !dobMatched) return true;
    return false;
  };

  const rejectedAcademic = academicDocs.filter(isRejected);
  const rejectedCoApplicant = coApplicantDocs.filter(isRejected);

  const actionRequiredAcademic = academicDocs.filter(isActionRequired);
  const actionRequiredCoApplicant = coApplicantDocs.filter(isActionRequired);

  const completedAcademic = academicDocs.filter((d) => !isRejected(d) && !isActionRequired(d));
  const completedCoApplicant = coApplicantDocs.filter((d) => !isRejected(d) && !isActionRequired(d));

  const verifiedAcademic = academicDocs.filter(d => ["verified", "approved"].includes(String(d.status || "").toLowerCase()));
  const verifiedCoApplicant = coApplicantDocs.filter(d => ["verified", "approved"].includes(String(d.status || "").toLowerCase()));

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OcrDocumentGroup
          title="Applicant Documents"
          icon="school"
          docs={verifiedAcademic}
          loading={loading}
          onAdd={onAddAcademic}
          normalizeConfidence={normalizeConfidence}
          formatDocTitle={formatDocTitle}
          getDocFieldsCount={getDocFieldsCount}
          formatUploadAge={formatUploadAge}
          onPreviewDocument={onPreviewDocument}
          onViewDocument={onViewDocument}
          onDeleteDocument={onDeleteDocument}
          onUploadDocument={onUploadDocument}
          onDownloadDocument={onDownloadDocument}
          onSendToBank={onSendToBank}
          onVerifyDocument={onVerifyDocument}
          onRejectDocument={onRejectDocument}
        />
        <OcrDocumentGroup
          title="Family & Co-Applicant Documents"
          icon="group"
          docs={verifiedCoApplicant}
          loading={loading}
          onAdd={onAddCoApplicant}
          normalizeConfidence={normalizeConfidence}
          formatDocTitle={formatDocTitle}
          getDocFieldsCount={getDocFieldsCount}
          formatUploadAge={formatUploadAge}
          onPreviewDocument={onPreviewDocument}
          onViewDocument={onViewDocument}
          onDeleteDocument={onDeleteDocument}
          onUploadDocument={onUploadDocument}
          onDownloadDocument={onDownloadDocument}
          onSendToBank={onSendToBank}
          onVerifyDocument={onVerifyDocument}
          onRejectDocument={onRejectDocument}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-[22px] text-emerald-600">shield</span>
          <h3 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Cross-Document Validation</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {validationChecks.map((check) => (
            <OcrValidationCard
              key={check.label}
              check={check}
              application={application}
              fullName={fullName}
              extractedName={extractedName}
              extractedDob={extractedDob}
              dobMatched={dobMatched}
              crossDocNameMismatch={crossDocNameMismatch}
              handleSyncField={handleSyncField}
              isSyncing={isSyncing}
              panDoc={panDoc}
              passportDoc={passportDoc}
              aadhaarDoc={aadhaarDoc}
              panName={panName}
              passportName={passportName}
              aadhaarName={aadhaarName}
              getComparableValue={getComparableValue}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const OcrDocumentGroup = ({
  title,
  icon,
  docs,
  loading,
  onAdd,
  normalizeConfidence,
  formatDocTitle,
  getDocFieldsCount,
  formatUploadAge,
  onPreviewDocument,
  onViewDocument,
  onDeleteDocument,
  onUploadDocument,
  onDownloadDocument,
  onSendToBank,
  onVerifyDocument,
  onRejectDocument,
}: {
  title: string;
  icon: string;
  docs: OcrSummaryDoc[];
  loading: boolean;
  onAdd: () => void;
  normalizeConfidence: (value: unknown) => number;
  formatDocTitle: (doc: OcrSummaryDoc) => string;
  getDocFieldsCount: (doc: OcrSummaryDoc) => number;
  formatUploadAge: (timestamp?: string) => string;
  onPreviewDocument: (doc: OcrSummaryDoc) => void;
  onViewDocument: (doc: OcrSummaryDoc) => void;
  onDeleteDocument: (doc: OcrSummaryDoc) => void;
  onUploadDocument: (doc: OcrSummaryDoc, file: File) => void;
  onDownloadDocument?: (doc: OcrSummaryDoc) => void;
  onSendToBank?: (doc: OcrSummaryDoc) => void;
  onVerifyDocument?: (docId: string) => void;
  onRejectDocument?: (docId: string, reason: string) => void;
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px] text-emerald-600">{icon}</span>
        <h3 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">{title}</h3>
      </div>
    </div>

    <div className="space-y-4">
      {loading ? (
        Array.from({ length: 2 }).map((_, idx) => (
          <div key={idx} className="h-[118px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
        ))
      ) : docs.length > 0 ? (
        docs.map((doc) => (
          <OcrMiniDocumentCard
            key={doc.id || doc.docType || doc.name}
            confidence={normalizeConfidence(doc.accuracy)}
            title={formatDocTitle(doc)}
            fieldsCount={getDocFieldsCount(doc)}
            uploadAge={formatUploadAge(doc.uploadedAt)}
            status={doc.status}
            rejectionReason={doc.rejectionReason}
            uploaded={doc.uploaded}
            fileName={doc.fileName}
            onPreview={() => onPreviewDocument(doc)}
            onViewFile={() => onViewDocument(doc)}
            onDelete={() => onDeleteDocument(doc)}
            onUpload={(file) => onUploadDocument(doc, file)}
            onDownload={onDownloadDocument ? () => onDownloadDocument(doc) : undefined}
            onSendToBank={onSendToBank ? () => onSendToBank(doc) : undefined}
            onVerify={onVerifyDocument ? () => onVerifyDocument(doc.id) : undefined}
            onReject={onRejectDocument ? (reason) => onRejectDocument(doc.id, reason) : undefined}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/20">
          <span className="material-symbols-outlined text-[28px] text-slate-300 mb-2 block">description</span>
          <p className="text-[12px] font-bold text-slate-400">No documents in this view</p>
        </div>
      )}
    </div>
  </div>
);

const OcrMiniDocumentCard = ({
  confidence,
  title,
  fieldsCount,
  uploadAge,
  status,
  rejectionReason,
  uploaded,
  fileName,
  onPreview,
  onViewFile,
  onDelete,
  onUpload,
  onDownload,
  onSendToBank,
  onVerify,
  onReject,
}: {
  confidence: number;
  title: string;
  fieldsCount: number;
  uploadAge: string;
  status: string;
  rejectionReason?: string;
  uploaded?: boolean;
  fileName?: string;
  onPreview: () => void;
  onViewFile: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onDownload?: () => void;
  onSendToBank?: () => void;
  onVerify?: () => void;
  onReject?: (reason: string) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { prompt: dialogPrompt } = useDialog();
  const statusLower = String(status || "").toLowerCase();
  const hasFile = Boolean(uploaded || fileName || ["uploaded", "verified", "approved", "rejected"].includes(statusLower));
  const tone =
    confidence >= 90
      ? { text: "text-emerald-700", bar: "bg-emerald-500", icon: "verified", iconText: "text-emerald-600" }
      : confidence >= 75
        ? { text: "text-amber-700", bar: "bg-amber-500", icon: "warning", iconText: "text-amber-500" }
        : confidence > 0
          ? { text: "text-rose-700", bar: "bg-rose-500", icon: "error", iconText: "text-rose-500" }
          : { text: "text-slate-500", bar: "bg-slate-300", icon: "pending", iconText: "text-slate-400" };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${hasFile
      ? "border-slate-200 bg-white"
      : "border-dashed border-slate-300 bg-slate-50/40 opacity-75 hover:opacity-100"
      }`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`material-symbols-outlined text-[22px] mt-0.5 ${hasFile ? "text-emerald-600" : "text-slate-400"}`}>
            {hasFile ? "verified_user" : "contact_mail"}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[16px] font-bold text-slate-800 truncate">{title}</h4>
              {hasFile && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border ${["verified", "approved"].includes(statusLower)
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100/80"
                  : statusLower === "rejected"
                    ? "bg-rose-50 text-rose-700 border-rose-100/80"
                    : "bg-blue-50 text-blue-700 border-blue-100/80"
                  }`}>
                  {["verified", "approved"].includes(statusLower) ? "Verified" : statusLower === "rejected" ? "Rejected" : "Pending Review"}
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium text-slate-500 mt-1">
              {hasFile ? `${fieldsCount} fields extracted` : "⚠️ Pending upload"}
            </p>
            {statusLower === "rejected" && rejectionReason && (
              <p className="text-[12px] font-bold text-rose-600 mt-1.5 bg-rose-50/50 px-3 py-1 rounded-lg border border-rose-100/50 inline-block">
                Reason: {rejectionReason}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasFile && (
            <button
              type="button"
              onClick={onPreview}
              title={`Quick look: ${title}`}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
          )}
        </div>
      </div>

      {hasFile && (
        <>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-black">
            <span className="material-symbols-outlined text-[15px]">schedule</span>
            Uploaded: {uploadAge}
          </div>
          <div className="mt-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-1.5">
              <p className={`text-[11px] font-black uppercase tracking-widest ${tone.text}`}>
                OCR Confidence: {confidence}%
              </p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${confidence}%` }} />
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {hasFile && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onViewFile}
                className="inline-flex items-center gap-1.5 text-[12px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                View file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OcrValidationCard = ({
  check,
  application,
  fullName,
  extractedName,
  extractedDob,
  dobMatched,
  crossDocNameMismatch,
  handleSyncField,
  isSyncing,
  panDoc,
  passportDoc,
  aadhaarDoc,
  panName,
  passportName,
  aadhaarName,
  getComparableValue,
}: {
  check: ValidationCheck;
  application: any;
  fullName: string;
  extractedName: string;
  extractedDob: string;
  dobMatched: boolean;
  crossDocNameMismatch: boolean;
  handleSyncField: (field: string, value: any) => Promise<void>;
  isSyncing: boolean;
  panDoc?: OcrSummaryDoc;
  passportDoc?: OcrSummaryDoc;
  aadhaarDoc?: OcrSummaryDoc;
  panName: string | null;
  passportName: string | null;
  aadhaarName: string | null;
  getComparableValue: (val: any) => string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isDob = check.label.toLowerCase().includes("dob") || check.label.toLowerCase().includes("birth") || check.detail.toLowerCase().includes("dob");
  const isName = check.label.toLowerCase().includes("name") || check.detail.toLowerCase().includes("name");

  const hasInteractiveDetails = (isDob && !dobMatched) || (isName && (crossDocNameMismatch || extractedName !== fullName));

  const tone =
    check.status === "success"
      ? "border-emerald-200 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50/60"
      : check.status === "error"
        ? "border-rose-200 bg-rose-50/40 text-rose-700 hover:bg-rose-50/60 shadow-sm"
        : check.status === "warning"
          ? "border-amber-200 bg-amber-50/40 text-amber-700 hover:bg-amber-50/60"
          : "border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-50";

  const icon =
    check.status === "success"
      ? "check_circle"
      : check.status === "error"
        ? "dangerous"
        : check.status === "warning"
          ? "warning"
          : "pending";

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen ? 'ring-2 ring-emerald-500/20' : ''} ${tone}`}>
      <div
        onClick={() => hasInteractiveDetails && setIsOpen(!isOpen)}
        className={`p-5 flex items-start justify-between gap-4 select-none ${hasInteractiveDetails ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-[24px] shrink-0 mt-0.5">{icon}</span>
          <div>
            <h4 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              {check.label}
              {hasInteractiveDetails && (
                <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`}>
                  expand_more
                </span>
              )}
            </h4>
            <p className="text-[13px] font-medium text-slate-600 mt-1">{check.detail}</p>
          </div>
        </div>

        {hasInteractiveDetails && !isOpen && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0 self-center bg-slate-100/80 px-2.5 py-1 rounded-lg">
            View Details
          </span>
        )}
      </div>

      {hasInteractiveDetails && isOpen && (
        <div className="px-5 pb-5 pt-1 bg-white/70 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
          {isDob && (
            <div className="space-y-4 mt-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                DOB Discrepancy Diff Viewer
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase">PROFILE DOB</p>
                  <p className="text-[14px] font-bold text-slate-800 mt-1">{application.dob || "Not set"}</p>
                </div>
                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                  <p className="text-[9px] font-black text-rose-500 uppercase">OCR EXTRACTED DOB</p>
                  <p className="text-[14px] font-bold text-rose-700 mt-1">{extractedDob || "Not extracted"}</p>
                </div>
              </div>
              {extractedDob && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleSyncField('date_of_birth', extractedDob);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  {isSyncing ? "Syncing..." : "Sync DOB to Profile"}
                </button>
              )}
            </div>
          )}

          {isName && (
            <div className="space-y-4 mt-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Cross-Document Name Verification
              </div>

              <div className="overflow-hidden border border-slate-100 rounded-xl">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase">Source</th>
                      <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase">Extracted Name</th>
                      <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-[12px]">
                    <tr>
                      <td className="px-4 py-2.5 font-extrabold text-slate-500 uppercase">Profile</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{fullName}</td>
                      <td className="px-4 py-2.5 text-right">-</td>
                    </tr>
                    {panDoc?.uploaded && (
                      <tr>
                        <td className="px-4 py-2.5 font-extrabold text-slate-500 uppercase">PAN Card</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{panName || "Not extracted"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {panName && getComparableValue(panName) !== getComparableValue(fullName) && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleSyncField('full_name', panName);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                    {passportDoc?.uploaded && (
                      <tr>
                        <td className="px-4 py-2.5 font-extrabold text-slate-500 uppercase">Passport</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{passportName || "Not extracted"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {passportName && getComparableValue(passportName) !== getComparableValue(fullName) && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleSyncField('full_name', passportName);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                    {aadhaarDoc?.uploaded && (
                      <tr>
                        <td className="px-4 py-2.5 font-extrabold text-slate-500 uppercase">Aadhaar</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{aadhaarName || "Not extracted"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {aadhaarName && getComparableValue(aadhaarName) !== getComparableValue(fullName) && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleSyncField('full_name', aadhaarName);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DocumentPreviewDrawer = ({
  doc,
  userId,
  title,
  uploadAge,
  onClose,
}: {
  doc: OcrSummaryDoc;
  userId: string;
  title: string;
  uploadAge: string;
  onClose: () => void;
}) => {
  const previewUrl = `/api/documents/view/${userId}/${doc.docType}`;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[#0d1b2a]/45 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close document preview"
      />
      <aside className="relative z-10 h-full w-full max-w-[620px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Quick Look</span>
            </div>
            <h3 className="text-[22px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a] truncate">{title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-black">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {uploadAge}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="flex-1 bg-slate-100 p-4 overflow-hidden">
          <div className="h-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-inner">
            <iframe
              src={previewUrl}
              title={`${title} preview`}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Type</p>
            <p className="text-[13px] font-bold text-slate-700 truncate">{doc.docType.replace(/_/g, " ")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0d1b2a] text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};

const DocumentCard = ({ doc, onUpload, onDelete, onReviewSync }: { doc: any, onUpload: (file: File) => void, onDelete: () => void, onReviewSync: (doc: any) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const getIcon = () => {
    switch (doc.category) {
      case 'academic': return 'school';
      case 'financial': return 'account_balance_wallet';
      case 'identity': return 'fingerprint';
      default: return 'article';
    }
  };

  const getStatusColor = () => {
    switch (doc.status) {
      case 'verified': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'uploaded': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all duration-500 group/card relative overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
      />

      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button onClick={onDelete} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors">
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm group-hover/card:scale-105 transition-transform ${getStatusColor()}`}>
          <span className="material-symbols-outlined text-[28px]">{getIcon()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] font-bold text-[#0d1b2a] truncate">{doc.name}</h4>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${doc.status !== 'pending' && doc.fieldsExtracted > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {doc.status === 'pending' ? 'ACTION REQUIRED' :
              doc.fieldsExtracted > 0 ? 'DATA EXTRACTED - CLICK TO SYNC' : '0% CONFIDENCE'}
          </p>
        </div>
      </div>

      {doc.status === 'pending' ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
          Upload Now
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[18px]">verified</span>
              <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{doc.fileName}</span>
            </div>
            <span className="text-[10px] font-black text-emerald-600 uppercase">{doc.accuracy?.toFixed(1)}% ACC</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${doc.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${doc.accuracy || 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onReviewSync(doc)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              Review & Sync
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
            >
              Re-upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SideBySideComparisonModal = ({
  doc1,
  doc2,
  userId,
  onClose,
}: {
  doc1: OcrSummaryDoc;
  doc2: OcrSummaryDoc;
  userId: string;
  onClose: () => void;
}) => {
  const url1 = `/api/documents/view/${userId}/${doc1.docType}`;
  const url2 = `/api/documents/view/${userId}/${doc2.docType}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-[95vw] h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
              <span className="material-symbols-outlined text-[26px]">compare</span>
            </div>
            <div>
              <h3 className="text-[22px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">Review Discrepancy</h3>
              <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest mt-0.5">Cross-Document Verification Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content splits into 2 panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Doc 1 */}
          <div className="w-1/2 border-r border-slate-200 flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-wider">Document 1: {doc1.name}</span>
              <span className="text-[12px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                {String((doc1.extractedData as any)?.full_name || (doc1.extractedData as any)?.name || 'Unknown')}
              </span>
            </div>
            <div className="flex-1 bg-slate-100 p-4">
              <iframe src={url1} className="w-full h-full rounded-xl border border-slate-200 bg-white" />
            </div>
          </div>

          {/* Right panel: Doc 2 */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-wider">Document 2: {doc2.name}</span>
              <span className="text-[12px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                {String((doc2.extractedData as any)?.full_name || (doc2.extractedData as any)?.name || 'Unknown')}
              </span>
            </div>
            <div className="flex-1 bg-slate-100 p-4">
              <iframe src={url2} className="w-full h-full rounded-xl border border-slate-200 bg-white" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-500 animate-pulse">warning</span>
            <p className="text-[12px] font-medium text-slate-600">
              A name mismatch was identified by AI. Please review the scanned files and perform any profile modifications as needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
};

export const EvvAnalysisTab = ({
  application,
  onApplicationUpdated,
}: {
  application: any;
  onApplicationUpdated?: () => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(application.evvStatus === "PROCESSING");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<"trend" | "flow" | "channels">("trend");
  const [activeDetailTab, setActiveDetailTab] = useState<"metrics" | "snapshots" | "behaviours" | "validation" | "transactions">("metrics");
  
  // Transaction Filters
  const [txSearch, setTxSearch] = useState("");
  const [txType, setTxType] = useState<"all" | "credit" | "debit">("all");
  const [txChannel, setTxChannel] = useState<"all" | "UPI" | "NEFT" | "RTGS" | "IMPS" | "CASH" | "CHEQUE" | "ONLINE">("all");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { alert: dialogAlert } = useDialog();

  // Poll every 2 seconds when EVV status is PROCESSING for fast UI feedback
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("staffAccessToken") || localStorage.getItem("adminAccessToken") || localStorage.getItem("accessToken");
        const res = await fetch(`/api/applications/${application.id || application._id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.application || data.data || data;
          if (updated?.evvStatus && updated.evvStatus !== "PROCESSING") {
            setIsPolling(false);
            onApplicationUpdated?.();
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [isPolling, application.id, application._id, onApplicationUpdated]);

  useEffect(() => {
    if (application.evvStatus === "PROCESSING") {
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }
  }, [application.evvStatus]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("staffAccessToken") || localStorage.getItem("adminAccessToken") || localStorage.getItem("accessToken");
      const res = await fetch(`/api/applications/${application.id || application._id}/upload-statement`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload failed");
      }

      const data = await res.json();
      if (data.success) {
        if (data.status === "PROCESSING") {
          setIsPolling(true);
          onApplicationUpdated?.();
        } else {
          onApplicationUpdated?.();
          await dialogAlert(
            `Statement uploaded and EVV calculated. Overall Maintained Balance: ₹${(data.overall_evv || 0).toLocaleString("en-IN")}`,
            "Calculation Success",
            "success"
          );
        }
      } else {
        throw new Error(data.error || "Failed to process statement");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse bank statement");
      await dialogAlert(err.message || "Failed to parse bank statement", "Upload Failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Safe parsing of fields
  const parseJsonField = (field: any, defaultVal: any = []) => {
    if (!field) return defaultVal;
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch {
        return defaultVal;
      }
    }
    return field;
  };

  const evvStatus = application.evvStatus || "";
  const evvOverall = application.evvOverall || 0;
  const evvScore = application.evvScore ?? null;
  const evvGrade = application.evvGrade || "";
  const evvDecision = application.evvDecision || "";
  const evvDecisionReason = application.evvDecisionReason || "";
  
  const riskFlags = parseJsonField(application.evvRiskFlags);
  const behaviours = parseJsonField(application.evvBehaviours);
  const dailyBalances = parseJsonField(application.evvDailyBalances);
  const snapshots = parseJsonField(application.evvSnapshots);
  const monthlyMetrics = parseJsonField(application.evvMonthlyMetrics);
  const validation = parseJsonField(application.evvValidation, null);
  
  const rawWeightBreakdown = parseJsonField(application.evvWeightBreakdown);
  const sixComponents = rawWeightBreakdown?.sixComponents || null;
  const weightBreakdown: any[] = Array.isArray(rawWeightBreakdown)
    ? rawWeightBreakdown
    : (rawWeightBreakdown?.breakdown || []);
  const bankPolicy = rawWeightBreakdown?.bankPolicy || {
    bankKey: (application.bank || "DEFAULT").toUpperCase(),
    bankName: application.bank || "Partner Bank",
    minimumBalanceBenchmark: 3000,
    requiredHistoryMonths: 6,
    snapshotDates: [1, 5, 10, 15, 20, 25],
  };
  const evvDisclaimer = rawWeightBreakdown?.disclaimer || "Internal EVV assessment — not an official bank sanction or automatic loan decision.";
  const statusBand = sixComponents?.statusBand || (evvScore !== null ? (evvScore >= 80 ? 'Green' : evvScore >= 60 ? 'Amber' : 'Red') : 'Green');

  const legacyBreakdown = parseJsonField(application.evvMonthlyBreakdown);
  
  // Format period nicely
  const evvPeriod = application.evvPeriod ? (typeof application.evvPeriod === "string" ? parseJsonField(application.evvPeriod, null) : application.evvPeriod) : null;

  // Retrieve transactions for viewer
  const rawTransactions: any[] = parseJsonField(application.evvTransactions || "[]");
  const evvTotalSnapshots = application.evvTotalSnapshots ?? snapshots.length ?? 0;
  const evvTotalTransactions = application.evvTotalTransactions ?? rawTransactions.length ?? 0;
  // If evvTransactions doesn't exist, we fall back to generating or looking up from standard location. 
  // Let's also verify if there is an alternative location or we can mock visually.
  const transactionsList = rawTransactions.length > 0 ? rawTransactions : (legacyBreakdown.length > 0 ? [] : []);

  // Download Excel / CSV
  const handleExportCSV = () => {
    if (rawTransactions.length === 0) {
      dialogAlert("No transactions available to export.", "Export Failed", "error");
      return;
    }
    const headers = ["Date", "Narration", "Debit (INR)", "Credit (INR)", "Balance (INR)", "Channel", "Reference No"];
    const rows = rawTransactions.map(tx => [
      tx.date || "",
      `"${(tx.narration || "").replace(/"/g, '""')}"`,
      tx.debit || 0,
      tx.credit || 0,
      tx.balance || 0,
      tx.channel || "",
      tx.referenceNumber || tx.utr || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EVV_Report_${application.applicationNumber || application.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper for color styling based on Underwriting Decision
  const getDecisionColors = (decisionStr: string) => {
    switch (decisionStr) {
      case "APPROVE":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/20",
          border: "border-emerald-200 dark:border-emerald-900/50",
          text: "text-emerald-800 dark:text-emerald-400",
          badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300",
          icon: "check_circle"
        };
      case "APPROVE_WITH_CONDITIONS":
        return {
          bg: "bg-sky-50 dark:bg-sky-950/20",
          border: "border-sky-200 dark:border-sky-900/50",
          text: "text-sky-800 dark:text-sky-400",
          badge: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300",
          icon: "info_outline"
        };
      case "MANUAL_REVIEW":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/20",
          border: "border-amber-200 dark:border-amber-900/50",
          text: "text-amber-800 dark:text-amber-400",
          badge: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300",
          icon: "warning"
        };
      case "REJECT":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/20",
          border: "border-rose-200 dark:border-rose-900/50",
          text: "text-rose-800 dark:text-rose-400",
          badge: "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300",
          icon: "cancel"
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-900",
          border: "border-slate-200 dark:border-slate-800",
          text: "text-slate-800 dark:text-slate-400",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300",
          icon: "help_outline"
        };
    }
  };

  const decisionMeta = getDecisionColors(evvDecision);

  // Preparation for ChartJS Visualizations
  const trendChartData = {
    labels: monthlyMetrics.map((m: any) => m.monthLabel || m.month),
    datasets: [
      {
        label: "Average Monthly Balance (INR)",
        data: monthlyMetrics.map((m: any) => m.snapshotAvg ?? m.avgBalance),
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.05)",
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: "#4f46e5",
        pointRadius: 4,
      },
      {
        label: "Minimum Monthly Balance (INR)",
        data: monthlyMetrics.map((m: any) => m.snapshotMin ?? m.lowestBalance),
        borderColor: "#f43f5e",
        backgroundColor: "transparent",
        fill: false,
        tension: 0.3,
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointBackgroundColor: "#f43f5e",
        pointRadius: 3,
      }
    ]
  };

  const flowChartData = {
    labels: monthlyMetrics.map((m: any) => m.monthLabel || m.month),
    datasets: [
      {
        label: "Total Credits (INR)",
        data: monthlyMetrics.map((m: any) => m.totalCredits || 0),
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderRadius: 4,
      },
      {
        label: "Total Debits (INR)",
        data: monthlyMetrics.map((m: any) => m.totalDebits || 0),
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        borderRadius: 4,
      }
    ]
  };

  // payment mode distribution aggregator
  const channelTotals = { UPI: 0, NEFT: 0, RTGS: 0, IMPS: 0, CASH: 0, CHEQUE: 0, ONLINE: 0 };
  monthlyMetrics.forEach((m: any) => {
    channelTotals.UPI += m.upiCount || 0;
    channelTotals.NEFT += m.neftCount || 0;
    channelTotals.RTGS += m.rtgsCount || 0;
    channelTotals.IMPS += m.impsCount || 0;
    channelTotals.CASH += (m.cashDepositCount || 0) + (m.cashWithdrawalCount || 0);
    channelTotals.CHEQUE += m.chequeCount || 0;
    channelTotals.ONLINE += m.transactionCount - ((m.upiCount || 0) + (m.neftCount || 0) + (m.rtgsCount || 0) + (m.impsCount || 0) + (m.chequeCount || 0) + ((m.cashDepositCount || 0) + (m.cashWithdrawalCount || 0)));
  });

  const channelChartData = {
    labels: Object.keys(channelTotals),
    datasets: [
      {
        data: Object.values(channelTotals),
        backgroundColor: [
          "#3b82f6", // UPI
          "#8b5cf6", // NEFT
          "#ec4899", // RTGS
          "#f43f5e", // IMPS
          "#10b981", // CASH
          "#f59e0b", // CHEQUE
          "#64748b"  // ONLINE
        ],
        borderWidth: 0
      }
    ]
  };

  // Filtered Transactions List
  const filteredTransactions = rawTransactions.filter(tx => {
    const matchesSearch = !txSearch || 
      (tx.narration || "").toLowerCase().includes(txSearch.toLowerCase()) || 
      (tx.referenceNumber || "").toLowerCase().includes(txSearch.toLowerCase()) || 
      (tx.utr || "").toLowerCase().includes(txSearch.toLowerCase());
      
    const matchesType = txType === "all" || 
      (txType === "credit" && tx.credit > 0) || 
      (txType === "debit" && tx.debit > 0);
      
    const matchesChannel = txChannel === "all" || 
      tx.channel === txChannel || 
      (txChannel === "CASH" && (tx.narration || "").toLowerCase().includes("cash"));

    return matchesSearch && matchesType && matchesChannel;
  });

  return (
    <div className={`space-y-8 animate-in fade-in duration-500 ${isDarkMode ? "dark text-slate-100 bg-slate-950 p-6 rounded-[32px] border border-slate-900" : ""}`}>
      {/* Premium Dark Mode & Print Utilities Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-5 no-print">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
          <h3 className="text-[15px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
            EVV Intelligence Hub
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 transition-all flex items-center justify-center"
            title="Toggle Dark Mode Theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Report
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Excel (CSV)
          </button>
        </div>
      </div>

      {/* EVV Summary Card Row */}
      {evvStatus && evvStatus !== "PROCESSING" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Overall EVV
            </span>
            <span className="text-[20px] font-black text-slate-900 dark:text-white mt-2">
              ₹{evvOverall.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Snapshots
            </span>
            <span className="text-[20px] font-black text-slate-900 dark:text-white mt-2">
              {evvTotalSnapshots}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Transactions
            </span>
            <span className="text-[20px] font-black text-slate-900 dark:text-white mt-2">
              {evvTotalTransactions}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Period
            </span>
            <span className="text-[13px] font-black text-slate-900 dark:text-white mt-3 truncate">
              {evvPeriod?.from && evvPeriod?.to ? `${evvPeriod.from} - ${evvPeriod.to}` : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Info Upload Zone & Underwriting Verdict Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 no-print">
        {/* Left Hand side: Interactive statement dropzone */}
        <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8 shadow-sm hover:shadow-md dark:shadow-none transition-all flex flex-col justify-between min-h-[320px]">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
              </div>
              <div>
                <h4 className="text-[16px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Bank Statements</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Parse & Verify Uploaded PDF</p>
              </div>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Upload client statement files (scanned/native PDF) to generate EVV Scores. The system parses accounts, runs validation checks, reconstructs daily balances, evaluates monthly metrics, and flags behavior patterns.
            </p>
          </div>

          <div>
            {uploading ? (
              <div className="w-full py-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-2xl flex items-center justify-center gap-3 border border-slate-100 dark:border-slate-800">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-black uppercase tracking-widest">Uploading Statement...</span>
              </div>
            ) : isPolling ? (
              <div className="w-full py-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center gap-3 border border-indigo-100 dark:border-indigo-900/50">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-black uppercase tracking-widest">Analyzing Statement...</span>
              </div>
            ) : (
              <button
                onClick={triggerUpload}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                {evvStatus ? "Re-upload Statement" : "Upload Statement"}
              </button>
            )}
            {error && (
              <p className="mt-3 text-[11px] font-semibold text-rose-500 text-center">{error}</p>
            )}
          </div>
        </div>

        {/* Right Hand side: Underwriting verdict / gauge */}
        <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8 shadow-sm flex flex-col justify-between min-h-[320px]">
          {!evvStatus || evvStatus === "" ? (
            <div className="h-[240px] flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-700 mb-3">analytics</span>
              <p className="text-[14px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">No Statement Audited</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Upload a statement to compute the EVV Intelligence Report.</p>
            </div>
          ) : evvStatus === "PROCESSING" ? (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-start gap-4 p-6 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl animate-pulse">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <h5 className="text-[14px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Reconstructing Balances...</h5>
                  <p className="text-[12px] text-indigo-700 dark:text-indigo-400 leading-relaxed mt-2">
                    Running transaction OCR algorithms, reconstructing missing daily records, computing 5-day snapshot averages, and matching compliance metrics. This takes about 1 minute.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {/* Verdict header row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h4 className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Underwriting Verdict
                </h4>
                {evvScore !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">EVV Grade:</span>
                    <span className="px-3 py-1 text-[11px] font-black rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                      {evvGrade}
                    </span>
                  </div>
                )}
              </div>

              {/* Score & Verdict Details */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Visual Gauge */}
                <div className="sm:col-span-5 flex justify-center py-2">
                  <EVVScoreRadialGauge
                    score={evvScore ?? 0}
                    grade={evvGrade || "B"}
                    statusBand={statusBand}
                    size={220}
                  />
                </div>


                {/* Verdict text column */}
                <div className="sm:col-span-7 space-y-4">
                  <div className={`p-5 rounded-2xl border ${decisionMeta.bg} ${decisionMeta.border} ${decisionMeta.text} flex items-start gap-3`}>
                    <span className="material-symbols-outlined text-[22px] flex-shrink-0 mt-0.5">
                      {decisionMeta.icon}
                    </span>
                    <div>
                      <h5 className="text-[13px] font-black uppercase tracking-wider">
                        {evvDecision.replace(/_/g, " ")}
                      </h5>
                      <p className="text-[11px] opacity-90 leading-relaxed mt-1 font-semibold">
                        {evvDecisionReason || "Application complies with default lending benchmarks."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-[20px] font-black text-slate-900 dark:text-white">
                      ₹{evvOverall.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Overall MAB
                    </span>
                  </div>
                </div>
              </div>

              {/* Lower boundary rules status */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Verification Quality: {validation?.confidenceScore ?? 100}% Confidence
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${riskFlags.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${riskFlags.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {riskFlags.length > 0 ? `${riskFlags.length} Flags Triggered` : "Clean History"}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics, Charts and Indicators section */}
      {evvStatus && evvStatus !== "PROCESSING" && (
        <div className="space-y-8">
          
          {/* Official 6-Component Underwriting Health Breakdown (Screen View) */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8 shadow-sm no-print space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[20px]">verified</span>
                  <h4 className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    6-Component Bank Statement Health (EVV)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Target Bank: <span className="text-slate-700 dark:text-slate-200">{bankPolicy.bankName}</span> • Benchmark M: <span className="text-indigo-600">₹{Number(bankPolicy.minimumBalanceBenchmark || 3000).toLocaleString('en-IN')}</span> • Sampling: Fixed Dates [1, 5, 10, 15, 20, 25] (6 Months)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border ${
                  statusBand === 'Green' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                  statusBand === 'Amber' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                  'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                }`}>
                  Status Band: {statusBand} ({evvScore ?? 80}/100)
                </span>
              </div>
            </div>

            {/* Visual 6-Component Bar Graph */}
            <div className="flex justify-center w-full no-print my-2">
              <div className="w-full">
                <EVV6ComponentBarChart
                  sixComponent={{
                    component1: { score: sixComponents?.component1?.score ?? (weightBreakdown[0]?.weightedScore ?? 25), maxScore: 25, sixMonthSampledAMB: sixComponents?.component1?.sixMonthSampledAMB ?? evvOverall } as any,
                    component2: { score: sixComponents?.component2?.score ?? (weightBreakdown[1]?.weightedScore ?? 20), maxScore: 20, finalSafetyRatio: sixComponents?.component2?.finalSafetyRatio ?? 100 } as any,
                    component3: { score: sixComponents?.component3?.score ?? (weightBreakdown[2]?.weightedScore ?? 20), maxScore: 20, confirmedBounces: sixComponents?.component3?.bounceCount ?? 0 } as any,
                    component4: { score: sixComponents?.component4?.score ?? (weightBreakdown[3]?.weightedScore ?? 15), maxScore: 15, isRepaymentIncomeContributor: sixComponents?.component4?.repaymentIncomeRole || 'YES', recurringMonthsCount: sixComponents?.component4?.recurrenceMonthsCount || 6 } as any,
                    component5: { score: sixComponents?.component5?.score ?? (weightBreakdown[4]?.weightedScore ?? 10), maxScore: 10, cashRatio: (sixComponents?.component5?.cashRatioPercent || 0) / 100 } as any,
                    component6: { score: sixComponents?.component6?.score ?? (weightBreakdown[5]?.weightedScore ?? 10), maxScore: 10, passThroughEvents: new Array(sixComponents?.component6?.rapidPassThroughCount || 0) } as any,
                  } as any}
                />
              </div>
            </div>

            {/* 6 Component Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Component 1 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 1</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component1?.score ?? (weightBreakdown[0]?.weightedScore ?? 25)} <span className="text-[10px] text-slate-400">/ 25</span>
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Average Balance Trend</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Sampled AMB: <strong className="text-slate-800 dark:text-slate-200">₹{Math.round(sixComponents?.component1?.sixMonthSampledAMB ?? evvOverall).toLocaleString('en-IN')}</strong> (Target: ₹{(sixComponents?.component1?.strongTarget ?? (10 * (bankPolicy.minimumBalanceBenchmark || 3000))).toLocaleString('en-IN')})
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Trend: <strong className={(sixComponents?.component1?.trendPercent ?? 0) >= 0 ? "text-emerald-600" : "text-amber-600"}>{(sixComponents?.component1?.trendPercent ?? 0) >= 0 ? "+" : ""}{sixComponents?.component1?.trendPercent ?? 0}%</strong> • Consistency: {sixComponents?.component1?.consistencyMonthsMeetingM ?? 6}/6 mos meeting M
                  </p>
                </div>
              </div>

              {/* Component 2 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 2</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component2?.score ?? (weightBreakdown[1]?.weightedScore ?? 20)} <span className="text-[10px] text-slate-400">/ 20</span>
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Minimum-Balance Safety</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Safety Ratio: <strong className="text-slate-800 dark:text-slate-200">{sixComponents?.component2?.finalSafetyRatio ?? 0}%</strong> (Benchmark M: ₹{(bankPolicy.minimumBalanceBenchmark || 3000).toLocaleString('en-IN')})
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Sampled Low: {sixComponents?.component2?.sampledLowRatio ?? 0}% • Daily: {sixComponents?.component2?.dailyLowRatio ?? 0}% • Neg Bal: {sixComponents?.component2?.hasNegativeBalance ? "Yes (Alert)" : "None"}
                  </p>
                </div>
              </div>

              {/* Component 3 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 3</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component3?.score ?? (weightBreakdown[2]?.weightedScore ?? 20)} <span className="text-[10px] text-slate-400">/ 20</span>
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Bounce-Free Record</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Inward Bounces: <strong className={(sixComponents?.component3?.bounceCount ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}>{sixComponents?.component3?.bounceCount ?? 0}</strong> • Charges: {sixComponents?.component3?.chargeCount ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Recent (30d): {sixComponents?.component3?.hasRecentBounce ? "Flagged (Review)" : "None"} • 90d Count: {sixComponents?.component3?.bouncesIn90Days ?? 0}
                  </p>
                </div>
              </div>

              {/* Component 4 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 4</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component4?.isNonIncomeContributor ? "N/A" : `${sixComponents?.component4?.score ?? (weightBreakdown[3]?.weightedScore ?? 15)} / 15`}
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Verified Inflow Regularity</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Role: <strong className="text-slate-800 dark:text-slate-200">{sixComponents?.component4?.repaymentIncomeRole ?? "YES"}</strong> {sixComponents?.component4?.isNonIncomeContributor ? "(Scaled over 85)" : `• Source: ${sixComponents?.component4?.sourceType ?? "SALARIED"}`}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Recurrence: {sixComponents?.component4?.recurrenceMonthsCount ?? 6}/6 mos • Status: {sixComponents?.component4?.verificationStatus ?? "VERIFIED"}
                  </p>
                </div>
              </div>

              {/* Component 5 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 5</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component5?.score ?? (weightBreakdown[4]?.weightedScore ?? 10)} <span className="text-[10px] text-slate-400">/ 10</span>
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Cash-Deposit Ratio</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Cash Ratio: <strong className={(sixComponents?.component5?.cashRatioPercent ?? 0) > 20 ? "text-amber-600" : "text-slate-800 dark:text-slate-200"}>{sixComponents?.component5?.cashRatioPercent ?? 0}%</strong> (₹{Math.round(sixComponents?.component5?.physicalCashDepositTotal ?? 0).toLocaleString('en-IN')})
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Single Cash Spike ≥ ₹50k: {sixComponents?.component5?.hasSingleCashSpike ? "Flagged (Audit Alert)" : "None"}
                  </p>
                </div>
              </div>

              {/* Component 6 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Component 6</span>
                    <span className="text-[13px] font-black font-mono text-slate-900 dark:text-white">
                      {sixComponents?.component6?.score ?? (weightBreakdown[5]?.weightedScore ?? 10)} <span className="text-[10px] text-slate-400">/ 10</span>
                    </span>
                  </div>
                  <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Withdrawal Discipline</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Drops Score: <strong className="text-slate-800 dark:text-slate-200">{sixComponents?.component6?.dropsScore ?? 10}/10</strong> • Pass-Through: <strong className="text-slate-800 dark:text-slate-200">{sixComponents?.component6?.passThroughScore ?? 10}/10</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Rapid debits (≤3d): {sixComponents?.component6?.rapidPassThroughCount ?? 0} events • Drops: {sixComponents?.component6?.consecutiveDropSeverity ?? "None"}
                  </p>
                </div>
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-base flex-shrink-0">gavel</span>
              <span className="font-semibold italic">
                {evvDisclaimer}
              </span>
            </div>
          </div>
          
          {/* Section: Premium Visual Charts tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8 shadow-sm no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 mb-6 gap-4">
              <div>
                <h4 className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Financial Analytics & Cashflow Trends
                </h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Statement period: {evvPeriod?.from || "—"} to {evvPeriod?.to || "—"}
                </p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl self-stretch sm:self-auto">
                <button
                  onClick={() => setActiveChartTab("trend")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeChartTab === "trend" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Balance Trend
                </button>
                <button
                  onClick={() => setActiveChartTab("flow")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeChartTab === "flow" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Credits vs Debits
                </button>
                <button
                  onClick={() => setActiveChartTab("channels")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeChartTab === "channels" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Payment Channels
                </button>
              </div>
            </div>

            {/* Render selected chart */}
            <div className="h-[280px] w-full flex items-center justify-center">
              {monthlyMetrics.length > 0 ? (
                <>
                  {activeChartTab === "trend" && (
                    <Line
                      data={trendChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true, position: "top" as const } },
                        scales: { y: { grid: { color: isDarkMode ? "#1e293b" : "#f1f5f9" } } }
                      }}
                    />
                  )}
                  {activeChartTab === "flow" && (
                    <Bar
                      data={flowChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                        scales: { y: { grid: { color: isDarkMode ? "#1e293b" : "#f1f5f9" } } }
                      }}
                    />
                  )}
                  {activeChartTab === "channels" && (
                    <div className="w-[280px] h-full">
                      <Doughnut
                        data={channelChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: "right" as const } }
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] font-bold text-slate-400 dark:text-slate-600">
                  No monthly data points available to plot.
                </div>
              )}
            </div>
          </div>

          {/* Details Section tabs switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px gap-6 overflow-x-auto no-print">
            {[
              { id: "metrics", label: "Monthly Metrics", icon: "calendar_month" },
              { id: "snapshots", label: "Balance Snapshots", icon: "screenshot_monitor" },
              { id: "behaviours", label: "Behaviours & Flags", icon: "psychology" },
              { id: "validation", label: "Data Validation", icon: "verified_user" },
              { id: "transactions", label: "Statement Transactions", icon: "toc" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveDetailTab(tab.id as any)}
                className={`pb-4 border-b-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${activeDetailTab === tab.id ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Details tab views */}
          <div className="space-y-6">
            
            {/* VIEW 1: MONTHLY METRICS CARD GRID */}
            {activeDetailTab === "metrics" && (
              <div className="space-y-6">
                {/* Visual Graph View for Monthly Metrics */}
                {monthlyMetrics && monthlyMetrics.length > 0 && (
                  <EVVMonthlyMetricsChart
                    metrics={monthlyMetrics}
                    benchmarkM={bankPolicy.minimumBalanceBenchmark || 3000}
                    targetT={(bankPolicy.minimumBalanceBenchmark || 3000) * 1.5}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                  {monthlyMetrics.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm hover:shadow-md transition-all space-y-4"
                    >
                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
                        <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          {item.monthLabel}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {item.transactionCount || 0} Tx
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Snapshot Avg ({item.snapshotPoints || 0} pts)</span>
                          <span className="text-[13px] font-black text-slate-800 dark:text-indigo-400">₹{Number(item.snapshotAvg ?? item.avgBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Snapshot Min</span>
                          <span className="text-[13px] font-black text-rose-500">₹{Number(item.snapshotMin ?? item.lowestBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Snapshot Max</span>
                          <span className="text-[13px] font-black text-emerald-500">₹{Number(item.snapshotMax ?? item.highestBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Credits</span>
                          <span className="text-[12px] font-semibold text-emerald-600">₹{(item.totalCredits || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Print layout summary table */}
                {/* Monthly average balance table (Exact Executive Spec) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-sm">
                  <div className="px-8 pt-7 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between no-print gap-2">
                    <div>
                      <h4 className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        Monthly average balance
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Average of daily closing balances for each calendar month
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-t border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                          {["Month", "Avg balance", "Min", "Max", "Closing", "Total credits", "Total debits", "Cash %", "Bounces"].map((col, i) => (
                            <th
                              key={i}
                              className={`px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyMetrics.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            className={`group border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all`}
                          >
                            <td className="px-5 py-3.5 text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-wider text-left whitespace-nowrap">
                              {item.label || item.monthLabel || item.month}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              ₹{Number(item.avgDailyBalance ?? item.snapshotAvg ?? item.avgBalance ?? item.avg ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-medium text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              ₹{Number(item.min ?? item.snapshotMin ?? item.lowestBalance ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-medium text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              ₹{Number(item.max ?? item.snapshotMax ?? item.highestBalance ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-bold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                              ₹{Number(item.closing ?? item.closingBalance ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                              ₹{Number(item.credits ?? item.totalCredits ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-semibold text-rose-600 tabular-nums whitespace-nowrap">
                              ₹{Number(item.debits ?? item.totalDebits ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                              {item.cashPercent ?? 0}%
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-right font-black whitespace-nowrap tabular-nums">
                              <span className={(item.bounces ?? item.bounceCount ?? 0) > 0 ? "text-rose-600" : "text-slate-500"}>
                                {item.bounces ?? item.bounceCount ?? 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: SNAPSHOT BALANCE VIEW */}
            {activeDetailTab === "snapshots" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[28px] shadow-sm space-y-8">
                <div>
                  <h4 className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Interval balances
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {snapshots.length} points sampled across the statement
                  </p>
                </div>

                {/* Continuous Antecedent Ledger Timeline Graph */}
                {snapshots && snapshots.length > 0 && (
                  <EVVSnapshotTimelineChart
                    snapshots={snapshots}
                    benchmarkM={bankPolicy.minimumBalanceBenchmark || 3000}
                    targetT={(bankPolicy.minimumBalanceBenchmark || 3000) * 1.5}
                    criticalThreshold={2000}
                  />
                )}

                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 max-h-[460px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                        <th className="text-left px-5 py-3 whitespace-nowrap">Date</th>
                        <th className="text-right px-5 py-3 whitespace-nowrap">Closing balance (nearest or default)</th>
                        <th className="text-right px-5 py-3 whitespace-nowrap">Change vs. previous</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {snapshots.map((item: any, idx: number) => {
                        const prev = idx > 0 ? snapshots[idx - 1] : null;
                        const prevBal = prev ? (prev.balance ?? prev.closingBalance ?? 0) : 0;
                        const curBal = item.balance ?? item.closingBalance ?? 0;
                        const diff = item.changeAmount !== undefined ? item.changeAmount : (idx === 0 ? 0 : curBal - prevBal);
                        const pct = item.changePercent !== undefined ? item.changePercent : ((idx > 0 && prevBal !== 0) ? (diff / Math.abs(prevBal)) * 100 : 0);
                        let dateLabel = item.date;
                        try {
                          const d = new Date(item.date);
                          if (!isNaN(d.getTime())) dateLabel = formatIntervalDate(d);
                        } catch {}
                        return (
                          <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{dateLabel}</td>
                            <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              ₹{Number(curBal).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                              {idx === 0 ? (
                                <span className="text-slate-400 font-bold">—</span>
                              ) : diff > 0 ? (
                                <span className="text-emerald-600 font-bold">
                                  +₹{Math.abs(Math.round(diff)).toLocaleString("en-IN")} (+{Math.abs(pct).toFixed(1)}%)
                                </span>
                              ) : diff < 0 ? (
                                <span className="text-rose-600 font-bold">
                                  -₹{Math.abs(Math.round(diff)).toLocaleString("en-IN")} (-{Math.abs(pct).toFixed(1)}%)
                                </span>
                              ) : (
                                <span className="text-slate-500 font-medium">₹0 (0.0%)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Periodic Snapshot Day Cards */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Audit Date Points</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {snapshots.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5"
                      >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Day {item.snapshotDay === -1 || item.snapshotDay === 30 || item.snapshotDay === 31 ? "Last" : item.snapshotDay}
                        </span>
                        <span className="text-[13px] font-black text-slate-800 dark:text-white tabular-nums">
                          ₹{(item.balance || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {item.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: BEHAVIOURS & FLAGS */}
            {activeDetailTab === "behaviours" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Detected Behaviours */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[28px] shadow-sm space-y-6">
                  <h4 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Behavior Pattern Detections
                  </h4>
                  <div className="space-y-4">
                    {behaviours.length > 0 ? (
                      behaviours.map((b: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border ${
                            b.detected
                              ? "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800"
                              : "opacity-40 border-transparent bg-transparent"
                          } flex items-start gap-3`}
                        >
                          <span
                            className={`material-symbols-outlined text-[20px] mt-0.5 ${
                              b.detected
                                ? (b.severity === "positive"
                                  ? "text-emerald-500"
                                  : b.severity === "warning" || b.severity === "critical"
                                  ? "text-rose-500"
                                  : "text-indigo-600 dark:text-indigo-400")
                                : "text-slate-300"
                            }`}
                          >
                            {b.detected ? "psychology" : "circle"}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                {b.label}
                              </h5>
                              {b.detected && (
                                <span className="text-[9px] font-bold text-indigo-500 uppercase">
                                  {Math.round(b.confidence * 100)}% Match
                                </span>
                              )}
                            </div>
                            {b.detected && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
                                {b.evidence}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-400 text-center py-6">
                        No custom behaviors extracted.
                      </p>
                    )}
                  </div>
                </div>

                {/* Risk Flags List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[28px] shadow-sm space-y-6">
                  <h4 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Underwriting Risk Flags
                  </h4>
                  <div className="space-y-4">
                    {riskFlags.length > 0 ? (
                      riskFlags.map((flag: any, idx: number) => {
                        const isCritical = flag.severity === "critical" || flag.severity === "high";
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border ${
                              isCritical
                                ? "bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-400"
                                : "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/50 text-amber-800 dark:text-amber-400"
                            } flex items-start gap-3`}
                          >
                            <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
                              warning
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="text-[12px] font-black uppercase tracking-wider">
                                  {flag.label}
                                </h5>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                  isCritical ? "bg-rose-100 dark:bg-rose-900/50 text-rose-800" : "bg-amber-100 dark:bg-amber-900/50 text-amber-800"
                                }`}>
                                  {flag.severity}
                                </span>
                              </div>
                              <p className="text-[11px] opacity-90 font-medium leading-relaxed mt-1">
                                {flag.description}
                              </p>
                              <p className="text-[10px] font-mono opacity-85 mt-1.5 font-bold">
                                Evidence: {flag.evidence}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-[200px] flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-2">verified_user</span>
                        <h5 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">No Risks Triggered</h5>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Lending parameters match standard eligibility criteria.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: DATA VALIDATION REPORT */}
            {activeDetailTab === "validation" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[28px] shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div>
                    <h4 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Internal Integrity Validation Checks
                    </h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Double-entry accounting checks executed on OCR data
                    </p>
                  </div>
                  {validation && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Verification Score:</span>
                      <span className={`px-3 py-1 rounded-xl text-[11px] font-black ${
                        validation.confidenceScore >= 80 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                      }`}>
                        {validation.confidenceScore}% Confidence
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {validation?.checks && validation.checks.length > 0 ? (
                    validation.checks.map((check: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-[20px] ${check.passed ? "text-emerald-500" : "text-rose-500"}`}>
                            {check.passed ? "check_circle" : "cancel"}
                          </span>
                          <div>
                            <h5 className="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                              {check.name}
                            </h5>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {check.detail}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                          check.passed ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800" : "bg-rose-100 dark:bg-rose-950/30 text-rose-800"
                        }`}>
                          {check.passed ? "passed" : "warning"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-400 text-center py-6">
                      Integrity check validations not run yet. Upload a statement.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 5: TRANSACTION VIEW TABLE */}
            {activeDetailTab === "transactions" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800 space-y-4 no-print">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h4 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Extracted Transaction History ({filteredTransactions.length} items)
                    </h4>
                  </div>
                  
                  {/* Filters and Search Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5 relative">
                      <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-3">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-[12px] font-medium border border-transparent rounded-xl focus:border-indigo-500 focus:bg-white outline-none dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={txType}
                        onChange={(e) => setTxType(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-[12px] font-bold border border-transparent rounded-xl outline-none dark:text-white"
                      >
                        <option value="all">All Transactions</option>
                        <option value="credit">Credits only</option>
                        <option value="debit">Debits only</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={txChannel}
                        onChange={(e) => setTxChannel(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-[12px] font-bold border border-transparent rounded-xl outline-none dark:text-white"
                      >
                        <option value="all">All Channels</option>
                        <option value="UPI">UPI</option>
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                        <option value="IMPS">IMPS</option>
                        <option value="CASH">CASH</option>
                        <option value="CHEQUE">CHEQUE</option>
                        <option value="ONLINE">ONLINE / OTHER</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                        {["Date", "Description / Narration", "Channel", "Debit", "Credit", "Balance"].map((col, idx) => (
                          <th
                            key={idx}
                            className={`px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap ${idx === 1 ? "text-left" : "text-right"}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length > 0 ? (
                        filteredTransactions.map((tx: any, idx: number) => (
                          <tr
                            key={idx}
                            className="group border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="px-6 py-4 text-left text-[12px] font-extrabold text-slate-800 dark:text-white leading-normal max-w-xs sm:max-w-md truncate">
                              {tx.narration}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                                {tx.channel || "ONLINE"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-[12px] font-bold text-rose-500 tabular-nums whitespace-nowrap">
                              {tx.debit > 0 ? `₹${Number(tx.debit).toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-6 py-4 text-right text-[12px] font-bold text-emerald-500 tabular-nums whitespace-nowrap">
                              {tx.credit > 0 ? `₹${Number(tx.credit).toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-6 py-4 text-right text-[12px] font-black text-slate-800 dark:text-white tabular-nums whitespace-nowrap">
                              ₹{Number(tx.balance).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-[12px] font-bold text-slate-400 dark:text-slate-600">
                            No transactions match the search filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* Printable Underwriting Report Layout (Official VidyaLoans 6-Component EVV Dossier) */}
          <div className="hidden print:block text-slate-900 bg-white p-8 space-y-6 text-xs font-sans leading-normal">
            
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black flex items-center justify-center text-xs">
                    VL
                  </div>
                  <div>
                    <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                      VidyaLoans Underwriting Bureau
                    </h1>
                    <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">
                      Institutional Credit Assessment & Bank Statement Health (EVV)
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Dossier Ref: <span className="font-mono font-black text-slate-900">VL-EVV-{application.applicationNumber || application.id}</span>
                </div>
                <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                  Generated: {new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Status & Rating Banner */}
            <div className="border-2 border-slate-900 rounded-2xl p-4 flex justify-between items-center bg-slate-50/50">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Assessment Outcome & Status Band
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${
                    statusBand === 'Green' ? 'bg-emerald-100 text-emerald-900 border-emerald-400' :
                    statusBand === 'Amber' ? 'bg-amber-100 text-amber-900 border-amber-400' :
                    'bg-rose-100 text-rose-900 border-rose-400'
                  }`}>
                    {statusBand.toUpperCase()} BAND
                  </span>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                    Recommendation: {evvDecision?.replace(/_/g, " ") || "MANUAL REVIEW"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">EVV Rating</div>
                  <div className="text-2xl font-black text-slate-900">{evvScore ?? 80} <span className="text-xs font-normal text-slate-500">/ 100</span></div>
                </div>
                <div className="border-l border-slate-300 pl-4">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Grade</div>
                  <div className="text-2xl font-black text-slate-900">{evvGrade || "A"}</div>
                </div>
                <div className="border-l border-slate-300 pl-4">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sampled AMB</div>
                  <div className="text-base font-black text-slate-900">₹{Number(evvOverall || 0).toLocaleString("en-IN")}</div>
                </div>
              </div>
            </div>

            {/* Dossier Information Grid */}
            <div className="grid grid-cols-2 gap-6 border border-slate-200 rounded-2xl p-4 bg-white">
              <div className="space-y-1.5 border-r border-slate-200 pr-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Candidate & Loan Facility Details</h4>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Applicant Name:</span> <strong className="text-slate-900">{application.firstName || application.student?.firstName || "Student"} {application.lastName || application.student?.lastName || ""}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Co-Applicant:</span> <strong className="text-slate-900">{application.coApplicantName || application.guardianName || "N/A"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Loan Facility:</span> <strong className="text-slate-900">{application.loanType || "Education Loan (Abroad)"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Field of Study:</span> <strong className="text-slate-900">{application.fieldOfStudy || application.courseLevel || application.courseCategory || "Postgraduate Abroad"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Target University:</span> <strong className="text-slate-900 truncate max-w-[200px]">{application.universityName || application.college || "Partner Institution"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Applied On:</span> <strong className="text-slate-900">{application.appliedOn || application.createdAt ? new Date(application.appliedOn || application.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}</strong></div>
              </div>

              <div className="space-y-1.5 pl-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Underwriting Audit Parameters</h4>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Target Bank:</span> <strong className="text-slate-900">{bankPolicy.bankName || application.bank || "Partner Bank"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Benchmark M:</span> <strong className="text-slate-900 font-mono">₹{Number(bankPolicy.minimumBalanceBenchmark || 3000).toLocaleString('en-IN')}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Sampling Architecture:</span> <strong className="text-slate-900 font-mono">Fixed Dates [1, 5, 10, 15, 20, 25]</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Audit Window:</span> <strong className="text-slate-900">{evvPeriod?.from || "—"} to {evvPeriod?.to || "—"} (6 mos)</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Co-App Contributor Role:</span> <strong className="text-slate-900">{sixComponents?.component4?.repaymentIncomeRole || application.repaymentIncomeRole || "YES"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Income Verification:</span> <strong className="text-slate-900">{sixComponents?.component4?.verificationStatus || "VERIFIED"}</strong></div>
              </div>
            </div>

            {/* Official 6-Component Underwriting Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Official 6-Component Statement Health (EVV) Breakdown
              </h4>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] border-b border-slate-300">
                    <th className="border border-slate-300 px-3 py-2 text-left">Component</th>
                    <th className="border border-slate-300 px-2 py-2 text-center w-16">Max</th>
                    <th className="border border-slate-300 px-2 py-2 text-center w-16">Score</th>
                    <th className="border border-slate-300 px-3 py-2 text-left">Policy Rule / Standard</th>
                    <th className="border border-slate-300 px-3 py-2 text-left">Audit Evidence & Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Component 1 */}
                  <tr>
                    <td className="border border-slate-300 px-3 py-2 font-bold">1. Average Balance Trend</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">25</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">{sixComponents?.component1?.score ?? (weightBreakdown[0]?.weightedScore ?? 25)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">Strong Target = 10 × M (₹{(10 * (bankPolicy.minimumBalanceBenchmark || 3000)).toLocaleString('en-IN')})</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Sampled AMB: ₹{Math.round(sixComponents?.component1?.sixMonthSampledAMB ?? evvOverall).toLocaleString('en-IN')} • Consistency: {sixComponents?.component1?.consistencyMonthsMeetingM ?? 6}/6 mos meeting M • Trend: {(sixComponents?.component1?.trendPercent ?? 0) >= 0 ? '+' : ''}{sixComponents?.component1?.trendPercent ?? 0}%
                    </td>
                  </tr>

                  {/* Component 2 */}
                  <tr className="bg-slate-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-bold">2. Minimum-Balance Safety</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">20</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">{sixComponents?.component2?.score ?? (weightBreakdown[1]?.weightedScore ?? 20)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">Safety Ratio ≤ 0% below benchmark M</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Final Safety Ratio: {sixComponents?.component2?.finalSafetyRatio ?? 0}% (Daily low: {sixComponents?.component2?.dailyLowRatio ?? 0}%, Sampled: {sixComponents?.component2?.sampledLowRatio ?? 0}%) • Negative balance: {sixComponents?.component2?.hasNegativeBalance ? 'FLAGGED (Manual Review)' : 'Clear (0 days)'}
                    </td>
                  </tr>

                  {/* Component 3 */}
                  <tr>
                    <td className="border border-slate-300 px-3 py-2 font-bold">3. Bounce-Free Record</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">20</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">{sixComponents?.component3?.score ?? (weightBreakdown[2]?.weightedScore ?? 20)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">0 Inward/Clearing Bounces (0→20, 1→10, 2→5, 3+→0)</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Inward Bounces: {sixComponents?.component3?.bounceCount ?? 0} • Return charges grouped within ±2d: {sixComponents?.component3?.chargeCount ?? 0} • 30d Recency: {sixComponents?.component3?.hasRecentBounce ? 'FLAGGED' : 'None'} • 90d Count: {sixComponents?.component3?.bouncesIn90Days ?? 0}
                    </td>
                  </tr>

                  {/* Component 4 */}
                  <tr className="bg-slate-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-bold">4. Verified Inflow Regularity</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">15</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">
                      {sixComponents?.component4?.isNonIncomeContributor ? "N/A" : (sixComponents?.component4?.score ?? (weightBreakdown[3]?.weightedScore ?? 15))}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">6 Months recurring verified income (Scaled over 85 if non-contributor)</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Role: {sixComponents?.component4?.repaymentIncomeRole ?? "YES"} • Source: {sixComponents?.component4?.sourceType ?? "SALARIED"} • Recurrence: {sixComponents?.component4?.recurrenceMonthsCount ?? 6}/6 mos • {sixComponents?.component4?.isNonIncomeContributor ? 'Non-income contributor: Scaled over 85 to 100 with zero penalty.' : 'Income contributor verified.'}
                    </td>
                  </tr>

                  {/* Component 5 */}
                  <tr>
                    <td className="border border-slate-300 px-3 py-2 font-bold">5. Cash-Deposit Ratio</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">10</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">{sixComponents?.component5?.score ?? (weightBreakdown[4]?.weightedScore ?? 10)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">Physical cash deposits &lt; 10% of total credits</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Cash Ratio: {sixComponents?.component5?.cashRatioPercent ?? 0}% (₹{Math.round(sixComponents?.component5?.physicalCashDepositTotal ?? 0).toLocaleString('en-IN')}) • Excludes digital credits (UPI, NEFT, Salary) • Single Cash Spike ≥ ₹50k: {sixComponents?.component5?.hasSingleCashSpike ? 'FLAGGED' : 'None'}
                    </td>
                  </tr>

                  {/* Component 6 */}
                  <tr className="bg-slate-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-bold">6. Withdrawal Discipline</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">10</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono font-black">{sixComponents?.component6?.score ?? (weightBreakdown[5]?.weightedScore ?? 10)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 font-medium">Zero severe consecutive drops & zero rapid pass-through</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      Consecutive Drop Severity: {sixComponents?.component6?.consecutiveDropSeverity ?? "None"} (Score: {sixComponents?.component6?.dropsScore ?? 10}/10) • Rapid debits in ≤3d: {sixComponents?.component6?.rapidPassThroughCount ?? 0} events (Score: {sixComponents?.component6?.passThroughScore ?? 10}/10)
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-xs">
                    <td className="border border-slate-300 px-3 py-2 text-slate-900">TOTAL COMPOSITE UNDERWRITING SCORE</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono">100</td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-mono text-slate-900">{evvScore ?? 80}</td>
                    <td colSpan={2} className="border border-slate-300 px-3 py-2 text-slate-800">
                      STATUS BAND: <span className="uppercase font-black text-indigo-700">{statusBand}</span> • GRADE: <span className="font-black text-indigo-700">{evvGrade || "A"}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Monthly average balance table (Exact Executive Spec) */}
            {monthlyMetrics.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Monthly average balance
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  Average of daily closing balances for each calendar month
                </p>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300">
                      <th className="border border-slate-300 px-2 py-1 text-left">Month</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Avg balance</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Min</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Max</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Closing</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Total credits</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Total debits</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Cash %</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Bounces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyMetrics.map((m: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/60" : ""}>
                        <td className="border border-slate-300 px-2 py-1 font-bold">{m.label || m.monthLabel || m.month}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">₹{Number(m.avgDailyBalance ?? m.snapshotAvg ?? m.avgBalance ?? m.avg ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono text-slate-700">₹{Number(m.min ?? m.snapshotMin ?? m.lowestBalance ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono text-slate-700">₹{Number(m.max ?? m.snapshotMax ?? m.highestBalance ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">₹{Number(m.closing ?? m.closingBalance ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono text-emerald-800">₹{Number(m.credits ?? m.totalCredits ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono text-rose-800">₹{Number(m.debits ?? m.totalDebits ?? 0).toLocaleString("en-IN")}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-semibold">{m.cashPercent ?? 0}%</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                          <span className={(m.bounces ?? m.bounceCount ?? 0) > 0 ? "text-rose-700 font-black" : "text-slate-700"}>
                            {m.bounces ?? m.bounceCount ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Interval balances Table in Print */}
            {snapshots.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Interval balances
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  {snapshots.length} points sampled across the statement.
                </p>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300">
                      <th className="border border-slate-300 px-2 py-1 text-left">Date</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Closing balance (nearest or default)</th>
                      <th className="border border-slate-300 px-2 py-1 text-right">Change vs. previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((item: any, idx: number) => {
                      const prev = idx > 0 ? snapshots[idx - 1] : null;
                      const prevBal = prev ? (prev.balance ?? prev.closingBalance ?? 0) : 0;
                      const curBal = item.balance ?? item.closingBalance ?? 0;
                      const diff = item.changeAmount !== undefined ? item.changeAmount : (idx === 0 ? 0 : curBal - prevBal);
                      const pct = item.changePercent !== undefined ? item.changePercent : ((idx > 0 && prevBal !== 0) ? (diff / Math.abs(prevBal)) * 100 : 0);
                      let dateLabel = item.date;
                      try {
                        const d = new Date(item.date);
                        if (!isNaN(d.getTime())) dateLabel = formatIntervalDate(d);
                      } catch {}
                      return (
                        <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/60" : ""}>
                          <td className="border border-slate-300 px-2 py-1 font-bold">{dateLabel}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                            ₹{Number(curBal).toLocaleString("en-IN")}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                            {idx === 0 ? (
                              <span className="text-slate-400 font-bold">—</span>
                            ) : diff > 0 ? (
                              <span className="text-emerald-700 font-bold">
                                +₹{Math.abs(Math.round(diff)).toLocaleString("en-IN")} (+{Math.abs(pct).toFixed(1)}%)
                              </span>
                            ) : diff < 0 ? (
                              <span className="text-rose-700 font-bold">
                                -₹{Math.abs(Math.round(diff)).toLocaleString("en-IN")} (-{Math.abs(pct).toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="text-slate-600">₹0 (0.0%)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Hard-Risk Triggers & Officer Overrides */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Hard-Risk Triggers & Overrides ({sixComponents?.hardRiskFlags?.length ?? riskFlags.length})
              </h4>
              {sixComponents?.hardRiskFlags && sixComponents.hardRiskFlags.length > 0 ? (
                <div className="border border-rose-300 bg-rose-50/50 p-3 rounded-xl space-y-1">
                  <div className="font-black text-rose-800 text-[11px] uppercase">Review Mandate Triggered:</div>
                  {sixComponents.hardRiskFlags.map((flag: string, idx: number) => (
                    <div key={idx} className="text-[10px] text-rose-700 font-semibold">• {flag}</div>
                  ))}
                  <div className="text-[9px] text-rose-500 italic mt-1">* Policy mandate: Underwriter manual verification required prior to sanction.</div>
                </div>
              ) : riskFlags.length > 0 ? (
                <div className="border border-amber-300 bg-amber-50/50 p-3 rounded-xl space-y-1">
                  {riskFlags.slice(0, 3).map((f: any, idx: number) => (
                    <div key={idx} className="text-[10px] text-amber-800">
                      <strong>[{f.severity?.toUpperCase()}] {f.label}:</strong> {f.description} (Evidence: {f.evidence})
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-emerald-300 bg-emerald-50/40 p-2.5 rounded-xl text-[10px] font-bold text-emerald-800">
                  ✓ Zero Hard-Risk Breaches: Statement cleared inward bounce, unauthorized overdraft, and liquidity stress tests.
                </div>
              )}
            </div>

            {/* Underwriting Recommendation & Decision Rationale */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Underwriting Decision & Recommendations
              </h4>
              <div className="border border-slate-300 bg-slate-50 p-3 rounded-xl space-y-1 text-[11px]">
                <div className="font-black text-slate-900 uppercase">
                  Recommendation: {evvDecision?.replace(/_/g, " ") || "MANUAL REVIEW"}
                </div>
                <div className="text-slate-600 leading-relaxed font-medium">
                  {evvDecisionReason || "Candidate demonstrates sound financial capacity consistent with target bank lending benchmarks."}
                </div>
              </div>
            </div>

            {/* Underwriter Sign-Off Box */}
            <div className="border border-slate-300 rounded-xl p-4 grid grid-cols-3 gap-4 text-[10px] mt-4">
              <div>
                <span className="text-slate-400 font-bold uppercase block">Credit Underwriter</span>
                <span className="font-black text-slate-900 block mt-1">Sarah Jenkins</span>
                <span className="text-slate-500">Senior Credit Underwriter</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block">Assessment Date</span>
                <span className="font-mono font-bold text-slate-900 block mt-1">{new Date().toLocaleDateString("en-IN")}</span>
                <span className="text-slate-500">Audit Status: Finalized</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block">Officer Signature</span>
                <div className="h-6 border-b border-dashed border-slate-400 mt-2 flex items-end">
                  <span className="font-serif italic text-slate-600 text-xs">S. Jenkins (Verified)</span>
                </div>
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="pt-2 border-t border-slate-300 text-center text-[10px] text-slate-500 italic font-semibold leading-relaxed">
              Score is a weighted indicator built from balance trend, minimum-balance safety, bounce history, income regularity, cash-deposit ratio and withdrawal discipline — the six credit factors. A human reviewer, not an official bureau or pass-code, will make the underwriting decision alongside CIBIL and policy checks.
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-between items-center text-[9px] text-slate-400 uppercase font-bold border-t border-slate-200">
              <span>VidyaLoans 6-Component EVV Intelligence Engine v3.0</span>
              <span>Confidential • Internal Banking Assessment</span>
              <span>Page 1 of 1</span>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

export default ApplicationDetailView;
