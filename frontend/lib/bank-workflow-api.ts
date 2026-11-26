import axios from 'axios';
import { getToken } from './api';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_API_URL || '';
};

const instance = axios.create({
  baseURL: `${getBaseUrl()}/api/bank/workflow`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export class BankWorkflowAPI {
  private static instance = instance;

  /**
   * Submit application to bank
   */
  static async submitToBank(data: {
    applicationId: string;
    bankId: string;
    bankName: string;
    submittedBy: string;
  }) {
    const response = await this.instance.post('/submit', data);
    return response.data;
  }

  /**
   * Log file with LAN number
   */
  static async logFile(
    submissionId: string,
    data: {
      lanNumber: string;
      loggedBy: string;
      notes?: string;
    },
  ) {
    const response = await this.instance.post(`/${submissionId}/log-file`, data);
    return response.data;
  }

  /**
   * Move to under review
   */
  static async moveToUnderReview(
    submissionId: string,
    data: {
      changedBy: string;
      notes?: string;
    },
  ) {
    const response = await this.instance.post(`/${submissionId}/under-review`, data);
    return response.data;
  }

  /**
   * Record bank decision
   */
  static async recordDecision(data: {
    submissionId: string;
    decision: 'sanctioned' | 'rejected' | 'query_raised';
    changedBy: string;
    sanctionAmount?: number;
    interestRate?: number;
    rejectionReason?: string;
    queryNotes?: string;
  }) {
    const response = await this.instance.post('/decision', data);
    return response.data;
  }

  /**
   * Get timeline for a submission
   */
  static async getTimeline(submissionId: string) {
    const response = await this.instance.get(`/${submissionId}/timeline`);
    return response.data;
  }

  /**
   * Get active submissions for application
   */
  static async getSubmissionsByApplication(applicationId: string) {
    const response = await this.instance.get(`/application/${applicationId}`);
    return response.data;
  }

  /**
   * Bulk submit to bank
   */
  static async bulkSubmit(data: {
    applicationIds: string[];
    bankId: string;
    bankName: string;
    submittedBy: string;
  }) {
    const response = await this.instance.post('/bulk-submit', data);
    return response.data;
  }
}
