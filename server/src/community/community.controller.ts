import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { AdminGuard } from '../auth/admin.guard';
import { StaffGuard } from '../auth/staff.guard';
import { UserGuard } from '../auth/user.guard';
import { JwtService } from '@nestjs/jwt';

@Controller('community')
export class CommunityController {
    private readonly logger = new Logger(CommunityController.name);

    constructor(
        private communityService: CommunityService,
        private jwtService: JwtService
    ) { }

    // ==================== MENTORSHIP ENDPOINTS ====================

    /**
     * Get all active mentors with filters
     * GET /community/mentors
     * @query university - Filter by university (optional)
     * @query country - Filter by country (optional)
     * @query loanType - Filter by loan type (optional)
     * @query category - Filter by category (optional)
     * @query limit - Number of mentors (default: 10)
     * @query offset - Skip mentors (default: 0)
     */
    @Get('mentors')
    async getAllMentors(
        @Query('university') university?: string,
        @Query('country') country?: string,
        @Query('loanType') loanType?: string,
        @Query('category') category?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllMentors({
            university,
            country,
            loanType,
            category,
            limit: limit ? parseInt(limit, 10) : 10,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get featured mentors (top-rated)
     * GET /community/mentors/featured
     * @query limit - Number of mentors (default: 6)
     */
    @Get('mentors/featured')
    async getFeaturedMentors(@Query('limit') limit?: string) {
        return this.communityService.getFeaturedMentors(
            limit ? parseInt(limit, 10) : 6,
        );
    }

    /**
     * Get mentor by ID
     * GET /community/mentors/:id
     */
    @Get('mentors/:id')
    async getMentorById(@Param('id') id: string) {
        return this.communityService.getMentorById(id);
    }

    /**
     * Book a mentorship session
     * POST /community/mentors/:id/book
     * @param id - Mentor ID
     * @body studentName, studentEmail, preferredDate, preferredTime, message
     */
    @Post('mentors/:id/book')
    async bookMentorSession(
        @Param('id') mentorId: string,
        @Body()
        body: {
            studentName: string;
            studentEmail: string;
            studentPhone?: string;
            preferredDate: string;
            preferredTime: string;
            message?: string;
        },
    ) {
        return this.communityService.bookMentorSession(mentorId, body);
    }

    /**
     * Submit mentor application
     * POST /community/mentors/apply
     * @body name, email, university, degree, country, loanBank, loanAmount, bio, expertise
     */
    @Post('mentors/apply')
    async applyAsMentor(
        @Body()
        body: {
            name: string;
            email: string;
            phone?: string;
            university: string;
            degree: string;
            country: string;
            loanBank: string;
            loanAmount: string;
            bio: string;
            expertise: string[];
            linkedIn?: string;
        },
    ) {
        return this.communityService.applyAsMentor(body);
    }

    /**
     * Get mentor statistics
     * GET /community/mentors/stats
     */
    @Get('mentors/stats')
    async getMentorStats() {
        return this.communityService.getMentorStats();
    }

    /**
     * Get overall community statistics
     * GET /community/stats
     */
    @Get('stats')
    async getStats() {
        return this.communityService.getCommunityStats();
    }

    // ==================== EVENTS ENDPOINTS ====================

    /**
     * Get all upcoming events
     * GET /community/events
     * @query type - Filter by type (webinar, qa, networking, workshop)
     * @query featured - Filter featured events
     * @query limit - Number of events (default: 10)
     * @query offset - Skip events (default: 0)
     */
    @Get('events')
    async getAllEvents(
        @Query('type') type?: string,
        @Query('category') category?: string,
        @Query('featured') featured?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllEvents({
            type,
            category,
            featured: featured === 'true' ? true : undefined,
            limit: limit ? parseInt(limit, 10) : 10,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get upcoming events only
     * GET /community/events/upcoming
     * @query limit - Number of events (default: 5)
     */
    @Get('events/upcoming')
    async getUpcomingEvents(@Query('limit') limit?: string) {
        return this.communityService.getUpcomingEvents(
            limit ? parseInt(limit, 10) : 5,
        );
    }

    /**
     * Get past events / recordings
     * GET /community/events/past
     * @query limit - Number of events (default: 10)
     * @query offset - Skip events (default: 0)
     */
    @Get('events/past')
    async getPastEvents(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getPastEvents(
            limit ? parseInt(limit, 10) : 10,
            offset ? parseInt(offset, 10) : 0,
        );
    }

    /**
     * Get event by ID
     * GET /community/events/:id
     */
    @Get('events/:id')
    async getEventById(@Param('id') id: string) {
        return this.communityService.getEventById(id);
    }

    /**
     * Register for an event
     * POST /community/events/:id/register
     * @param id - Event ID
     * @body name, email, phone
     */
    @Post('events/:id/register')
    async registerForEvent(
        @Param('id') eventId: string,
        @Body()
        body: {
            name: string;
            email: string;
            phone?: string;
        },
    ) {
        return this.communityService.registerForEvent(eventId, body);
    }

    // ==================== SUCCESS STORIES ENDPOINTS ====================

    /**
     * Get all success stories
     * GET /community/stories
     * @query country - Filter by country
     * @query category - Filter by category (MBA, Engineering, Medical, etc.)
     * @query limit - Number of stories (default: 10)
     * @query offset - Skip stories (default: 0)
     */
    @Get('stories')
    async getAllStories(
        @Query('country') country?: string,
        @Query('category') category?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllStories({
            country,
            category,
            limit: limit ? parseInt(limit, 10) : 10,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get featured success stories
     * GET /community/stories/featured
     * @query limit - Number of stories (default: 6)
     */
    @Get('stories/featured')
    async getFeaturedStories(@Query('limit') limit?: string) {
        return this.communityService.getFeaturedStories(
            limit ? parseInt(limit, 10) : 6,
        );
    }

    /**
     * Get story by ID
     * GET /community/stories/:id
     */
    @Get('stories/:id')
    async getStoryById(@Param('id') id: string) {
        return this.communityService.getStoryById(id);
    }

    /**
     * Submit a success story
     * POST /community/stories/submit
     * @body name, email, university, country, degree, loanAmount, bank, story, tips
     */
    @Post('stories/submit')
    async submitStory(
        @Body()
        body: {
            name: string;
            email: string;
            university: string;
            country: string;
            degree: string;
            loanAmount: string;
            bank: string;
            interestRate?: string;
            story: string;
            tips?: string;
            image?: string;
        },
    ) {
        return this.communityService.submitStory(body);
    }

    // ==================== RESOURCES ENDPOINTS ====================

    /**
     * Get all community resources
     * GET /community/resources
     * @query type - Filter by type (guide, template, checklist, video)
     * @query category - Filter by category
     * @query limit - Number of resources (default: 10)
     * @query offset - Skip resources (default: 0)
     */
    @Get('resources')
    async getAllResources(
        @Query('type') type?: string,
        @Query('category') category?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllResources({
            type,
            category,
            limit: limit ? parseInt(limit, 10) : 10,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get popular resources
     * GET /community/resources/popular
     * @query limit - Number of resources (default: 5)
     */
    @Get('resources/popular')
    async getPopularResources(@Query('limit') limit?: string) {
        return this.communityService.getPopularResources(
            limit ? parseInt(limit, 10) : 5,
        );
    }

    /**
     * Get resource by ID
     * GET /community/resources/:id
     */
    @Get('resources/:id')
    async getResourceById(@Param('id') id: string) {
        return this.communityService.getResourceById(id);
    }

    /**
     * Track resource download/view
     * POST /community/resources/:id/track
     */
    @Post('resources/:id/track')
    async trackResourceView(@Param('id') resourceId: string) {
        return this.communityService.trackResourceView(resourceId);
    }

    // ==================== ADMIN ENDPOINTS ====================

    /**
     * Create a new mentor (Admin)
     * POST /community/admin/mentors
     */
    @Post('admin/mentors')
    @UseGuards(AdminGuard)
    async createMentor(
        @Body()
        body: {
            name: string;
            email: string;
            university: string;
            degree: string;
            country: string;
            loanBank: string;
            loanAmount: string;
            interestRate?: string;
            bio: string;
            expertise: string[];
            rating?: number;
            studentsMentored?: number;
            image?: string;
            isActive?: boolean;
        },
    ) {
        return this.communityService.createMentor(body);
    }

    /**
     * Update mentor (Admin)
     * PUT /community/admin/mentors/:id
     */
    @Put('admin/mentors/:id')
    @UseGuards(AdminGuard)
    async updateMentor(@Param('id') id: string, @Body() body: any) {
        return this.communityService.updateMentor(id, body);
    }

    /**
     * Delete mentor (Admin)
     * DELETE /community/admin/mentors/:id
     */
    @Delete('admin/mentors/:id')
    @UseGuards(AdminGuard)
    async deleteMentor(@Param('id') id: string) {
        return this.communityService.deleteMentor(id);
    }

    /**
     * Create event (Admin)
     * POST /community/admin/events
     */
    @Post('admin/events')
    @UseGuards(AdminGuard)
    async createEvent(
        @Body()
        body: {
            title: string;
            description: string;
            type: string;
            category?: string;
            date: string;
            time: string;
            duration: number;
            speaker?: string;
            speakerTitle?: string;
            maxAttendees?: number;
            isFree?: boolean;
            recordingUrl?: string;
            isFeatured?: boolean;
        },
    ) {
        return this.communityService.createEvent(body);
    }

    /**
     * Update event (Admin)
     * PUT /community/admin/events/:id
     */
    @Put('admin/events/:id')
    @UseGuards(AdminGuard)
    async updateEvent(@Param('id') id: string, @Body() body: any) {
        return this.communityService.updateEvent(id, body);
    }

    /**
     * Delete event (Admin)
     * DELETE /community/admin/events/:id
     */
    @Delete('admin/events/:id')
    @UseGuards(AdminGuard)
    async deleteEvent(@Param('id') id: string) {
        return this.communityService.deleteEvent(id);
    }

    /**
     * Create resource (Admin)
     * POST /community/admin/resources
     */
    @Post('admin/resources')
    @UseGuards(AdminGuard)
    async createResource(
        @Body()
        body: {
            title: string;
            description: string;
            type: string;
            category: string;
            fileUrl?: string;
            downloadUrl?: string;
            thumbnailUrl?: string;
            isFeatured?: boolean;
        },
    ) {
        return this.communityService.createResource(body);
    }

    /**
     * Update resource (Admin)
     * PUT /community/admin/resources/:id
     */
    @Put('admin/resources/:id')
    @UseGuards(AdminGuard)
    async updateResource(@Param('id') id: string, @Body() body: any) {
        return this.communityService.updateResource(id, body);
    }

    /**
     * Delete resource (Admin)
     * DELETE /community/admin/resources/:id
     */
    @Delete('admin/resources/:id')
    @UseGuards(AdminGuard)
    async deleteResource(@Param('id') id: string) {
        return this.communityService.deleteResource(id);
    }

    /**
     * Approve/Reject mentor application (Admin)
     * PUT /community/admin/mentors/:id/approve
     */
    @Put('admin/mentors/:id/approve')
    @UseGuards(AdminGuard)
    async approveMentor(
        @Param('id') id: string,
        @Body() body: { approved: boolean; reason?: string },
    ) {
        return this.communityService.approveMentor(id, body.approved, body.reason);
    }

    /**
     * Create success story (Admin)
     * POST /community/admin/stories
     */
    @Post('admin/stories')
    @UseGuards(AdminGuard)
    async createStory(@Body() body: any) {
        return this.communityService.createStory(body);
    }

    /**
     * Update success story (Admin)
     * PUT /community/admin/stories/:id
     */
    @Put('admin/stories/:id')
    @UseGuards(AdminGuard)
    async updateStory(@Param('id') id: string, @Body() body: any) {
        return this.communityService.updateStory(id, body);
    }

    /**
     * Delete success story (Admin)
     * DELETE /community/admin/stories/:id
     */
    @Delete('admin/stories/:id')
    @UseGuards(AdminGuard)
    async deleteStory(@Param('id') id: string) {
        return this.communityService.deleteStory(id);
    }

    /**
     * Approve/Reject success story (Admin)
     * PUT /community/admin/stories/:id/approve
     */
    @Put('admin/stories/:id/approve')
    @UseGuards(AdminGuard)
    async approveStory(
        @Param('id') id: string,
        @Body() body: { approved: boolean; reason?: string },
    ) {
        return this.communityService.approveStory(id, body.approved, body.reason);
    }

    /**
     * Get all mentor bookings (Admin)
     * GET /community/admin/bookings
     */
    @Get('admin/bookings')
    @UseGuards(AdminGuard)
    async getAllBookings(
        @Query('status') status?: string,
        @Query('mentorId') mentorId?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllBookings({
            status,
            mentorId,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get all event registrations (Admin)
     * GET /community/admin/registrations
     */
    @Get('admin/registrations')
    @UseGuards(AdminGuard)
    async getAllRegistrations(
        @Query('eventId') eventId?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getAllRegistrations({
            eventId,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get community statistics (Admin)
     * GET /community/admin/stats
     */
    @Get('admin/stats')
    @UseGuards(StaffGuard)
    async getCommunityStats() {
        return this.communityService.getCommunityStats();
    }

    // ==================== FORUM ENDPOINTS ====================

    // ==================== FORUM ENDPOINTS ====================

    // ==================== ADMIN FORUM ENDPOINTS ====================

    /**
     * Get all forum posts (Admin)
     * GET /community/admin/forum/posts
     */
    @Get('admin/forum/posts')
    @UseGuards(StaffGuard)
    async getAllForumPostsAdmin(
        @Query('category') category?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('sort') sort?: string,
    ) {
        return this.communityService.getAllForumPostsAdmin({
            category,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
            sort,
        });
    }

    /**
     * Pin/Unpin a forum post (Admin)
     * PUT /community/admin/forum/posts/:id/pin
     */
    @Put('admin/forum/posts/:id/pin')
    @UseGuards(AdminGuard)
    async togglePinForumPost(
        @Param('id') id: string,
        @Body() body: { isPinned: boolean }
    ) {
        return this.communityService.togglePinForumPost(id, body.isPinned);
    }

    /**
     * Search for similar/duplicate forum posts (pre-post duplicate check)
     * GET /community/forum/search?q=my+question+title
     * IMPORTANT: Must be declared BEFORE forum/:id to avoid being captured by the dynamic param route.
     */
    @Get('forum/search')
    async searchForumPosts(@Query('q') q?: string) {
        return this.communityService.searchSimilarPosts(q || '');
    }

    @Get('forum/:id')
    async getForumPostById(@Param('id') id: string, @Request() req) {
        let userId: string | undefined;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const decoded = this.jwtService.decode(token) as any;
                if (decoded && decoded.id) {
                    userId = decoded.id;
                }
            }
        } catch (e) {
            // ignore token errors
        }
        return this.communityService.getForumPostById(id, userId);
    }

    /**
     * Get all forum posts (Admin/Public)
     * GET /community/forum
     */
    @Get('forum')
    async getForumPosts(
        @Query('category') category?: string,
        @Query('tag') tag?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('sort') sort?: string,
        @Request() req?,
    ) {
        let userId: string | undefined;
        // Try to get user ID if token present
        try {
            if (req.headers.authorization) {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = this.jwtService.decode(token) as any;
                userId = decoded?.id;
            }
        } catch (e: any) {
            this.logger.debug(`Failed to decode auth token in getForumPosts: ${e?.message}`);
        }

        return this.communityService.getForumPosts({
            category,
            tag,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
            sort
        }, userId);
    }

    /**
     * Compatibility: GET /community/posts (alias for /community/forum)
     */
    @Get('posts')
    async getPostsAlias(
        @Query('topic') topic?: string,
        @Query('page') page?: string,
        @Request() req?,
    ) {
        // Map topic/page to category/offset
        const category = topic;
        const offset = page ? (parseInt(page, 10) - 1) * 20 : 0;
        let userId: string | undefined;
        try {
            if (req?.headers?.authorization) {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = this.jwtService.decode(token) as any;
                userId = decoded?.id;
            }
        } catch (e: any) {
            this.logger.debug(`Failed to decode auth token in getPostsAlias: ${e?.message}`);
        }

        return this.communityService.getForumPosts({ category, limit: 20, offset }, userId);
    }



    /**
     * GET /community/hubs - list of available hub categories
     */
    @Get('hubs')
    async getHubs() {
        return this.communityService.getHubs();
    }

    /**
     * Compatibility: GET /community/posts/:id -> fetch single forum post by id
     */
    @Get('posts/:id')
    async getPostByIdAlias(@Param('id') id: string, @Request() req) {
        let userId: string | undefined;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const decoded = this.jwtService.decode(token) as any;
                if (decoded && decoded.id) {
                    userId = decoded.id;
                }
            }
        } catch (e: any) {
            this.logger.debug(`Failed to decode auth token in getPostByIdAlias: ${e?.message}`);
        }

        return this.communityService.getForumPostById(id, userId);
    }

    /**
     * Compatibility: POST /community/posts to create a new forum post (requires auth)
     */
    @Post('posts')
    @UseGuards(UserGuard)
    async createPostAlias(@Request() req, @Body() body: any) {
        // Enforce allowed categories server-side to prevent off-topic posts
        const allowedCategories = [
            'Education Loans',
            'Universities',
            'Courses',
            'Exams',
            'GRE / GMAT',
            'IELTS / TOEFL',
            'Scholarship',
            'Visa & Immigration',
            'Career & Jobs',
            'General'
        ];

        const providedCategory = (body && body.category) ? String(body.category).trim() : '';
        const isAllowed = allowedCategories.some(c => c.toLowerCase() === providedCategory.toLowerCase());
        if (!providedCategory || !isAllowed) {
            throw new HttpException({
                success: false,
                message: 'Category not allowed. Please choose one of: ' + allowedCategories.join(', '),
                allowedCategories,
            }, HttpStatus.BAD_REQUEST);
        }

        // If the client did not explicitly force posting, run AI duplicate-check first
        const force = body && body.force === true;
        if (!force) {
            try {
                const dup = await this.communityService.checkDuplicateQuestion({
                    title: body.title || '',
                    content: body.content || '',
                    category: body.category || 'General'
                });

                if (dup && dup.isDuplicate) {
                    // Respond with 409 Conflict and include similar questions for client to show UI
                    throw new HttpException({
                        success: false,
                        message: 'Similar questions found',
                        isDuplicate: true,
                        similarQuestions: dup.similarQuestions || []
                    }, HttpStatus.CONFLICT);
                }
            } catch (err) {
                // If the duplicate check threw an HttpException (e.g., to indicate duplicates), rethrow
                if (err instanceof HttpException) throw err;
                // Otherwise, log and continue to allow posting (fail-open)
                console.error('[CommunityController] duplicate check failed, continuing to create post', err);
            }
        }

        return this.communityService.createForumPost(req.user.id, body);
    }

    @Post('forum/:id/comment')
    @UseGuards(UserGuard)
    async createForumComment(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { content: string; parentId?: string },
    ) {
        return this.communityService.createForumComment(
            req.user.id,
            id,
            body.content,
            body.parentId,
        );
    }

    @Post('forum/comments/:id/like')
    @UseGuards(UserGuard)
    async likeForumComment(
        @Request() req,
        @Param('id') id: string
    ) {
        return this.communityService.likeForumComment(req.user.id, id);
    }

    @Post('forum/:id/like')
    @UseGuards(UserGuard)
    async likeForumPost(
        @Request() req,
        @Param('id') id: string
    ) {
        return this.communityService.likeForumPost(req.user.id, id);
    }

    @Post('forum/:id/share')
    @UseGuards(UserGuard)
    async shareForumPost(@Param('id') id: string) {
        return this.communityService.shareForumPost(id);
    }

    /**
     * Delete a forum post (Admin only)
     * DELETE /community/forum/:id
     */
    @Delete('forum/:id')
    @UseGuards(UserGuard)
    async deleteForumPost(
        @Request() req,
        @Param('id') id: string
    ) {
        // Only admins can delete posts
        if (req.user.role !== 'admin') {
            throw new HttpException('Only admins can delete posts', HttpStatus.FORBIDDEN);
        }
        return this.communityService.deleteForumPost(id);
    }

    /**
     * Delete a forum comment (Comment author or Admin)
     * DELETE /community/forum/comments/:id
     */
    @Delete('forum/comments/:id')
    @UseGuards(UserGuard)
    async deleteForumComment(
        @Request() req,
        @Param('id') id: string
    ) {
        return this.communityService.deleteForumComment(req.user.id, req.user.role, id);
    }

    /**
     * Check for duplicate questions using AI
     * POST /community/forum/check-duplicate
     * @body title, content, category
     */
    @Post('forum/check-duplicate')
    async checkDuplicateQuestion(
        @Body() body: {
            title: string;
            content: string;
            category: string;
        }
    ) {
        const result = await this.communityService.checkDuplicateQuestion(body);
        return {
            success: true,
            ...result
        };
    }

    // ==================== MENTOR DASHBOARD ENDPOINTS ====================

    /**
     * Request Mentor OTP
     * POST /community/mentor/request-otp
     * @body email
     */
    @Post('mentor/request-otp')
    async requestMentorOTP(@Body() body: { email: string }) {
        return this.communityService.requestMentorOTP(body.email);
    }

    /**
     * Verify Mentor OTP & Login
     * POST /community/mentor/verify-otp
     * @body email, otp
     */
    @Post('mentor/verify-otp')
    async verifyMentorOTP(@Body() body: { email: string; otp: string }) {
        return this.communityService.verifyMentorOTP(body.email, body.otp);
    }

    /**
     * Get Mentor Profile & Stats
     * GET /community/mentor/profile/:id
     */
    @Get('mentor/profile/:id')
    async getMentorProfile(@Param('id') mentorId: string) {
        return this.communityService.getMentorProfile(mentorId);
    }

    /**
     * Get Mentor's Bookings
     * GET /community/mentor/:id/bookings
     */
    @Get('mentor/:id/bookings')
    async getMentorBookings(
        @Param('id') mentorId: string,
        @Query('status') status?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.communityService.getMentorBookings(mentorId, {
            status,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Update Booking Status (Mentor)
     * PUT /community/mentor/:mentorId/bookings/:bookingId
     */
    @Put('mentor/:mentorId/bookings/:bookingId')
    async updateBookingStatus(
        @Param('mentorId') mentorId: string,
        @Param('bookingId') bookingId: string,
        @Body() body: { status: string },
    ) {
        return this.communityService.updateBookingStatus(
            mentorId,
            bookingId,
            body.status,
        );
    }

    /**
     * Update Mentor Profile
     * PUT /community/mentor/:id/profile
     */
    @Put('mentor/:id/profile')
    async updateMentorProfile(
        @Param('id') mentorId: string,
        @Body() body: any,
    ) {
        return this.communityService.updateMentorProfile(mentorId, body);
    }
}
