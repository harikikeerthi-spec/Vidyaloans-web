import { Controller, Get, Post, Body, UseGuards, Param, Put, Delete, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminGuard } from '../auth/admin.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { EmailService } from '../auth/email.service';
import * as fs from 'fs';
import * as path from 'path';

function getAgentProfilePath() {
    const dir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'agent_profiles.json');
}

function readAllAgentProfiles(): Record<string, any> {
    const file = getAgentProfilePath();
    if (!fs.existsSync(file)) return {};
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
        return {};
    }
}

function writeAgentProfile(agentId: string, payload: any) {
    const file = getAgentProfilePath();
    let data: Record<string, any> = {};
    if (fs.existsSync(file)) {
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
        } catch {}
    }
    data[agentId] = { ...(data[agentId] || {}), ...payload };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return data[agentId];
}

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly emailService: EmailService,
    ) { }

    @Post('profile')
    async getProfile(@Body() body: { email: string }) {
        if (!body || !body.email) {
            return {
                success: false,
                message: 'Email is required',
            };
        }
        const user = await this.usersService.findOne(body.email);

        if (!user) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        // Format date of birth to DD-MM-YYYY if it exists
        let formattedDOB = '';
        if (user.dateOfBirth) {
            const date = new Date(user.dateOfBirth);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            formattedDOB = `${day}-${month}-${year}`;
        }

        const safeJsonParse = (str: string) => {
            if (!str) return null;
            try {
                return typeof str === 'string' ? JSON.parse(str) : str;
            } catch (e) {
                return str;
            }
        };

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phoneNumber: user.phoneNumber || '',
                dateOfBirth: formattedDOB,
                mobile: user.mobile,
                role: user.role,
                registeredAtIndia: user.registeredAtIndia || '',
                panNumber: user.panNumber || '',
                aadhaarNumber: user.aadhaarNumber || '',
                fatherName: user.fatherName || '',
                permanentAddress: user.permanentAddress || '',
                gender: user.gender || '',
                documentVerified: user.documentVerified || false,
                status: user.status || 'pending',
                rejectionReason: user.rejectionReason || '',
                goal: user.goal || '',
                studyDestination: user.studyDestination || '',
                courseName: user.courseName || '',
                targetUniversity: user.targetUniversity || '',
                intakeSeason: user.intakeSeason || '',
                bachelorsDegree: user.bachelorsDegree || '',
                gpa: user.gpa || null,
                workExp: user.workExp || null,
                entranceTest: user.entranceTest || '',
                entranceScore: user.entranceScore || '',
                englishTest: user.englishTest || '',
                englishScore: user.englishScore || '',
                budget: user.budget || '',
                pincode: user.pincode || '',
                loanAmount: user.loanAmount || '',
                admitStatus: user.admitStatus || '',
                passport: safeJsonParse(user.passport),
                nationality: safeJsonParse(user.nationality),
                mailingAddress: safeJsonParse(user.mailingAddress),
                emergencyContact: safeJsonParse(user.emergencyContact),
                academic: safeJsonParse(user.academic),
                workExperience: safeJsonParse(user.workExperience),
                tests: safeJsonParse(user.tests),
                family: safeJsonParse(user.family),
                coApplicant: safeJsonParse(user.coApplicant),
                createdAt: user.createdAt || user.created_at || '',
            },
        };
    }

    @Get('admin/stats')
    @UseGuards(AdminGuard)
    async getUserStats() {
        return this.usersService.getUserStats();
    }

    // Admin: list all users (limited fields)
    @Get('admin/list')
    @UseGuards(AdminGuard)
    async listUsers(
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('search') search?: string,
        @Query('role') role?: string,
    ) {
        console.log('[UsersController.listUsers] Request received', { limit, offset, search, role });
        console.log('[UsersController.listUsers] Request Referer:', req.headers.referer || req.headers.referrer);
        try {
            const l = limit ? parseInt(limit, 10) : 30;
            const o = offset ? parseInt(offset, 10) : 0;

            const excludeRoles = req.user?.role === 'staff' ? ['admin', 'super_admin'] : [];

            console.log('[UsersController.listUsers] Calling usersService.findAll()...');
            const result = await this.usersService.findAll(l, o, search, role, excludeRoles);
            const users = result.data;
            const agentProfiles = readAllAgentProfiles();
            console.log(`[UsersController.listUsers] Found ${users?.length || 0} users (Total: ${result.total})`);

            if (!users) return { success: true, data: [], total: 0 };

            return {
                success: true,
                data: users.map(u => {
                    const ap = (u?.id && agentProfiles[u.id]) || {};
                    return {
                        id: u?.id || '',
                        email: u?.email || '',
                        firstName: u?.firstName || '',
                        lastName: u?.lastName || '',
                        phoneNumber: u?.phoneNumber || '',
                        mobile: u?.mobile || '',
                        role: u?.role || 'user',
                        bank: u?.bank || '',
                        createdAt: u?.createdAt || u?.created_at || new Date().toISOString(),
                        registeredAtIndia: u?.registeredAtIndia || '',
                        staffId: u?.staffId || '',
                        officeId: u?.officeId || '',
                        officeLocation: u?.officeLocation || '',
                        status: u?.status || ap.status || 'active',
                        panNumber: u?.panNumber || ap.panNumber || '',
                        partnership: ap.partnership || '',
                        percentage: ap.percentage || '',
                        businessName: ap.businessName || '',
                        profilePhoto: ap.profilePhoto || '',
                        isDraft: (u?.status === 'draft' || ap.status === 'draft')
                    };
                }),
                total: result.total,
                limit: l,
                offset: o
            };
        } catch (error) {
            console.error('[UsersController.listUsers] Fatal Error:', error);
            return {
                success: false,
                message: error.message || 'Failed to list users',
                data: [],
                total: 0
            };
        }
    }

    @UseGuards(AdminGuard)
    @Post('make-admin')
    async makeAdmin(@Body() body: { email: string; role: string }) {
        if (!body || !body.email || !body.role) {
            return {
                success: false,
                message: 'Email and role are required',
            };
        }
        const allowedRoles = ['admin', 'user', 'staff', 'super_admin', 'agent', 'bank', 'student'];
        if (!allowedRoles.includes(body.role)) {
            return {
                success: false,
                message: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
            };
        }

        const user = await this.usersService.findOne(body.email);
        if (!user) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        const updated = await this.usersService.updateUserRole(body.email, body.role as any);
        return {
            success: true,
            message: `User ${body.email} role updated to '${body.role}'`,
            user: {
                id: updated.id,
                email: updated.email,
                firstName: updated.firstName,
                lastName: updated.lastName,
                role: updated.role,
            },
        };
    }

    @UseGuards(AdminGuard)
    @Post('admin/send-email')
    async sendAdminEmail(
        @Body() body: {
            to: string;
            subject: string;
            content: string;
            role?: string;
            isBulk?: boolean
        }
    ) {
        if (!body || !body.subject || !body.content) {
            return { success: false, message: 'Subject and content are required' };
        }

        try {
            if (body.isBulk && body.role) {
                const users = await this.usersService.findAll(undefined, undefined, undefined, body.role);
                const filteredUsers = users.data.filter(u => u.role === body.role);

                for (const u of filteredUsers) {
                    await this.emailService.sendMail(
                        u.email,
                        body.subject,
                        `<div style="font-family: sans-serif; padding: 20px;">${body.content}</div>`,
                        body.content
                    );
                }

                return {
                    success: true,
                    message: `Email sent to ${filteredUsers.length} users with role '${body.role}'`
                };
            } else if (body.to) {
                await this.emailService.sendMail(
                    body.to,
                    body.subject,
                    `<div style="font-family: sans-serif; padding: 20px;">${body.content}</div>`,
                    body.content
                );
                return { success: true, message: `Email sent to ${body.to}` };
            } else {
                return { success: false, message: 'Recipient email or role is required' };
            }
        } catch (error) {
            console.error('Error sending admin email:', error);
            return { success: false, message: 'Failed to send email' };
        }
    }

    @UseGuards(AdminGuard)
    @Post('admin/create')
    async adminCreateUser(
        @Body() body: {
            email: string;
            firstName: string;
            lastName: string;
            mobile: string;
            role: string;
            officeId?: string;
            officeLocation?: string;
            office?: string;
            // Agent-specific fields
            partnership?: string;
            percentage?: string | number;
            panNumber?: string;
            pan?: string;
            profilePhoto?: string;
            profileImage?: string;
            businessName?: string;
            officeAddress?: string;
            gstin?: string;
            documents?: any[];
            isDraft?: boolean;
            status?: string;
            bank?: string;
        }
    ) {
        console.log('=== ADMIN CREATE USER START ===');
        console.log('Request body:', body);

        if (!body || !body.email || !body.role) {
            console.log('Validation failed: missing email or role');
            return { success: false, message: 'Email and role are required' };
        }

        if (body.role === 'bank' && (!body.bank || !String(body.bank).trim())) {
            console.log('Validation failed: missing assigned lending bank partner for bank role');
            return {
                success: false,
                message: 'Assigned Lending Bank Partner is required. Please select a bank partner.'
            };
        }

        const existing = await this.usersService.findOne(body.email);
        if (existing) {
            return { success: false, message: 'User with this email already exists' };
        }

        try {
            const isAgent = body.role === 'agent' || body.role === 'partner_agent';
            const isDraft = !!body.isDraft;
            const effectiveStatus = isDraft ? 'draft' : 'active';

            const newUser = await this.usersService.create({
                email: body.email,
                firstName: body.firstName,
                lastName: body.lastName,
                mobile: body.mobile,
                role: body.role,
                officeId: body.officeId,
                officeLocation: body.officeLocation || body.office,
                bank: body.bank,
                password: Math.random().toString(36).slice(-12), // Generate a dummy password
            });

            console.log('New user created:', {
                fullUser: JSON.stringify(newUser),
                hasId: !!newUser?.id,
                id: newUser?.id,
                keys: Object.keys(newUser || {})
            });

            if (isAgent) {
                // Persist full Agent Partner profile
                writeAgentProfile(newUser.id, {
                    id: newUser.id,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email,
                    phoneNumber: body.mobile,
                    role: body.role,
                    businessName: body.businessName || `${body.firstName || 'Agent'} Agency`,
                    partnership: body.partnership || 'Individual Consultant',
                    percentage: body.percentage || '1.5',
                    panNumber: body.panNumber || body.pan || '',
                    profilePhoto: body.profilePhoto || body.profileImage || '',
                    officeAddress: body.officeAddress || body.officeLocation || '',
                    gstin: body.gstin || '',
                    documents: body.documents || [],
                    status: effectiveStatus,
                    kycStatus: isDraft ? 'incomplete' : 'verified',
                    createdAt: new Date().toISOString(),
                });

                // Update status in User table if supported
                try {
                    await this.usersService.updateUserStatus(newUser.id, effectiveStatus);
                } catch (statusErr) {
                    console.warn('[adminCreateUser] Non-blocking status update failed:', statusErr);
                }

                // If final submission (not draft), dispatch the congratulations welcome email with portal link
                if (!isDraft) {
                    try {
                        await this.emailService.sendAgentWelcomeEmail(
                            newUser.email,
                            `${body.firstName || ''} ${body.lastName || ''}`.trim() || 'Partner',
                            newUser.id,
                            body.partnership || 'Channel Partner',
                            body.percentage || '1.5'
                        );
                    } catch (emailErr: any) {
                        console.warn('[adminCreateUser] Agent welcome email non-blocking failed:', emailErr?.message);
                    }
                }
            } else {
                // Send standard welcome email for non-agents
                try {
                    await this.emailService.sendMail(
                        newUser.email,
                        `Welcome to VidyaLoan - Your ${body.role} Account`,
                        `<div style="font-family: sans-serif; padding: 20px;">
                            <h2>Welcome, ${body.firstName}!</h2>
                            <p>Your account as an <strong>${body.role}</strong> has been created by the administrator.</p>
                            <p>You can now log in using your email: <strong>${body.email}</strong></p>
                        </div>`,
                        `Welcome to VidyaLoan! Your ${body.role} account has been created.`
                    );
                } catch (emailErr) {
                    console.warn('Email sending failed (non-blocking):', emailErr?.message);
                }
            }

            const responseUser = {
                id: newUser?.id,
                email: newUser?.email,
                firstName: newUser?.firstName,
                lastName: newUser?.lastName,
                role: newUser?.role,
                status: effectiveStatus,
                isDraft
            };

            console.log('Sending response:', { success: true, user: responseUser });

            const finalResponse = {
                success: true,
                message: isDraft 
                    ? 'Agent profile saved as draft successfully' 
                    : (isAgent ? 'Agent profile created and welcome email sent with login link' : 'User created successfully'),
                user: responseUser,
                isDraft
            };

            console.log('=== ADMIN CREATE USER END ===');
            console.log('Final Response:', JSON.stringify(finalResponse, null, 2));
            return finalResponse;
        } catch (error) {
            console.error('=== ERROR IN ADMIN CREATE USER ===');
            console.error('Error creating user by admin:', error);
            const errorResponse = { success: false, message: 'Failed to create user', error: error?.message };
            console.error('Error Response:', JSON.stringify(errorResponse, null, 2));
            return errorResponse;
        }
    }

    @UseGuards(AdminGuard)
    @Post('admin/update-details')
    async adminUpdateUser(@Body() body: any) {
        try {
            if (!body || (!body.email && !body.userId)) {
                return { success: false, message: 'Email or userId is required' };
            }
            const updated = await this.usersService.updateUserDetails(
                body.email,
                body.firstName,
                body.lastName,
                body.phoneNumber,
                body.dateOfBirth,
                body.intakeSeason,
                body.profileImage,
                body.pincode,
                body.targetUniversity,
                body.studyDestination,
                body.fatherName,
                body.motherName,
                body.family,
                body.coApplicant,
                body.academic,
                body.userId,
                body.passport,
                body.officeId,
                body.officeLocation || body.office,
                body.bank
            );
            return { success: true, message: 'User updated successfully', user: updated };
        } catch (error: any) {
            console.error('[adminUpdateUser] Error updating user details:', error);
            return { success: false, message: error?.message || 'Failed to update user details' };
        }
    }

    @UseGuards(AdminGuard)
    @Post('admin/update-status')
    async adminUpdateUserStatus(
        @Body() body: {
            userId: string;
            status: string;
            rejectionReason?: string
        }
    ) {
        if (!body || !body.userId || !body.status) {
            return { success: false, message: 'User ID and status are required' };
        }

        console.log(`[UsersController.adminUpdateUserStatus] Status change request for user ${body.userId} to ${body.status}`);

        const updated = await this.usersService.updateUserStatus(
            body.userId,
            body.status,
            body.rejectionReason
        );

        return {
            success: true,
            message: 'User status updated successfully',
            user: {
                id: updated.id,
                email: updated.email,
                status: updated.status,
                rejectionReason: updated.rejectionReason
            }
        };
    }

    @UseGuards(AdminGuard)
    @Get('admin/:id')
    async getUserById(@Param('id') id: string) {
        if (!id) {
            return {
                success: false,
                message: 'User ID is required',
            };
        }
        try {
            const user = await this.usersService.findById(id);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found',
                };
            }

            // Format date of birth to DD-MM-YYYY if it exists
            let formattedDOB = '';
            if (user.dateOfBirth) {
                const date = new Date(user.dateOfBirth);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                formattedDOB = `${day}-${month}-${year}`;
            }

            const safeJsonParse = (str: string) => {
                if (!str) return null;
                try {
                    return typeof str === 'string' ? JSON.parse(str) : str;
                } catch (e) {
                    return str;
                }
            };

            return {
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    phoneNumber: user.phoneNumber || '',
                    dateOfBirth: formattedDOB,
                    mobile: user.mobile,
                    role: user.role,
                    bank: user.bank || '',
                    registeredAtIndia: user.registeredAtIndia || '',
                    panNumber: user.panNumber || '',
                    aadhaarNumber: user.aadhaarNumber || '',
                    fatherName: user.fatherName || '',
                    motherName: user.motherName || '',
                    coApplicantName: user.coApplicantName || '',
                    coApplicantPhone: user.coApplicantPhone || '',
                    coApplicantEmail: user.coApplicantEmail || '',
                    coApplicantRelation: user.coApplicantRelation || '',
                    permanentAddress: user.permanentAddress || '',
                    gender: user.gender || '',
                    documentVerified: user.documentVerified || false,
                    status: user.status || 'pending',
                    rejectionReason: user.rejectionReason || '',
                    goal: user.goal || '',
                    studyDestination: user.studyDestination || '',
                    courseName: user.courseName || '',
                    targetUniversity: user.targetUniversity || '',
                    intakeSeason: user.intakeSeason || '',
                    bachelorsDegree: user.bachelorsDegree || '',
                    gpa: user.gpa || null,
                    workExp: user.workExp || null,
                    entranceTest: user.entranceTest || '',
                    entranceScore: user.entranceScore || '',
                    englishTest: user.englishTest || '',
                    englishScore: user.englishScore || '',
                    budget: user.budget || '',
                    pincode: user.pincode || '',
                    loanAmount: user.loanAmount || '',
                    admitStatus: user.admitStatus || '',
                    passport: safeJsonParse(user.passport),
                    nationality: safeJsonParse(user.nationality),
                    mailingAddress: safeJsonParse(user.mailingAddress),
                    emergencyContact: safeJsonParse(user.emergencyContact),
                    academic: safeJsonParse(user.academic),
                    workExperience: safeJsonParse(user.workExperience),
                    tests: safeJsonParse(user.tests),
                    family: safeJsonParse(user.family),
                    coApplicant: safeJsonParse(user.coApplicant),
                    parents: user.parents || [],
                    createdAt: user.createdAt || user.created_at || '',
                },
            };
        } catch (error) {
            console.error('Error fetching user details by ID:', error);
            return {
                success: false,
                message: 'Failed to fetch user details',
                error: error?.message,
            };
        }
    }

    @UseGuards(AdminGuard)
    @Delete('admin/:id')
    async deleteUser(@Param('id') id: string) {
        if (!id) {
            return { success: false, message: 'User ID is required' };
        }
        try {
            await this.usersService.deleteUser(id);
            return { success: true, message: 'User deleted successfully' };
        } catch (error) {
            console.error('Error deleting user by admin:', error);
            return { success: false, message: 'Failed to delete user', error: error?.message };
        }
    }

    @UseGuards(AdminGuard)
    @Post('admin/parents')
    async upsertParents(@Body() body: { userId: string; relation: string; name?: string; aadharNumber?: string; panNumber?: string }) {
        if (!body.userId || !body.relation) {
            return { success: false, message: 'userId and relation are required' };
        }
        try {
            const result = await this.usersService.upsertParentRecord(body.userId, body.relation, {
                name: body.name,
                aadharNumber: body.aadharNumber,
                panNumber: body.panNumber,
            });
            return { success: true, data: result };
        } catch (error) {
            console.error('Error upserting parent record:', error);
            return { success: false, message: 'Failed to upsert parent record', error: error?.message };
        }
    }
}

