
import { Controller, Get, Post, Body, Query, Res, BadRequestException } from '@nestjs/common';
import { DigilockerService } from './digilocker.service';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { Response } from 'express';
import * as crypto from 'crypto';

@Controller('digilocker')
export class DigilockerController {
    constructor(
        private readonly digilockerService: DigilockerService,
        private readonly usersService: UsersService,
        private readonly supabase: SupabaseService,
    ) { }

    private mockOtps = new Map<string, string>();

    /**
     * Step 1: Frontend redirects user here.
     * This endpoint redirects the user to the DigiLocker authorization page.
     * DigiLocker handles mobile OTP authentication — we never ask for mobile/email directly.
     */
    @Get('status')
    async getStatus() {
        return {
            mockMode: process.env.DIGILOCKER_MOCK_MODE === 'true',
            clientId: process.env.DIGILOCKER_CLIENT_ID ? '✓ Set' : '✗ Missing',
            clientSecret: process.env.DIGILOCKER_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
            callbackUrl: process.env.DIGILOCKER_CALLBACK_URL || 'http://localhost:5000/api/digilocker/callback',
            message: process.env.DIGILOCKER_MOCK_MODE === 'true'
                ? '✓ Mock mode enabled - documents will be simulated'
                : '✓ Real mode - DigiLocker Requestor flow ready'
        };
    }

    @Get('authorize')
    async authorize(
        @Query('userId') userId: string,
        @Query('docType') docType: string,
        @Query('source') source: string,
        @Res() res: Response,
    ) {
        if (!userId) throw new BadRequestException('userId is required');

        // Generate PKCE code_verifier and code_challenge (required by DigiLocker)
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

        const stateData = {
            userId,
            docType: docType || 'ALL_SYNC',
            source: source || 'vault',
            codeVerifier,
        };
        const state = Buffer.from(JSON.stringify(stateData)).toString('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const redirectUri = process.env.DIGILOCKER_CALLBACK_URL || (backendUrl + '/api/digilocker/callback');

        if (process.env.DIGILOCKER_MOCK_MODE === 'true') {
            return res.redirect(backendUrl + '/api/digilocker/mock-login?state=' + state);
        }

        const authUrl = this.digilockerService.getAuthUrl(state, redirectUri, codeChallenge);
        return res.redirect(authUrl);
    }

    @Get('mock-login')
    getMockLoginPage(@Query('state') state: string, @Res() res) {
        const safeState = (state || '').replace(/[^a-zA-Z0-9_\-]/g, '');
        let decodedState = { authMethod: 'pin' };
        try {
            const base64 = safeState.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(safeState.length / 4) * 4, '=');
            decodedState = JSON.parse(Buffer.from(base64, 'base64').toString());
        } catch (e) { }
        const isPinless = (decodedState as any).authMethod === 'pinless';

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DigiLocker - Sign In</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background-color: #f7f7f7; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        
        .header { width: 100%; padding: 20px; display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 20px; }
        .header img { height: 45px; }
        
        .card {
            background: white;
            width: 100%;
            max-width: 440px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            padding: 40px;
            border-bottom: 5px solid #6366f1;
            margin-bottom: 20px;
        }
        
        .card h1 { font-size: 24px; font-weight: 700; color: #333; margin-bottom: 30px; text-align: center; }
        
        .tabs { display: flex; background: #f0f0f0; border-radius: 6px; padding: 4px; margin-bottom: 30px; }
        .tab { flex: 1; padding: 12px; text-align: center; font-size: 14px; font-weight: 700; cursor: pointer; border-radius: 4px; transition: all 0.2s; color: #1a73e8; }
        .tab.active { background: #1a73e8; color: white; }
        
        .input-group { margin-bottom: 20px; }
        .input-group input {
            width: 100%;
            padding: 15px;
            border: 1.5px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s;
        }
        .input-group input:focus { border-color: #1a73e8; }
        .input-label { font-size: 11px; color: #1a73e8; margin-top: 8px; display: block; }

        .btn-next {
            width: 100%;
            padding: 16px;
            background: #82c91e;
            background: linear-gradient(to bottom, #82c91e, #6eb71a);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: opacity 0.2s;
        }
        .btn-next.submitting { opacity: 0.7; pointer-events: none; }
        
        .footer-links { text-align: center; font-size: 14px; color: #555; margin-top: 10px; }
        .footer-links a { color: #1a73e8; text-decoration: none; font-weight: 600; }

        .checklist {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            border: 1px dashed #ddd;
        }
        .check-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 500; }
        .check-icon { color: #4a9d5c; font-size: 14px; font-weight: bold; }

        .error-msg { background: #fff0f0; color: #c00; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 20px; border: 1px solid #ffcccc; display: none; }

        #otp-view { display: none; text-align: center; }
        .otp-input { text-align: center; font-size: 24px; letter-spacing: 10px; font-weight: 800; }

        #account-view { display: none; }
        .acct-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #eee; border-radius: 10px; margin-bottom: 10px; cursor: pointer; transition: background 0.2s; }
        .acct-row:hover { background: #f0f7ff; border-color: #1a73e8; }

        #consent-view { display: none; }
    </style>
</head>
<body>
    <div class="header">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/800px-Emblem_of_India.svg.png" alt="Emblem">
        <img src="https://upload.wikimedia.org/wikipedia/en/1/1d/DigiLocker_logo.png" alt="DigiLocker">
    </div>

    <div class="card">
        <h1>Sign In to your account!</h1>

        <!-- STEP 1: LOGIN -->
        <div id="login-view">
            <div class="tabs">
                <div class="tab active">Mobile</div>
                <div class="tab">Username</div>
                <div class="tab">Aadhaar</div>
            </div>

            <div id="error-box" class="error-msg"></div>

            <div class="input-group">
                <input type="tel" id="mobile-number" placeholder="Mobile Number*" maxlength="10">
                <span class="input-label">Enter your registered Mobile Number</span>
            </div>

            <div class="checklist" style="${isPinless ? '' : 'display:none;'}">
                <div class="check-item"><span class="check-icon">✓</span> Pin-less authentication active</div>
                <div class="check-item"><span class="check-icon">✓</span> Linked to Aadhaar Mobile Node</div>
                <div class="check-item"><span class="check-icon">✓</span> Secure OTP-only transmission</div>
            </div>

            <button class="btn-next" onclick="handleNext()" id="btn-next">Next</button>
        </div>

        <!-- STEP 2: OTP -->
        <div id="otp-view">
            <p style="margin-bottom: 20px; font-size: 14px; color: #666;">A 6-digit OTP has been sent to <b id="mask-num"></b></p>
            <div class="input-group">
                <input type="text" id="otp-code" class="otp-input" placeholder="••••••" maxlength="6">
            </div>
            <button class="btn-next" onclick="verifyOtp()">Sign In</button>
            <p style="margin-top: 20px; font-size: 12px; color: #888;">Didn't receive? <a href="#" style="color:#1a73e8; font-weight:700;">Resend OTP</a></p>
        </div>

        <!-- STEP 3: ACCOUNTS -->
        <div id="account-view">
            <p style="margin-bottom: 20px; font-size: 14px; font-weight: 600; color: #333;">Select your account</p>
            <div id="account-list"></div>
        </div>

        <!-- STEP 4: CONSENT -->
        <div id="consent-view">
            <div style="text-align:center; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #666;">You are providing consent to share your data with</p>
                <h2 style="font-size: 18px; color: #1a3a6b;">VidyaLoan</h2>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; color: #444;">
                <p style="margin-bottom: 10px;"><b>Data requested:</b></p>
                <p>• Aadhaar Card, PAN & Marksheets</p>
                <p>• Profile (Name, DOB, Gender)</p>
            </div>
            <button class="btn-next" onclick="redirectCallback()" style="background: #1a73e8;">Allow</button>
            <button onclick="location.reload()" style="width:100%; border:none; background:transparent; margin-top:15px; color:#888; font-size:14px; cursor:pointer;">Deny</button>
        </div>
    </div>

    <div class="footer-links">
        Do not have an account? <a href="#">Sign Up</a>
    </div>

    <script>
        const stateData = "${safeState}";
        let currentMobile = "";
            if (!otp || otp.length < 4) { alert('Enter the OTP received on your mobile.'); return; }
            try {
                const res = await fetch('/api/digilocker/mock/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobile: currentMobile, otp })
                });
                const data = await res.json();
                if (data.success) {
                    renderAccounts(data.user);
                    document.getElementById('step-otp').style.display = 'none';
                    document.getElementById('step-account').style.display = 'block';
                } else {
                    alert('Invalid OTP. Please enter the valid verification code.');
                }
            } catch (e) { alert('Error verifying OTP. Please try again.'); }
        }

        function renderAccounts(user) {
            const list = document.getElementById('account-list');
            if (user) {
                list.innerHTML =
                    '<div class="acct-card" onclick="gotoConsent()">' +
                        '<div style="display:flex;align-items:center;">' +
                            '<div class="acct-avatar">' + user.firstName[0] + '</div>' +
                            '<div class="acct-info">' +
                                '<p>' + user.firstName.toUpperCase() + ' ' + (user.lastName || '').toUpperCase() + '</p>' +
                                '<small>✔ Verified DigiLocker Account</small>' +
                            '</div>' +
                        '</div>' +
                        '<div class="acct-chevron">›</div>' +
                    '</div>';
            } else {
                list.innerHTML = '<p style="color:#888;font-size:14px;">No account found.</p>';
            }
        }

        function gotoConsent() {
            document.getElementById('step-account').style.display = 'none';
            document.getElementById('step-consent').style.display = 'block';
        }

        function grantAccess() {
            window.location.href = '/api/digilocker/callback?code=mock_code&state=' + state;
        }
    </script>
</body>
</html>
        `;
        res.send(html);
    }

    @Post('mock/send-otp')
    async mockSendOtp(@Body() body: { mobile: string }) {
        const user = await this.usersService.findByMobile(body.mobile);
        if (!user) {
            throw new BadRequestException('Account not found with this mobile number.');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        this.mockOtps.set(body.mobile, otp);

        console.log('--- DIGILOCKER MOCK OTP ---');
        console.log('MOBILE: ' + body.mobile);
        console.log('OTP: ' + otp);
        console.log('---------------------------');

        return { success: true };
    }

    @Post('mock/verify-otp')
    async mockVerifyOtp(@Body() body: { mobile: string; otp: string }) {
        const storedOtp = this.mockOtps.get(body.mobile);
        if (storedOtp && body.otp === storedOtp) {
            const user = await this.usersService.findByMobile(body.mobile);
            if (!user) throw new BadRequestException('Account vanished!');
            return {
                success: true,
                user: { firstName: user.firstName, lastName: user.lastName }
            };
        }
        return { success: false };
    }

    /**
     * Step 2: DigiLocker redirects here after user grants consent.
     * Backend exchanges the authorization code for an access token,
     * then fetches the user's documents from DigiLocker.
     */
    @Get('callback')
    async handleCallback(
        @Query() query: any,
        @Res() res: Response,
    ) {
        const { code, state, error, error_description } = query;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        console.log('===== DIGILOCKER CALLBACK START =====');
        console.log('State received:', state ? '✓ Yes' : '✗ No');
        console.log('Code received:', code ? '✓ Yes' : '✗ No');
        console.log('Error from DigiLocker:', error || 'No error');

        if (error) {
            console.log('Redirecting to error page...');
            return res.redirect(frontendUrl + '/document-vault/digilocker?status=error&message=' + encodeURIComponent(error_description || error));
        }
        if (!code || !state) {
            console.log('Missing code or state, redirecting to error');
            return res.redirect(frontendUrl + '/document-vault/digilocker?status=error&message=' + encodeURIComponent('Missing authorization code or state'));
        }

        try {
            const base64 = state
                .replace(/-/g, '+')
                .replace(/_/g, '/')
                .padEnd(Math.ceil(state.length / 4) * 4, '=');
            const decodedState = JSON.parse(Buffer.from(base64, 'base64').toString());
            const { userId, docType, source } = decodedState;
            console.log('✓ State decoded:', { userId, docType, source });
            const redirectPath = source === 'portal' ? '/document-vault/digilocker' : '/document-vault';

            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            const redirectUri = process.env.DIGILOCKER_CALLBACK_URL || (backendUrl + '/api/digilocker/callback');
            const mockMode = process.env.DIGILOCKER_MOCK_MODE === 'true';

            console.log('Mode:', mockMode ? 'MOCK' : 'REAL');

            if (mockMode) {
                // Mock mode: simulate document fetch without calling DigiLocker APIs
                console.log('Processing mock documents for userId:', userId);
                await this.processMockDocuments(userId, docType);
                console.log('✓ Mock documents processed');
            } else {
                // Real mode: exchange authorization code for access token (with PKCE code_verifier)
                console.log('Exchanging code for token...');
                const tokenData = await this.digilockerService.getAccessToken(code, redirectUri, decodedState.codeVerifier);
                const accessToken = tokenData.access_token;
                console.log('✓ Access token obtained');

                // Fetch and store documents using the access token
                console.log('Fetching and storing documents...');
                await this.fetchAndStoreDocuments(userId, accessToken, docType);
                console.log('✓ Documents stored');
            }

            console.log('✓ Redirecting to:', redirectPath);
            console.log('===== DIGILOCKER CALLBACK END (SUCCESS) =====');
            return res.redirect(frontendUrl + redirectPath + '?status=success&message=' + encodeURIComponent('Documents fetched from DigiLocker'));
        } catch (error) {
            console.error('❌ DigiLocker callback error:', error);
            const errMsg = error instanceof Error ? error.message : String(error);
            console.log('===== DIGILOCKER CALLBACK END (ERROR) =====');
            return res.redirect(frontendUrl + '/document-vault/digilocker?status=error&message=' + encodeURIComponent('Failed to process DigiLocker response: ' + errMsg));
        }
    }

    private normalizeDigilockerType(rawDoc: any): string {
        // Real DigiLocker API uses 'doctype' field; mock/legacy may use 'type'
        const candidates = [
            rawDoc?.doctype,   // Real API field name
            rawDoc?.type,
            rawDoc?.docType,
            rawDoc?.documentType,
            rawDoc?.issuerDocType,
        ]
            .filter(Boolean)
            .map((value: string) => String(value).toUpperCase().trim());

        if (candidates.length > 0) {
            return candidates[0];
        }

        // Try to extract from URI (e.g., in.gov.cbse-SSCER-1234)
        const uri = String(rawDoc?.uri || rawDoc?.id || '');
        const uriMatch = uri.match(/(PANCR|ADHAR|AADHAR|10TH|12TH|SSCER|HSCER|PASPT|DGCTR|MKST)/i);
        if (uriMatch?.[1]) {
            return uriMatch[1].toUpperCase();
        }

        return '';
    }

    /**
     * Mock document processing for development/testing
     */
    private async processMockDocuments(userId: string, docType: string) {
        console.log('📋 Mock processor started - userId:', userId, 'docType:', docType);

        const mockDocs = [
            { type: 'PANCR', name: 'PAN Card' },
            { type: 'ADHAR', name: 'Aadhar Card' },
            { type: '10TH', name: '10th Marksheet' },
            { type: '12TH', name: '12th Marksheet' },
            { type: 'DGCTR', name: 'B.Tech / Degree Certificate' },
            { type: 'MKST', name: 'Graduation Marksheets' }
        ];

        const syncMap: Record<string, string> = {
            'pan_student': 'PANCR', 'pan_coapp': 'PANCR', 'pan_father': 'PANCR', 'pan_mother': 'PANCR',
            'aadhar_student': 'ADHAR', 'aadhar_coapp': 'ADHAR', 'aadhar_father': 'ADHAR', 'aadhar_mother': 'ADHAR',
            'marksheet_10th': '10TH', 'marksheet_12th': '12TH', 'marksheet_degree': 'DGCTR', 'passport': 'PASPT'
        };

        const reverseMap: Record<string, string[]> = {
            'PANCR': ['pan_student'],
            'ADHAR': ['aadhar_student'],
            '10TH': ['marksheet_10th'],
            'SSCER': ['marksheet_10th'],
            '12TH': ['marksheet_12th'],
            'HSCER': ['marksheet_12th'],
            'DGCTR': ['marksheet_degree'],
            'MKST': ['marksheet_degree'],
            'PASPT': ['passport'],
        };

        if (docType === 'ALL_SYNC') {
            console.log('🔄 Processing ALL documents...');
            for (const diDoc of mockDocs) {
                const internalTypes = reverseMap[diDoc.type] || [];
                console.log(`  - ${diDoc.type} -> ${internalTypes.join(', ')}`);
                for (const type of internalTypes) {
                    await this.usersService.upsertUserDocument(userId, type, {
                        uploaded: false,
                        status: 'available_in_digilocker',
                        digilockerTxId: 'MOCK_TX_' + Date.now(),
                        verificationMetadata: diDoc,
                    });
                    console.log(`    ✓ Upserted ${type} with status available_in_digilocker`);
                }
            }
        } else {
            // Specific doc sync
            console.log('🎯 Processing specific document:', docType);
            const mappedDlType = syncMap[docType] || docType;
            const diDoc = mockDocs.find(d => d.type === mappedDlType) || { type: mappedDlType, name: docType };
            console.log(`  Mapped ${docType} -> ${mappedDlType}`);
            await this.usersService.upsertUserDocument(userId, docType, {
                uploaded: false,
                status: 'available_in_digilocker',
                digilockerTxId: 'MOCK_TX_' + Date.now(),
                verificationMetadata: diDoc,
            });
            console.log(`    ✓ Upserted ${docType} with status available_in_digilocker`);
        }

        console.log('✓ Mock processing complete');
    }

    /**
     * Fetch documents from DigiLocker using access token and store them
     */
    private async fetchAndStoreDocuments(userId: string, accessToken: string, docType: string) {
        console.log('🔍 Fetching documents from DigiLocker...');
        const documents = await this.digilockerService.listDocuments(accessToken);
        console.log(`✓ Retrieved ${documents.length} documents from DigiLocker`);

        const syncMap: Record<string, string> = {
            'pan_student': 'PANCR', 'pan_coapp': 'PANCR', 'pan_father': 'PANCR', 'pan_mother': 'PANCR',
            'aadhar_student': 'ADHAR', 'aadhar_coapp': 'ADHAR', 'aadhar_father': 'ADHAR', 'aadhar_mother': 'ADHAR',
            'marksheet_10th': '10TH', 'marksheet_12th': '12TH', 'marksheet_degree': 'DGCTR', 'passport': 'PASPT'
        };

        const reverseMap: Record<string, string[]> = {
            'PANCR': ['pan_student'],
            'ADHAR': ['aadhar_student'],
            'AADHAR': ['aadhar_student'],
            '10TH': ['marksheet_10th'],
            '12TH': ['marksheet_12th'],
            'SSCER': ['marksheet_10th'],
            'HSCER': ['marksheet_12th'],
            'PASPT': ['passport'],
            'DGCTR': ['marksheet_degree'],
            'MKST': ['marksheet_degree'],
        };

        const aliasToCanonical: Record<string, string> = {
            'AADHAR': 'ADHAR',
            'SSC': '10TH',
            'HSC': '12TH',
        };

        let upsertCount = 0;
        for (const doc of documents) {
            const normalizedType = this.normalizeDigilockerType(doc);
            console.log(`  Processing: ${JSON.stringify(doc).substring(0, 100)}... -> normalized: ${normalizedType}`);

            const dlType = aliasToCanonical[normalizedType] || normalizedType;

            if (!dlType) {
                console.log(`    ⚠️  Could not normalize type, skipping`);
                continue;
            }

            if (docType !== 'ALL_SYNC') {
                const mappedDlType = aliasToCanonical[syncMap[docType] || docType] || (syncMap[docType] || docType);
                if (dlType === mappedDlType) {
                    console.log(`    ✓ Matched! Upserting ${docType} (${dlType})`);
                    await this.usersService.upsertUserDocument(userId, docType, {
                        uploaded: false,
                        status: 'available_in_digilocker',
                        digilockerTxId: doc.id || doc.uri || ('DGL_' + Date.now()),
                        verificationMetadata: {
                            source: 'DigiLocker',
                            document_name: doc.name || doc.description,
                            type: dlType,
                            verified_at: new Date().toISOString(),
                        },
                    });
                    upsertCount++;
                } else {
                    console.log(`    ⚠️  Type mismatch: expected ${mappedDlType}, got ${dlType}`);
                }
            } else {
                const internalTypes = reverseMap[dlType] || [];
                console.log(`    ALL_SYNC: ${dlType} -> [${internalTypes.join(', ')}]`);
                for (const type of internalTypes) {
                    await this.usersService.upsertUserDocument(userId, type, {
                        uploaded: false,
                        status: 'available_in_digilocker',
                        digilockerTxId: doc.id || doc.uri || ('DGL_' + Date.now()),
                        verificationMetadata: {
                            source: 'DigiLocker',
                            document_name: doc.name || doc.description,
                            type: dlType,
                            verified_at: new Date().toISOString(),
                        },
                    });
                    console.log(`      ✓ Upserted ${type}`);
                    upsertCount++;
                }
            }
        }

        console.log(`✓ Completed - upserted ${upsertCount} documents`);
    }

    @Post('sync')
    async syncDocument(@Body() body: { userId: string; docType: string }) {
        const { userId, docType } = body;
        const { data: doc, error } = await this.supabase.getClient()
            .from('UserDocument')
            .select('*')
            .eq('userId', userId)
            .eq('docType', docType)
            .single();
        if (!doc) throw new BadRequestException('Document not found');
        await this.usersService.upsertUserDocument(userId, docType, {
            status: 'verified',
            uploaded: true,
            verifiedAt: new Date(),
            filePath: './public/mock/digilocker/' + docType + '.pdf',
            digilockerTxId: doc.digilockerTxId,
            verificationMetadata: doc.verificationMetadata
        });
        return { success: true, message: 'Document synced successfully' };
    }
}
