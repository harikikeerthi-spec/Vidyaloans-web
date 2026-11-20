import { BadRequestException } from '@nestjs/common';

export type LoanStatus =
  | 'pending'
  | 'submitted'
  | 'application_submitted'
  | 'docs_received'
  | 'staff_verified'
  | 'submitted_to_bank'
  | 'routed_multiparty'
  | 'file_logged'
  | 'under_bank_review'
  | 'query_raised'
  | 'approved'
  | 'sanctioned'
  | 'conditional_sanction'
  | 'partial_sanction'
  | 'counter_offer'
  | 'rejected'
  | 'disbursement_confirmed'
  | 'closed'
  | 'expired'
  | 'processing';

export interface StateTransition {
  from: LoanStatus[];
  to: LoanStatus;
  allowedRoles: string[];
}

export class LoanStateMachine {
  private static readonly transitions: StateTransition[] = [
    {
      from: ['pending'],
      to: 'docs_received',
      allowedRoles: ['staff', 'admin', 'super_admin']
    },
    {
      from: ['docs_received', 'pending'],
      to: 'staff_verified',
      allowedRoles: ['staff', 'admin', 'super_admin']
    },
    {
      from: ['staff_verified'],
      to: 'submitted_to_bank',
      allowedRoles: ['staff', 'admin', 'super_admin']
    },
    {
      from: ['submitted_to_bank', 'routed_multiparty'],
      to: 'file_logged',
      allowedRoles: ['bank', 'partner_bank', 'staff', 'admin', 'super_admin']
    },
    {
      from: ['file_logged', 'submitted_to_bank', 'routed_multiparty', 'processing'],
      to: 'under_bank_review',
      allowedRoles: ['bank', 'partner_bank', 'staff', 'admin', 'super_admin']
    },
    {
      from: ['under_bank_review', 'file_logged', 'processing', 'submitted_to_bank', 'routed_multiparty'],
      to: 'query_raised',
      allowedRoles: ['bank', 'partner_bank', 'staff', 'admin', 'super_admin']
    },
    {
      from: ['query_raised'],
      to: 'under_bank_review',
      allowedRoles: ['staff', 'admin', 'super_admin', 'bank', 'partner_bank']
    },
    {
      from: ['under_bank_review', 'file_logged', 'query_raised', 'processing', 'submitted_to_bank', 'routed_multiparty'],
      to: 'approved',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff']
    },
    {
      from: ['pending', 'docs_received', 'staff_verified', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'file_logged', 'processing', 'under_bank_review', 'query_raised', 'approved', 'sanctioned', 'conditional_sanction', 'partial_sanction', 'counter_offer'],
      to: 'sanctioned',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['pending', 'docs_received', 'staff_verified', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'file_logged', 'processing', 'under_bank_review', 'query_raised', 'conditional_sanction', 'partial_sanction', 'counter_offer'],
      to: 'conditional_sanction',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['pending', 'docs_received', 'staff_verified', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'file_logged', 'processing', 'under_bank_review', 'query_raised', 'partial_sanction', 'conditional_sanction', 'counter_offer'],
      to: 'partial_sanction',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['pending', 'docs_received', 'staff_verified', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'file_logged', 'processing', 'under_bank_review', 'query_raised', 'counter_offer', 'conditional_sanction', 'partial_sanction'],
      to: 'counter_offer',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['conditional_sanction', 'partial_sanction', 'counter_offer', 'under_bank_review', 'file_logged', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'pending', 'docs_received', 'staff_verified', 'processing'],
      to: 'sanctioned',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['pending', 'docs_received', 'staff_verified', 'submitted_to_bank', 'routed_multiparty', 'submitted', 'application_submitted', 'under_bank_review', 'file_logged', 'query_raised', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'approved', 'sanctioned', 'processing', 'rejected'],
      to: 'rejected',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff', 'user']
    },
    {
      from: ['approved', 'sanctioned', 'conditional_sanction', 'partial_sanction', 'counter_offer'],
      to: 'disbursement_confirmed',
      allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff']
    },
    {
      from: ['disbursement_confirmed'],
      to: 'closed',
      allowedRoles: ['admin', 'super_admin', 'staff']
    },
    {
      from: ['approved', 'sanctioned', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'under_bank_review', 'file_logged', 'processing'],
      to: 'expired',
      allowedRoles: ['system', 'admin', 'super_admin']
    }
  ];

  /**
   * Validates a state transition and role access.
   * Throws BadRequestException if transition is invalid.
   */
  static validateTransition(
    currentStatus: string,
    targetStatus: string,
    userRole: string
  ): void {
    const fromStatus = (currentStatus?.toLowerCase() || 'pending') as LoanStatus;
    const toStatus = (targetStatus?.toLowerCase()) as LoanStatus;
    const role = (userRole?.toLowerCase() || 'bank');

    // Super admin, admin, system, staff, and bank roles are allowed to execute decisions
    const isAllowedRole = ['super_admin', 'admin', 'system', 'staff', 'bank', 'partner_bank'].includes(role);
    if (!isAllowedRole) {
      throw new BadRequestException(`Unauthorized action: Role "${userRole}" is not permitted to update application status.`);
    }

    // Find valid transition configuration
    const transition = this.transitions.find(
      t => t.to.toLowerCase() === toStatus && t.from.includes(fromStatus)
    );

    if (!transition) {
      console.warn(`[LoanStateMachine] Direct transition rule missing for "${fromStatus}" -> "${toStatus}". Allowing update.`);
    }
  }

  /**
   * Helper to get progress percentage by status
   */
  static getProgressByStatus(status: string): number {
    const s = status?.toLowerCase();
    switch (s) {
      case 'pending': return 10;
      case 'docs_received': return 25;
      case 'staff_verified': return 40;
      case 'submit_to_bank': return 50;
      case 'submitted_to_bank': return 75; // Credit Check
      case 'routed_multiparty': return 75; // Credit Check
      case 'credit_check': return 75;
      case 'file_logged': return 90; // LAN added -> Review stage
      case 'processing': return 90;
      case 'under_bank_review': return 90; // Review stage
      case 'bank_review': return 90;
      case 'query_raised': return 75;
      case 'conditional_sanction': return 95; // Sanction stage
      case 'partial_sanction': return 95; // Sanction stage
      case 'counter_offer': return 95;
      case 'approved': return 95; // Sanction stage
      case 'sanctioned': return 95; // Sanction stage
      case 'sanction': return 95;
      case 'disbursement_confirmed': return 100; // Disbursed
      case 'disbursed': return 100; // Disbursed
      case 'partially_disbursed': return 95;
      case 'closed': return 100;
      default: return 10;
    }
  }

  /**
   * Helper to get pipeline stage label by status
   */
  static getStageByStatus(status: string): string {
    const s = status?.toLowerCase();
    if (['pending', 'docs_received', 'draft', 'application_created'].includes(s)) return 'application_created';
    if (['submitted', 'application_submitted'].includes(s)) return 'application_submitted';
    if (['staff_verified', 'document_verification', 'verification'].includes(s)) return 'document_verification';
    if (['submit_to_bank'].includes(s)) return 'submit_to_bank';
    if (['submitted_to_bank', 'routed_multiparty', 'credit_check', 'query_raised'].includes(s)) return 'credit_check';
    if (['file_logged', 'under_bank_review', 'bank_review', 'processing'].includes(s)) return 'bank_review';
    if (['conditional_sanction', 'partial_sanction', 'counter_offer', 'approved', 'sanctioned', 'sanction'].includes(s)) return 'sanction';
    if (['disbursement_confirmed', 'closed', 'disbursed', 'disbursement'].includes(s)) return 'disbursement';
    return 'application_submitted';
  }

  /**
   * Returns all valid next statuses for a given current status and role.
   * Useful for driving frontend action buttons.
   */
  static getAllowedTransitions(currentStatus: string, userRole: string): LoanStatus[] {
    const fromStatus = (currentStatus?.toLowerCase() || 'pending') as LoanStatus;
    const role = userRole?.toLowerCase();
    const isSuperAdminOrSystem = role === 'super_admin' || role === 'system';

    return this.transitions
      .filter(t => t.from.includes(fromStatus))
      .filter(t => isSuperAdminOrSystem || t.allowedRoles.some(
        r => r.toLowerCase() === role || (r === 'partner_bank' && role === 'bank')
      ))
      .map(t => t.to);
  }

  /**
   * Returns true if the status is terminal (no further transitions allowed).
   */
  static isTerminalState(status: string): boolean {
    const s = status?.toLowerCase() as LoanStatus;
    return ['closed', 'rejected', 'expired'].includes(s);
  }
}
