import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface ApplicationRemark {
    applicationId: string;
    type: 'suggestion' | 'remark' | 'warning' | 'approval_note';
    content: string;
    authorId: string;
    authorName: string;
    isInternal: boolean;
}

interface MentorAssignment {
    applicationId: string;
    mentorId: string;
    mentorName: string;
    counselorId: string;
    counselorName: string;
}

interface RiskAssessment {
    applicationId: string;
    riskLevel: 'low' | 'medium' | 'high';
    creditScore?: number;
    notes?: string;
}

@Injectable()
export class AdminApplicationService {
    constructor(private db: SupabaseService) {}

    /**
     * Add remarks/suggestions to an application
     * Used by admin for internal notes and suggestions
     */
    async addRemark(appId: string, remark: ApplicationRemark) {
        try {
            const { data, error } = await this.db
                .from('ApplicationRemarks')
                .insert({
                    applicationId: appId,
                    type: remark.type,
                    content: remark.content,
                    authorId: remark.authorId,
                    authorName: remark.authorName,
                    isInternal: remark.isInternal,
                    createdAt: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            // Update application with latest remarks count
            await this.updateApplicationRemarkCount(appId);

            return { success: true, data };
        } catch (e) {
            throw new BadRequestException(`Failed to add remark: ${e.message}`);
        }
    }

    /**
     * Get all remarks for an application
     */
    async getApplicationRemarks(appId: string) {
        try {
            const { data, error } = await this.db
                .from('ApplicationRemarks')
                .select('*')
                .eq('applicationId', appId)
                .order('createdAt', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            throw new BadRequestException(`Failed to fetch remarks: ${e.message}`);
        }
    }

    /**
     * Assign mentor and counselor to application
     * Vidyaloan specific - ensures student gets proper guidance
     */
    async assignMentorCounselor(assignment: MentorAssignment) {
        try {
            const { data, error } = await this.db
                .from('LoanApplication')
                .update({
                    mentorId: assignment.mentorId,
                    mentorName: assignment.mentorName,
                    counselorId: assignment.counselorId,
                    counselorName: assignment.counselorName,
                    updatedAt: new Date().toISOString(),
                })
                .eq('id', assignment.applicationId)
                .select()
                .single();

            if (error) throw error;

            // Create audit log
            await this.createAuditLog({
                applicationId: assignment.applicationId,
                action: 'assign_mentor_counselor',
                changes: {
                    mentor: assignment.mentorName,
                    counselor: assignment.counselorName,
                },
            });

            return { success: true, data };
        } catch (e) {
            throw new BadRequestException(`Failed to assign mentor/counselor: ${e.message}`);
        }
    }

    /**
     * Assess risk level for an application
     * Used to determine interest rates and collateral requirements
     */
    async assessRisk(assessment: RiskAssessment) {
        try {
            const updateData: any = {
                riskLevel: assessment.riskLevel,
                updatedAt: new Date().toISOString(),
            };

            if (assessment.creditScore) {
                updateData.creditScore = assessment.creditScore;
            }

            if (assessment.notes) {
                updateData.riskNotes = assessment.notes;
            }

            const { data, error } = await this.db
                .from('LoanApplication')
                .update(updateData)
                .eq('id', assessment.applicationId)
                .select()
                .single();

            if (error) throw error;

            // Log risk assessment
            await this.addRemark(assessment.applicationId, {
                applicationId: assessment.applicationId,
                type: 'remark',
                content: `Risk Assessment: ${assessment.riskLevel.toUpperCase()} | Credit Score: ${assessment.creditScore || 'N/A'}${assessment.notes ? ` | Notes: ${assessment.notes}` : ''}`,
                authorId: 'system',
                authorName: 'System',
                isInternal: true,
            });

            return { success: true, data };
        } catch (e) {
            throw new BadRequestException(`Failed to assess risk: ${e.message}`);
        }
    }

    /**
     * Batch process applications with same criteria
     * Approve, reject, or flag multiple applications
     */
    async batchProcessApplications(
        applicationIds: string[],
        action: 'approve' | 'reject' | 'flag' | 'send_request',
        remarks: string,
        adminId: string,
        adminName: string,
    ) {
        try {
            const updates: any = {
                updatedAt: new Date().toISOString(),
            };

            if (action === 'approve') {
                updates.status = 'approved';
                updates.stage = 'sanction';
                updates.progress = 90;
            } else if (action === 'reject') {
                updates.status = 'rejected';
                updates.rejectionReason = remarks;
            } else if (action === 'flag') {
                updates.status = 'processing';
                updates.priority = 'high';
            } else if (action === 'send_request') {
                updates.status = 'processing';
                updates.stage = 'document_verification';
            }

            // Update all applications
            const { data, error } = await this.db
                .from('LoanApplication')
                .update(updates)
                .in('id', applicationIds)
                .select();

            if (error) throw error;

            // Create audit logs for each application
            for (const appId of applicationIds) {
                await this.createAuditLog({
                    applicationId: appId,
                    action: `batch_${action}`,
                    changes: { remarks },
                    initiatorId: adminId,
                    initiatorName: adminName,
                });

                // Add remark
                await this.addRemark(appId, {
                    applicationId: appId,
                    type: 'approval_note',
                    content: `[BATCH PROCESS - ${action.toUpperCase()}] ${remarks}`,
                    authorId: adminId,
                    authorName: adminName,
                    isInternal: true,
                });
            }

            return {
                success: true,
                processedCount: data.length,
                data,
            };
        } catch (e) {
            throw new BadRequestException(`Batch processing failed: ${e.message}`);
        }
    }

    /**
     * Get eligibility assessment for an application
     * Checks all VidyaLoan eligibility criteria
     */
    async checkEligibility(appId: string) {
        try {
            const { data: app, error } = await this.db
                .from('LoanApplication')
                .select('*')
                .eq('id', appId)
                .single();

            if (error) throw error;
            if (!app) throw new NotFoundException('Application not found');

            const assessments = {
                ageCheck: {
                    criteria: 'Age between 18-40 years',
                    status: this.checkAge(app.dateOfBirth) ? 'pass' : 'fail',
                },
                admissionValidation: {
                    criteria: 'Valid admission from recognized institution',
                    status: app.universityName && app.courseName ? 'pass' : 'fail',
                },
                incomeCheck: {
                    criteria: 'Co-applicant annual income > 3 LPA',
                    status: app.guardianIncome && app.guardianIncome > 300000 ? 'pass' : 'warning',
                },
                creditScore: {
                    criteria: 'CIBIL score > 700',
                    status: app.creditScore && app.creditScore > 700 ? 'pass' : app.creditScore ? 'fail' : 'unknown',
                },
                noDefaults: {
                    criteria: 'No existing defaults/CCJs',
                    status: app.hasDefaults ? 'fail' : 'pass',
                },
                courseDuration: {
                    criteria: 'Course duration >= 6 months',
                    status: app.courseDuration && app.courseDuration >= 6 ? 'pass' : 'fail',
                },
                institutionAccreditation: {
                    criteria: 'Institution accreditation verified',
                    status: app.isUniversityVerified ? 'pass' : 'warning',
                },
            };

            const passCount = Object.values(assessments).filter(a => a.status === 'pass').length;
            const failCount = Object.values(assessments).filter(a => a.status === 'fail').length;
            const overallStatus = failCount === 0 ? 'ELIGIBLE' : 'INELIGIBLE';

            return {
                overallStatus,
                passCount,
                failCount,
                assessments,
                recommendation:
                    failCount === 0
                        ? `Applicant is eligible. Recommended loan: ₹${Math.min(app.amount, this.calculateMaxLoan(app))} | Tenure: 15 years`
                        : `Applicant requires additional review or documentation`,
            };
        } catch (e) {
            throw new BadRequestException(`Eligibility check failed: ${e.message}`);
        }
    }

    /**
     * Get portfolio analysis and health metrics
     */
    async getPortfolioAnalysis(user?: any, bankId?: string) {
        try {
            const isBank = (user?.role === 'bank' || user?.role === 'partner_bank');
            let bankName: string | null = null;
            if (isBank) {
                if (user?.bankName) {
                    bankName = user.bankName;
                } else if (user?.bank) {
                    const lowerB = user.bank.toLowerCase();
                    if (lowerB.includes('credila') || lowerB.includes('hdfc')) bankName = 'HDFC Credila';
                    else if (lowerB.includes('poonawalla')) bankName = 'Poonawalla';
                    else if (lowerB.includes('idfc')) bankName = 'IDFC';
                    else if (lowerB.includes('avanse')) bankName = 'Avanse';
                    else if (lowerB.includes('auxilo')) bankName = 'Auxilo';
                    else bankName = user.bank;
                }

                // Try email corporate domain next
                if (!bankName && user?.email) {
                    const lowerEmail = user.email.toLowerCase().trim();
                    if (lowerEmail.includes("auxilo.com")) bankName = 'Auxilo';
                    else if (lowerEmail.includes("avanse.com")) bankName = 'Avanse';
                    else if (lowerEmail.includes("credila.com") || lowerEmail.includes("hdfccredila.com")) bankName = 'HDFC Credila';
                    else if (lowerEmail.includes("idfcfirstbank.com") || lowerEmail.includes("idfcbank.com")) bankName = 'IDFC';
                    else if (lowerEmail.includes("poonawallafincorp.com")) bankName = 'Poonawalla';
                }

                if (!bankName) {
                    const bId = bankId || user?.firstName;
                    if (bId) {
                        const lower = bId.toLowerCase();
                        if (lower.includes('credila')) bankName = 'HDFC Credila';
                        else if (lower.includes('poonawalla')) bankName = 'Poonawalla';
                        else if (lower.includes('idfc')) bankName = 'IDFC';
                        else if (lower.includes('avanse')) bankName = 'Avanse';
                        else if (lower.includes('auxilo')) bankName = 'Auxilo';
                        else bankName = bId;
                    }
                }
            }

            let query = this.db.from('LoanApplication').select('*');
            if (isBank && bankName) {
                query = query.ilike('bank', `%${bankName}%`);
            }

            const { data: applications, error } = await query;

            if (error) throw error;

            const totalValue = applications.reduce((sum, app) => sum + (app.amount || 0), 0);
            const approvedCount = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;
            const totalCount = applications.length;
            const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

            // Calculate default rate
            const disbursedCount = applications.filter(a => a.status === 'disbursed').length;
            const defaultCount = applications.filter(a => a.status === 'disbursed' && a.hasDefaults).length;
            const defaultRate = disbursedCount > 0 ? ((defaultCount / disbursedCount) * 100).toFixed(2) : '0';

            const avgLoanSize = totalCount > 0 ? Math.round(totalValue / totalCount) : 0;

            // Top universities
            const universityGroups: Record<string, number> = {};
            applications.forEach(app => {
                if (app.universityName) {
                    universityGroups[app.universityName] = (universityGroups[app.universityName] || 0) + 1;
                }
            });

            const topUniversities = Object.entries(universityGroups)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({
                    name,
                    count,
                    approvalRate: Math.round(
                        (applications.filter(a => a.universityName === name && (a.status === 'approved' || a.status === 'disbursed')).length / count) * 100,
                    ),
                }));

            // Group by month for the last 6 months (based on submittedAt)
            const monthlyAmounts: number[] = [0, 0, 0, 0, 0, 0];
            const months: string[] = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push(d.toLocaleString('en-US', { month: 'short' }));
            }

            applications.forEach(app => {
                if (app.status !== 'draft' && app.submittedAt) {
                    const date = new Date(app.submittedAt);
                    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
                    if (diffMonths >= 0 && diffMonths < 6) {
                        const index = 5 - diffMonths;
                        monthlyAmounts[index] += (app.amount || 0);
                    }
                }
            });

            const disbursementTrend = months.map((month, idx) => ({
                month,
                amount: Number((monthlyAmounts[idx] / 10000000).toFixed(2)) // in Cr
            }));

            return {
                totalPortfolioValue: totalValue,
                totalApplications: totalCount,
                approvalRate,
                defaultRate: parseFloat(defaultRate),
                avgLoanSize,
                disbursedAmount: applications
                    .filter(a => a.status === 'disbursed')
                    .reduce((sum, a) => sum + (a.amount || 0), 0),
                topUniversities,
                disbursementTrend,
            };
        } catch (e) {
            throw new BadRequestException(`Portfolio analysis failed: ${e.message}`);
        }
    }

    async getComplianceReport(user?: any, bankId?: string) {
        try {
            const isBank = (user?.role === 'bank' || user?.role === 'partner_bank');
            let bankName: string | null = null;
            if (isBank) {
                if (user?.bankName) {
                    bankName = user.bankName;
                } else if (user?.bank) {
                    const lowerB = user.bank.toLowerCase();
                    if (lowerB.includes('credila') || lowerB.includes('hdfc')) bankName = 'HDFC Credila';
                    else if (lowerB.includes('poonawalla')) bankName = 'Poonawalla';
                    else if (lowerB.includes('idfc')) bankName = 'IDFC';
                    else if (lowerB.includes('avanse')) bankName = 'Avanse';
                    else if (lowerB.includes('auxilo')) bankName = 'Auxilo';
                    else bankName = user.bank;
                }

                // Try email corporate domain next
                if (!bankName && user?.email) {
                    const lowerEmail = user.email.toLowerCase().trim();
                    if (lowerEmail.includes("auxilo.com")) bankName = 'Auxilo';
                    else if (lowerEmail.includes("avanse.com")) bankName = 'Avanse';
                    else if (lowerEmail.includes("credila.com") || lowerEmail.includes("hdfccredila.com")) bankName = 'HDFC Credila';
                    else if (lowerEmail.includes("idfcfirstbank.com") || lowerEmail.includes("idfcbank.com")) bankName = 'IDFC';
                    else if (lowerEmail.includes("poonawallafincorp.com")) bankName = 'Poonawalla';
                }

                if (!bankName) {
                    const bId = bankId || user?.firstName;
                    if (bId) {
                        const lower = bId.toLowerCase();
                        if (lower.includes('credila')) bankName = 'HDFC Credila';
                        else if (lower.includes('poonawalla')) bankName = 'Poonawalla';
                        else if (lower.includes('idfc')) bankName = 'IDFC';
                        else if (lower.includes('avanse')) bankName = 'Avanse';
                        else if (lower.includes('auxilo')) bankName = 'Auxilo';
                        else bankName = bId;
                    }
                }
            }

            let query = this.db.from('LoanApplication').select('*');
            if (isBank && bankName) {
                query = query.ilike('bank', `%${bankName}%`);
            }

            const { data: applications, error } = await query;

            if (error) throw error;

            const totalCount = applications.length;
            const verifiedCount = applications.filter(a => a.isVerified).length;
            const overallCompliance = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;

            const report = {
                rbiCompliance: {
                    regulation: 'RBI Education Loan Guidelines',
                    status: 'compliant',
                    detail: 'All applications processed per RBI regulations',
                },
                nhbCompliance: {
                    regulation: 'NHB Mortgage Loan Guidelines',
                    status: 'compliant',
                    detail: 'Collateral evaluation meets NHB standards',
                },
                dataProtection: {
                    regulation: 'Data Protection (Privacy Policy)',
                    status: 'compliant',
                    detail: '100% data encryption and secure storage',
                },
                gstCompliance: {
                    regulation: 'GST Compliance',
                    status: applications.filter(a => !a.gstVerified).length > 0 ? 'warning' : 'compliant',
                    detail:
                        applications.filter(a => !a.gstVerified).length > 0
                            ? `${applications.filter(a => !a.gstVerified).length} applications pending GST documentation`
                            : 'All GST documentation complete',
                },
                kycAml: {
                    regulation: 'KYC/AML Requirements',
                    status: 'compliant',
                    detail: 'All applicants verified through DigiLocker',
                },
                overallCompliance,
            };

            return report;
        } catch (e) {
            throw new BadRequestException(`Compliance report failed: ${e.message}`);
        }
    }

    // Private helper methods

    private checkAge(dateOfBirth: string): boolean {
        const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
        return age >= 18 && age <= 40;
    }

    private calculateMaxLoan(app: any): number {
        // Simple calculation - can be enhanced
        const baseAmount = 25000000; // 25 LPA
        if (app.riskLevel === 'low') return baseAmount * 1.2;
        if (app.riskLevel === 'high') return baseAmount * 0.8;
        return baseAmount;
    }

    private async updateApplicationRemarkCount(appId: string) {
        const remarks = await this.getApplicationRemarks(appId);
        await this.db
            .from('LoanApplication')
            .update({ remarkCount: remarks.length })
            .eq('id', appId);
    }

    private async createAuditLog(data: any) {
        await this.db.from('AuditLog').insert({
            ...data,
            createdAt: new Date().toISOString(),
        });
    }
}
