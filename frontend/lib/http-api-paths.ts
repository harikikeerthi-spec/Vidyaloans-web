/**
 * Single source of truth for `/api/*` paths (Next.js proxy → backend).
 * Use these builders everywhere so staff dashboard (and clients) stay in sync when routes change.
 */

export const HTTP_API_PREFIX = "/api" as const;

export type QueryRecord = Record<string, string | number | boolean | undefined | null>;

/** Query string from params; omits undefined / null / "". */
export function httpApiQuery(params: QueryRecord): string {
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null || val === "") continue;
        sp.set(key, String(val));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
}

function enc(segment: string): string {
    return encodeURIComponent(segment);
}

export const HttpApiPaths = {
    auth: {
        sendOtp: () => `${HTTP_API_PREFIX}/auth/send-otp`,
        verifyOtp: () => `${HTTP_API_PREFIX}/auth/verify-otp`,
        firebase: () => `${HTTP_API_PREFIX}/auth/firebase`,
        refresh: () => `${HTTP_API_PREFIX}/auth/refresh`,
        logout: () => `${HTTP_API_PREFIX}/auth/logout`,
        dashboard: () => `${HTTP_API_PREFIX}/auth/dashboard`,
        dashboardData: () => `${HTTP_API_PREFIX}/auth/dashboard-data`,
        updateDetails: () => `${HTTP_API_PREFIX}/auth/update-details`,
        uploadDocument: () => `${HTTP_API_PREFIX}/auth/upload-document`,
        createApplication: () => `${HTTP_API_PREFIX}/auth/create-application`,
        applicationById: (id: string) => `${HTTP_API_PREFIX}/auth/application/${enc(id)}`,
    },

    reference: {
        banks: () => `${HTTP_API_PREFIX}/reference/banks`,
        countries: () => `${HTTP_API_PREFIX}/reference/countries`,
        universities: () => `${HTTP_API_PREFIX}/reference/universities`,
        offices: () => `${HTTP_API_PREFIX}/reference/offices`,
        officeById: (id: string) => `${HTTP_API_PREFIX}/reference/offices/${enc(id)}`,
    },

    onboarding: {
        root: () => `${HTTP_API_PREFIX}/onboarding`,
        status: (userId: string) => `${HTTP_API_PREFIX}/onboarding/status/${enc(userId)}`,
        share: () => `${HTTP_API_PREFIX}/onboarding/share`,
    },

    documents: {
        byUserId: (userId: string) => `${HTTP_API_PREFIX}/documents/${enc(userId)}`,
        byUserIdAndDocType: (userId: string, docType: string) =>
            `${HTTP_API_PREFIX}/documents/${enc(userId)}/${enc(docType)}`,
        upload: () => `${HTTP_API_PREFIX}/documents/upload`,
        digilockerInitiate: () => `${HTTP_API_PREFIX}/documents/digilocker/initiate`,
        /** Full-page redirect URL for OAuth */
        digilockerAuthorizeRedirect: (userId: string, docType: string) =>
            `${HTTP_API_PREFIX}/digilocker/authorize${httpApiQuery({ userId, docType })}`,
        digilockerSync: () => `${HTTP_API_PREFIX}/digilocker/sync`,
        ocrReverify: () => `${HTTP_API_PREFIX}/documents/ocr-reverify`,
        requirement: () => `${HTTP_API_PREFIX}/documents/requirement`,
        presignedView: (userId: string, docType: string) =>
            `${HTTP_API_PREFIX}/documents/presigned-view/${enc(userId)}/${enc(docType)}`,
        streamView: (userId: string, docType: string) =>
            `${HTTP_API_PREFIX}/documents/view/${enc(userId)}/${enc(docType)}`,
        presignedUrl: () => `${HTTP_API_PREFIX}/documents/presigned-url`,
        completeUpload: () => `${HTTP_API_PREFIX}/documents/complete-upload`,
        userDocumentsLegacy: (userId: string) => `${HTTP_API_PREFIX}/documents/user/${enc(userId)}`,
        checkDuplicate: (userId: string, docType: string) =>
            `${HTTP_API_PREFIX}/documents/check-duplicate${httpApiQuery({ userId, docType })}`,
        byDocId: (docId: string) => `${HTTP_API_PREFIX}/documents/${enc(docId)}`,
        download: () => `${HTTP_API_PREFIX}/documents/download`,
        verifyByDocId: (docId: string) => `${HTTP_API_PREFIX}/documents/${enc(docId)}/verify`,
        accept: (docId: string) => `${HTTP_API_PREFIX}/documents/${enc(docId)}/accept`,
        reject: (docId: string) => `${HTTP_API_PREFIX}/documents/${enc(docId)}/reject`,
    },

    staffProfiles: {
        list: (params?: { search?: string; bankStatus?: string }) =>
            `${HTTP_API_PREFIX}/staff-profiles${httpApiQuery({
                search: params?.search,
                bankStatus: params?.bankStatus,
            })}`,
        check: (userId: string) => `${HTTP_API_PREFIX}/staff-profiles/check/${enc(userId)}`,
        root: () => `${HTTP_API_PREFIX}/staff-profiles`,
        byId: (profileId: string) => `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}`,
        fetchDocuments: (profileId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/fetch-documents`,
        documents: (profileId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/documents`,
        documentStatus: (profileId: string, docId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/documents/${enc(docId)}/status`,
        documentById: (profileId: string, docId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/documents/${enc(docId)}`,
        share: (profileId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/share`,
        shares: (profileId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/${enc(profileId)}/shares`,
        activities: () => `${HTTP_API_PREFIX}/staff-profiles/activities`,
        dashboardActivities: (limit: number, staffId?: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/dashboard/activities${httpApiQuery({ limit, staffId })}`,
        activitiesAll: (opts: { limit?: number; offset?: number; type?: string; search?: string; staffId?: string }) =>
            `${HTTP_API_PREFIX}/staff-profiles/activities/all${httpApiQuery(opts)}`,
        staffList: () => `${HTTP_API_PREFIX}/staff-profiles/activities/staff-list`,
        toggleResign: (id: string) => `${HTTP_API_PREFIX}/staff-profiles/${enc(id)}/resign`,
        shareProfile: (studentId: string) =>
            `${HTTP_API_PREFIX}/staff-profiles/share-profile/${enc(studentId)}`,
        today: () => `${HTTP_API_PREFIX}/staff-profiles/dashboard/today`,
        summary: () => `${HTTP_API_PREFIX}/staff-profiles/dashboard/summary`,
        rejections: (period?: string) => `${HTTP_API_PREFIX}/staff-profiles/dashboard/rejections${httpApiQuery({ period })}`,
        sla: () => `${HTTP_API_PREFIX}/staff-profiles/dashboard/sla`,
        search: (q: string) => `${HTTP_API_PREFIX}/staff-profiles/dashboard/search${httpApiQuery({ q })}`,
        predict: (id: string) => `${HTTP_API_PREFIX}/staff-profiles/dashboard/predict/${enc(id)}`,
        calendar: () => `${HTTP_API_PREFIX}/staff-profiles/dashboard/calendar`,
    },

    chat: {
        connect: () => `${HTTP_API_PREFIX}/chat/connect`,
        conversations: (role?: string, bankName?: string) =>
            `${HTTP_API_PREFIX}/chat/conversations${httpApiQuery({ role, bankName })}`,
        singleConversation: (id: string) =>
            `${HTTP_API_PREFIX}/chat/conversations/single/${enc(id)}`,
        saveName: (id: string) =>
            `${HTTP_API_PREFIX}/chat/conversations/${enc(id)}/save-name`,
        messages: (conversationId: string) =>
            `${HTTP_API_PREFIX}/chat/messages/${enc(conversationId)}`,
        staffStart: () => `${HTTP_API_PREFIX}/chat/staff-start`,
        bankStart: () => `${HTTP_API_PREFIX}/chat/bank-start`,
        agentStaffStart: () => `${HTTP_API_PREFIX}/chat/agent-staff-start`,
    },

    admin: {
        blogsStats: () => `${HTTP_API_PREFIX}/blogs/admin/stats`,
        applicationsStats: () => `${HTTP_API_PREFIX}/applications/admin/stats`,
        blogsAll: (params?: Record<string, string>) => {
            const query = params ? "?" + new URLSearchParams(params).toString() : "";
            return `${HTTP_API_PREFIX}/blogs/admin/all${query}`;
        },
        blogsBulkStatus: () => `${HTTP_API_PREFIX}/blogs/admin/bulk-status`,
        blogById: (id: string) => `${HTTP_API_PREFIX}/blogs/${enc(id)}`,
        blogsCreate: () => `${HTTP_API_PREFIX}/blogs`,
        usersStats: () => `${HTTP_API_PREFIX}/users/admin/stats`,
        usersList: (limit: number, offset: number, search?: string, role?: string) =>
            `${HTTP_API_PREFIX}/users/admin/list${httpApiQuery({
                limit,
                offset,
                search: search || undefined,
                role: role || undefined,
            })}`,
        makeAdmin: () => `${HTTP_API_PREFIX}/users/make-admin`,
        userByAdminId: (id: string) => `${HTTP_API_PREFIX}/users/admin/${enc(id)}`,
        applicationsAll: (params?: Record<string, string>) => {
            const query = params ? "?" + new URLSearchParams(params).toString() : "";
            return `${HTTP_API_PREFIX}/applications/admin/all${query}`;
        },
        applicationById: (id: string) => `${HTTP_API_PREFIX}/applications/${enc(id)}`,
        applicationDisbursementReceipt: (id: string) => `${HTTP_API_PREFIX}/applications/${enc(id)}/disbursement-receipt`,
        applicationTracking: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/tracking`,
        applicationDocuments: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/documents`,
        applicationStatus: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/status`,
        applicationUpdate: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}`,
        applicationAiReview: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/ai-review`,
        applicationDelete: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}`,
        applicationShare: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/share`,
        applicationSyncVault: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/sync-vault`,
        communityStats: () => `${HTTP_API_PREFIX}/community/admin/stats`,
        forumPostsAdmin: (limit: number, offset: number) =>
            `${HTTP_API_PREFIX}/community/admin/forum/posts${httpApiQuery({ limit, offset })}`,
        mentors: () => `${HTTP_API_PREFIX}/community/mentors`,
        mentorsAdminCreate: () => `${HTTP_API_PREFIX}/community/admin/mentors`,
        mentorAdminDelete: (id: string) => `${HTTP_API_PREFIX}/community/admin/mentors/${enc(id)}`,
        communityResources: (params?: Record<string, string>) => {
            const query = params ? "?" + new URLSearchParams(params).toString() : "";
            return `${HTTP_API_PREFIX}/community/resources${query}`;
        },
        communityResourcesAdminCreate: () => `${HTTP_API_PREFIX}/community/admin/resources`,
        communityResourceAdminDelete: (id: string) =>
            `${HTTP_API_PREFIX}/community/admin/resources/${enc(id)}`,
        forumPostPin: (id: string) => `${HTTP_API_PREFIX}/community/admin/forum/posts/${enc(id)}/pin`,
        forumPostDelete: (id: string) => `${HTTP_API_PREFIX}/community/forum/${enc(id)}`,
        matrixLogs: (limit: number) =>
            `${HTTP_API_PREFIX}/blogs/admin/matrix-logs${httpApiQuery({ limit })}`,
        sendEmail: () => `${HTTP_API_PREFIX}/users/admin/send-email`,
        usersCreate: () => `${HTTP_API_PREFIX}/users/admin/create`,
        usersUpdateDetails: () => `${HTTP_API_PREFIX}/users/admin/update-details`,
        usersUpdateStatus: () => `${HTTP_API_PREFIX}/users/admin/update-status`,
        usersProfile: () => `${HTTP_API_PREFIX}/users/profile`,
        applicationNotes: (id: string) => `${HTTP_API_PREFIX}/applications/admin/${enc(id)}/notes`,
        documentVerify: (documentId: string) =>
            `${HTTP_API_PREFIX}/applications/admin/documents/${enc(documentId)}/verify`,
        applicationDocumentView: (applicationId: string, documentId: string) =>
            `${HTTP_API_PREFIX}/applications/admin/${enc(applicationId)}/documents/${enc(documentId)}/view`,
    },

    bank: {
        incomingFiles: (limit?: number, offset?: number) => `${HTTP_API_PREFIX}/bank/incoming-files${httpApiQuery({ limit, offset })}`,
        logFile: (id: string) => `${HTTP_API_PREFIX}/bank/files/${enc(id)}/log`,
        documents: (applicationId: string) => `${HTTP_API_PREFIX}/bank/documents/${enc(applicationId)}`,
        documentsZip: (applicationId: string) => `${HTTP_API_PREFIX}/bank/documents/${enc(applicationId)}/zip`,
        decisions: () => `${HTTP_API_PREFIX}/bank/decisions`,
        queries: () => `${HTTP_API_PREFIX}/bank/queries`,
        confirmDisbursement: () => `${HTTP_API_PREFIX}/bank/disbursements/confirm`,
        conditionalSanctions: () => `${HTTP_API_PREFIX}/bank/conditional-sanctions`,
        saveConditionalSanctions: (id: string) => `${HTTP_API_PREFIX}/bank/conditional-sanctions/${enc(id)}`,
        partialSanctions: () => `${HTTP_API_PREFIX}/bank/partial-sanctions`,
        counterOffers: () => `${HTTP_API_PREFIX}/bank/counter-offers`,
        fileQualityScore: () => `${HTTP_API_PREFIX}/bank/file-quality-score`,
        analyticsChannel: () => `${HTTP_API_PREFIX}/bank/analytics/channel`,
        analyticsRejections: () => `${HTTP_API_PREFIX}/bank/analytics/rejections`,
        slaTracker: () => `${HTTP_API_PREFIX}/bank/sla-tracker`,
        loanProducts: () => `${HTTP_API_PREFIX}/bank/config/loan-products`,
        updateLoanProduct: (id: string) => `${HTTP_API_PREFIX}/bank/config/loan-products/${enc(id)}`,
        branches: () => `${HTTP_API_PREFIX}/bank/config/branches`,
        officers: () => `${HTTP_API_PREFIX}/bank/config/officers`,
        fileDetail: (id: string) => `${HTTP_API_PREFIX}/bank/applications/${enc(id)}/detail`,
        lookupByLan: (lan: string) => `${HTTP_API_PREFIX}/bank/lookup/${enc(lan)}`,
        myFiles: (filters?: any) => `${HTTP_API_PREFIX}/bank/my-files${httpApiQuery(filters || {})}`,
        amendDecision: (decisionId: string) => `${HTTP_API_PREFIX}/bank/decisions/${enc(decisionId)}`,
        sanctionLetter: (id: string) => `${HTTP_API_PREFIX}/bank/applications/${enc(id)}/sanction-letter`,
        roi: (id: string) => `${HTTP_API_PREFIX}/bank/applications/${enc(id)}/roi`,
        fee: (id: string) => `${HTTP_API_PREFIX}/bank/applications/${enc(id)}/fee`,
        queryThread: (queryId: string) => `${HTTP_API_PREFIX}/bank/queries/${enc(queryId)}`,
        resolveQuery: (queryId: string) => `${HTTP_API_PREFIX}/bank/queries/${enc(queryId)}/resolve`,
        analyticsMetrics: () => `${HTTP_API_PREFIX}/bank/analytics/metrics`,
        exportCsv: () => `${HTTP_API_PREFIX}/bank/export/csv`,
        exportMis: () => `${HTTP_API_PREFIX}/bank/export/mis`,
        consent: (applicationId: string) => `${HTTP_API_PREFIX}/bank/applications/${enc(applicationId)}/consent`,
    },

    support: {
        root: () => `${HTTP_API_PREFIX}/support`,
        tickets: () => `${HTTP_API_PREFIX}/support/tickets`,
        myTickets: () => `${HTTP_API_PREFIX}/support/my-tickets`,
        ticketById: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}`,
        status: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}/status`,
        priority: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}/priority`,
        assign: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}/assign`,
        comment: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}/comment`,
        attachment: (id: string) => `${HTTP_API_PREFIX}/support/tickets/${enc(id)}/attachment`,
        dashboard: () => `${HTTP_API_PREFIX}/support/dashboard`,
    },
} as const;

/** Metadata for tooling / docs — paths resolved via HttpApiPaths (sample params where needed). */
export const staffDashboardApiCatalog = [
    { key: "staffProfiles.logActivity", method: "POST" as const, resolve: () => HttpApiPaths.staffProfiles.activities() },
    { key: "staffProfiles.getDashboardActivities", method: "GET" as const, resolve: () => HttpApiPaths.staffProfiles.dashboardActivities(15) },
    { key: "staffProfiles.getAllDashboardActivities", method: "GET" as const, resolve: () => HttpApiPaths.staffProfiles.activitiesAll({}) },
    { key: "reference.countries", method: "GET" as const, resolve: () => HttpApiPaths.reference.countries() },
    { key: "admin.getUsers", method: "GET" as const, resolve: () => HttpApiPaths.admin.usersList(30, 0) },
    { key: "admin.getBlogStats", method: "GET" as const, resolve: () => HttpApiPaths.admin.blogsStats() },
    { key: "admin.getApplicationStats", method: "GET" as const, resolve: () => HttpApiPaths.admin.applicationsStats() },
    { key: "admin.getBlogs", method: "GET" as const, resolve: () => HttpApiPaths.admin.blogsAll({ limit: "100" }) },
    { key: "admin.getApplications", method: "GET" as const, resolve: () => HttpApiPaths.admin.applicationsAll({}) },
    { key: "admin.getForumPosts", method: "GET" as const, resolve: () => HttpApiPaths.admin.forumPostsAdmin(50, 0) },
    { key: "admin.getUserStats", method: "GET" as const, resolve: () => HttpApiPaths.admin.usersStats() },
    { key: "admin.updateApplicationStatus", method: "PUT" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/status` },
    { key: "admin.sendEmail", method: "POST" as const, resolve: () => HttpApiPaths.admin.sendEmail() },
    { key: "admin.getUserProfile", method: "POST" as const, resolve: () => HttpApiPaths.admin.usersProfile() },
    { key: "admin.createUser", method: "POST" as const, resolve: () => HttpApiPaths.admin.usersCreate() },
    { key: "admin.deleteUser", method: "DELETE" as const, resolve: () => `${HTTP_API_PREFIX}/users/admin/:id` },
    { key: "admin.deleteBlog", method: "DELETE" as const, resolve: () => `${HTTP_API_PREFIX}/blogs/:id` },
    { key: "admin.bulkUpdateBlogStatus", method: "POST" as const, resolve: () => HttpApiPaths.admin.blogsBulkStatus() },
    { key: "admin.deleteForumPost", method: "DELETE" as const, resolve: () => `${HTTP_API_PREFIX}/community/forum/:id` },
    { key: "admin.deleteApplication", method: "DELETE" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id` },
    { key: "staffProfiles.checkExists", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/check/:userId` },
    { key: "staffProfiles.create", method: "POST" as const, resolve: () => HttpApiPaths.staffProfiles.root() },
    { key: "staffProfiles.shareProfile", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/share-profile/:studentId` },
    { key: "onboarding.submit", method: "POST" as const, resolve: () => HttpApiPaths.onboarding.root() },
    { key: "onboarding.share", method: "POST" as const, resolve: () => HttpApiPaths.onboarding.share() },
    { key: "documents.listByUser", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:userId` },
    { key: "documents.addRequirement", method: "POST" as const, resolve: () => HttpApiPaths.documents.requirement() },
    { key: "documents.upload", method: "POST" as const, resolve: () => HttpApiPaths.documents.upload() },
    { key: "documents.delete", method: "DELETE" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:userId/:docType` },
    { key: "documents.ocrReverify", method: "POST" as const, resolve: () => HttpApiPaths.documents.ocrReverify() },
    { key: "documents.presignedView", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/presigned-view/:userId/:docType` },
    { key: "documents.digilockerInitiate", method: "POST" as const, resolve: () => HttpApiPaths.documents.digilockerInitiate() },
    { key: "auth.uploadDocument", method: "POST" as const, resolve: () => HttpApiPaths.auth.uploadDocument() },
    { key: "chat.conversations", method: "GET" as const, resolve: () => HttpApiPaths.chat.conversations("staff") },
    { key: "chat.messages", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/chat/messages/:conversationId` },
    { key: "chat.staffStart", method: "POST" as const, resolve: () => HttpApiPaths.chat.staffStart() },
    { key: "pullModal.usersList", method: "GET" as const, resolve: () => HttpApiPaths.admin.usersList(20, 0) },
    { key: "pullModal.staffProfiles.list", method: "GET" as const, resolve: () => HttpApiPaths.staffProfiles.list({}) },
    { key: "applicationDetail.documents", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:userId` },
    { key: "kyc.updateProfile", method: "POST" as const, resolve: () => HttpApiPaths.onboarding.root() },

    // --- Added / Auth Group ---
    { key: "auth.sendOtp", method: "POST" as const, resolve: () => HttpApiPaths.auth.sendOtp() },
    { key: "auth.verifyOtp", method: "POST" as const, resolve: () => HttpApiPaths.auth.verifyOtp() },
    { key: "auth.firebase", method: "POST" as const, resolve: () => HttpApiPaths.auth.firebase() },
    { key: "auth.refresh", method: "POST" as const, resolve: () => HttpApiPaths.auth.refresh() },
    { key: "auth.logout", method: "POST" as const, resolve: () => HttpApiPaths.auth.logout() },
    { key: "auth.dashboard", method: "POST" as const, resolve: () => HttpApiPaths.auth.dashboard() },
    { key: "auth.dashboardData", method: "POST" as const, resolve: () => HttpApiPaths.auth.dashboardData() },
    { key: "auth.updateDetails", method: "POST" as const, resolve: () => HttpApiPaths.auth.updateDetails() },
    { key: "auth.createApplication", method: "POST" as const, resolve: () => HttpApiPaths.auth.createApplication() },
    { key: "auth.applicationById", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/auth/application/:id` },

    // --- Added / Reference Group ---
    { key: "reference.banks", method: "GET" as const, resolve: () => HttpApiPaths.reference.banks() },
    { key: "reference.universities", method: "GET" as const, resolve: () => HttpApiPaths.reference.universities() },

    // --- Added / Onboarding Group ---
    { key: "onboarding.status", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/onboarding/status/:userId` },

    // --- Added / Documents Group ---
    { key: "documents.byUserId", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:userId` },
    { key: "documents.byUserIdAndDocType", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:userId/:docType` },
    { key: "documents.digilockerAuthorizeRedirect", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/digilocker/authorize` },
    { key: "documents.digilockerSync", method: "POST" as const, resolve: () => HttpApiPaths.documents.digilockerSync() },
    { key: "documents.streamView", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/view/:userId/:docType` },
    { key: "documents.presignedUrl", method: "POST" as const, resolve: () => HttpApiPaths.documents.presignedUrl() },
    { key: "documents.completeUpload", method: "POST" as const, resolve: () => HttpApiPaths.documents.completeUpload() },
    { key: "documents.userDocumentsLegacy", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/user/:userId` },
    { key: "documents.byDocId", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:docId` },
    { key: "documents.download", method: "GET" as const, resolve: () => HttpApiPaths.documents.download() },
    { key: "documents.verifyByDocId", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/documents/:docId/verify` },

    // --- Added / Staff Profiles Group ---
    { key: "staffProfiles.byId", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId` },
    { key: "staffProfiles.fetchDocuments", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/fetch-documents` },
    { key: "staffProfiles.documents", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/documents` },
    { key: "staffProfiles.documentStatus", method: "PUT" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/documents/:docId/status` },
    { key: "staffProfiles.documentById", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/documents/:docId` },
    { key: "staffProfiles.share", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/share` },
    { key: "staffProfiles.shares", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/staff-profiles/:profileId/shares` },

    // --- Added / Chat Group ---
    { key: "chat.connect", method: "GET" as const, resolve: () => HttpApiPaths.chat.connect() },

    // --- Added / Admin Group ---
    { key: "admin.makeAdmin", method: "POST" as const, resolve: () => HttpApiPaths.admin.makeAdmin() },
    { key: "admin.blogById", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/blogs/:id` },
    { key: "admin.blogsCreate", method: "POST" as const, resolve: () => HttpApiPaths.admin.blogsCreate() },
    { key: "admin.userByAdminId", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/users/admin/:id` },
    { key: "admin.applicationById", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/applications/:id` },
    { key: "admin.applicationTracking", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/tracking` },
    { key: "admin.applicationDocuments", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/documents` },
    { key: "admin.applicationUpdate", method: "PUT" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id` },
    { key: "admin.applicationAiReview", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/ai-review` },
    { key: "admin.applicationShare", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/share` },
    { key: "admin.applicationSyncVault", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/sync-vault` },
    { key: "admin.applicationNotes", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/applications/admin/:id/notes` },

    // --- Added / Bank Group ---
    { key: "bank.incomingFiles", method: "GET" as const, resolve: () => HttpApiPaths.bank.incomingFiles() },
    { key: "bank.logFile", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/files/:id/log` },
    { key: "bank.documents", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/documents/:applicationId` },
    { key: "bank.documentsZip", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/documents/:applicationId/zip` },
    { key: "bank.decisions", method: "POST" as const, resolve: () => HttpApiPaths.bank.decisions() },
    { key: "bank.queries", method: "POST" as const, resolve: () => HttpApiPaths.bank.queries() },
    { key: "bank.confirmDisbursement", method: "POST" as const, resolve: () => HttpApiPaths.bank.confirmDisbursement() },
    { key: "bank.conditionalSanctions", method: "GET" as const, resolve: () => HttpApiPaths.bank.conditionalSanctions() },
    { key: "bank.partialSanctions", method: "GET" as const, resolve: () => HttpApiPaths.bank.partialSanctions() },
    { key: "bank.counterOffers", method: "GET" as const, resolve: () => HttpApiPaths.bank.counterOffers() },
    { key: "bank.fileQualityScore", method: "GET" as const, resolve: () => HttpApiPaths.bank.fileQualityScore() },
    { key: "bank.analyticsChannel", method: "GET" as const, resolve: () => HttpApiPaths.bank.analyticsChannel() },
    { key: "bank.analyticsRejections", method: "GET" as const, resolve: () => HttpApiPaths.bank.analyticsRejections() },
    { key: "bank.slaTracker", method: "GET" as const, resolve: () => HttpApiPaths.bank.slaTracker() },
    { key: "bank.loanProducts", method: "GET" as const, resolve: () => HttpApiPaths.bank.loanProducts() },
    { key: "bank.updateLoanProduct", method: "PUT" as const, resolve: () => `${HTTP_API_PREFIX}/bank/config/loan-products/:id` },
    { key: "bank.branches", method: "GET" as const, resolve: () => HttpApiPaths.bank.branches() },
    { key: "bank.officers", method: "GET" as const, resolve: () => HttpApiPaths.bank.officers() },
    { key: "bank.fileDetail", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/applications/:id/detail` },
    { key: "bank.lookupByLan", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/lookup/:lan` },
    { key: "bank.myFiles", method: "GET" as const, resolve: () => HttpApiPaths.bank.myFiles() },
    { key: "bank.amendDecision", method: "PUT" as const, resolve: () => `${HTTP_API_PREFIX}/bank/decisions/:decisionId` },
    { key: "bank.sanctionLetter", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/applications/:id/sanction-letter` },
    { key: "bank.roi", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/applications/:id/roi` },
    { key: "bank.fee", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/applications/:id/fee` },
    { key: "bank.queryThread", method: "GET" as const, resolve: () => `${HTTP_API_PREFIX}/bank/queries/:queryId` },
    { key: "bank.resolveQuery", method: "POST" as const, resolve: () => `${HTTP_API_PREFIX}/bank/queries/:queryId/resolve` },
    { key: "bank.analyticsMetrics", method: "GET" as const, resolve: () => HttpApiPaths.bank.analyticsMetrics() },
    { key: "bank.exportCsv", method: "GET" as const, resolve: () => HttpApiPaths.bank.exportCsv() },
    { key: "bank.exportMis", method: "GET" as const, resolve: () => HttpApiPaths.bank.exportMis() },
] as const;
