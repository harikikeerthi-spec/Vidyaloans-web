import { getCsrfToken, initializeCsrf, getToken } from "./api";

/**
 * Bank Dashboard API Client
 * Handles all API interactions for the dynamic bank dashboard
 */

const API_BASE = typeof window !== 'undefined'
  ? ""
  : (process.env.NEXT_PUBLIC_API_URL || "");

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
}

class BankDashboardAPI {
  private baseURL: string;
  private bankId: string;

  constructor(bankId: string) {
    this.baseURL = `${API_BASE}/api/bank/dashboard`;
    this.bankId = bankId;
  }

  private async getHeaders(method: string = "GET"): Promise<Record<string, string>> {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-bank-id": this.bankId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      let csrfToken = getCsrfToken();
      if (!csrfToken) {
        csrfToken = await initializeCsrf();
      }
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    return headers;
  }

  private async request(endpoint: string, options: RequestOptions = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = (options.method || "GET").toUpperCase();
    const headers = await this.getHeaders(method);

    const response = await fetch(url, {
      method,
      headers: { ...headers, ...options.headers },
      credentials: "include",
      ...(options.body && { body: JSON.stringify(options.body) }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // ==================== PRODUCTS ====================

  async getProducts() {
    return this.request("/products");
  }

  async addProduct(productData: any) {
    return this.request("/products", {
      method: "POST",
      body: productData,
    });
  }

  async updateProduct(productId: string, productData: any) {
    return this.request(`/products/${productId}`, {
      method: "PUT",
      body: productData,
    });
  }

  // ==================== BRANCHES ====================

  async getBranches() {
    return this.request("/branches");
  }

  async addBranch(branchData: any) {
    return this.request("/branches", {
      method: "POST",
      body: branchData,
    });
  }

  // ==================== FILE LOGGING ====================

  async logFile(applicationId: string, lanNumber: string) {
    return this.request(`/files/${applicationId}/log`, {
      method: "POST",
      body: { lanNumber },
    });
  }

  async getFileByLAN(lanNumber: string) {
    return this.request(`/files/by-lan/${lanNumber}`);
  }

  // ==================== ROI & PROCESSING FEES ====================

  async setROI(
    applicationId: string,
    roiData: {
      roiType: "FIXED" | "FLOATING";
      roiBase: number;
      roiEffective: number;
      roiSubsidy?: number;
    }
  ) {
    return this.request(`/applications/${applicationId}/roi`, {
      method: "PUT",
      body: roiData,
    });
  }

  async setProcessingFee(applicationId: string, feeAmount: number, lanNumber?: string) {
    return this.request(`/applications/${applicationId}/processing-fee`, {
      method: "POST",
      body: { feeAmount, lanNumber },
    });
  }

  async updateProcessingFeeStatus(
    applicationId: string,
    status: "PAID" | "WAIVED" | "PENDING" | "REFUNDED",
    details: any
  ) {
    return this.request(`/applications/${applicationId}/processing-fee`, {
      method: "PUT",
      body: { status, details },
    });
  }

  // ==================== QUERIES ====================

  async raiseQuery(
    applicationId: string,
    queryData: {
      queryType: string;
      description: string;
      requiredDocs?: string[];
    }
  ) {
    return this.request(`/applications/${applicationId}/query`, {
      method: "POST",
      body: queryData,
    });
  }

  async getQueries(applicationId?: string) {
    const params = applicationId ? `?applicationId=${applicationId}` : "";
    return this.request(`/queries${params}`);
  }

  async respondToQuery(
    queryId: string,
    response: {
      message: string;
      attachments?: any[];
    }
  ) {
    return this.request(`/queries/${queryId}/response`, {
      method: "POST",
      body: response,
    });
  }

  async resolveQuery(queryId: string) {
    return this.request(`/queries/${queryId}/resolve`, {
      method: "PUT",
    });
  }

  // ==================== DISBURSEMENTS ====================

  async confirmDisbursement(
    applicationId: string,
    disbursementData: {
      amount: number;
      mode: "NEFT" | "RTGS" | "DD";
      utrNumber: string;
      beneficiary: string;
      trancheNumber?: number;
    }
  ) {
    return this.request(`/applications/${applicationId}/disbursement`, {
      method: "POST",
      body: disbursementData,
    });
  }

  async getDisbursements(applicationId: string) {
    return this.request(`/applications/${applicationId}/disbursements`);
  }

  async getAllDisbursements() {
    return this.request("/disbursements");
  }

  // ==================== QUALITY RATING ====================

  async rateFileQuality(
    applicationId: string,
    ratingData: {
      completeness: number; // 1-5
      accuracy: number; // 1-5
      clarity: number; // 1-5
      comments?: string;
    }
  ) {
    return this.request(`/applications/${applicationId}/quality-rating`, {
      method: "POST",
      body: ratingData,
    });
  }

  // ==================== ANALYTICS ====================

  async getChannelAnalytics() {
    return this.request("/analytics/channel");
  }

  async getRejectionAnalytics() {
    return this.request("/analytics/rejections");
  }

  async getPipelineAnalytics() {
    return this.request("/analytics/pipeline");
  }

  async getAgingAnalytics() {
    return this.request("/analytics/aging");
  }

  async getSLAAnalytics() {
    return this.request("/analytics/sla");
  }

  // ==================== AUDIT LOGS ====================

  async getAuditLogs(applicationId: string) {
    return this.request(`/applications/${applicationId}/audit-logs`);
  }
}

// Export singleton instances for each bank or use as needed
export { BankDashboardAPI };

// Helper to create client with bank context
export const createBankDashboardClient = (bankId: string) => {
  return new BankDashboardAPI(bankId);
};
