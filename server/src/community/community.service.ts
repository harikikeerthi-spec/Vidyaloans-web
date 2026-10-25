import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { randomInt } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { OpenRouterService } from '../ai/services/openrouter.service';

@Injectable()
export class CommunityService {
  private get db() {
    return this.supabase.getClient();
  }

  private otpStore = new Map<string, { otp: string; expiresAt: Date; attempts: number; lockedUntil?: number }>();

  constructor(
    private supabase: SupabaseService,
    private openRouterService: OpenRouterService,
  ) {}

  // ==================== MENTORSHIP METHODS ====================

  async getAllMentors(filters: any) {
    const { university, country, loanType, category, limit, offset } = filters;

    let query = this.db
      .from('Mentor')
      .select('*', { count: 'exact' })
      .eq('isActive', true)
      .eq('isApproved', true)
      .order('rating', { ascending: false })
      .order('studentsMentored', { ascending: false });

    if (university) query = query.ilike('university', `%${university}%`);
    if (country) query = query.ilike('country', `%${country}%`);
    if (loanType) query = query.ilike('loanType', `%${loanType}%`);
    if (category) query = query.ilike('category', `%${category}%`);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: mentors, count } = await query;
    return { success: true, data: mentors || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (mentors?.length || 0) < (count || 0) } };
  }

  async getFeaturedMentors(limit: number) {
    const { data } = await this.db.from('Mentor').select('*').eq('isActive', true).eq('isApproved', true).gte('rating', 4.5).order('rating', { ascending: false }).order('studentsMentored', { ascending: false }).limit(limit);
    return { success: true, data: data || [] };
  }

  async getMentorById(id: string) {
    const { data: mentor } = await this.db.from('Mentor').select('*').eq('id', id).single();
    if (!mentor) throw new NotFoundException('Mentor not found');
    return { success: true, data: mentor };
  }

  async bookMentorSession(mentorId: string, bookingData: any) {
    const { data: mentor } = await this.db.from('Mentor').select('id, isActive').eq('id', mentorId).single();
    if (!mentor) throw new NotFoundException('Mentor not found');
    if (!mentor.isActive) throw new BadRequestException('Mentor is not currently accepting bookings');

    const { data: booking, error } = await this.db.from('MentorBooking').insert({ mentorId, ...bookingData, status: 'pending' }).select().single();
    if (error) throw error;
    return { success: true, message: 'Booking request submitted successfully', data: booking };
  }

  async applyAsMentor(applicationData: any) {
    if (!applicationData?.email) throw new BadRequestException('Email is required');
    if (!applicationData.name) throw new BadRequestException('Name is required');
    if (!applicationData.university) throw new BadRequestException('University is required');
    if (!applicationData.country) throw new BadRequestException('Country is required');

    const { data: existing } = await this.db.from('Mentor').select('id').eq('email', applicationData.email).single();
    if (existing) throw new BadRequestException('A mentor with this email already exists');

    const { data: mentor, error } = await this.db.from('Mentor').insert({
      name: applicationData.name, email: applicationData.email, phone: applicationData.phone || null,
      university: applicationData.university, degree: applicationData.degree || '', country: applicationData.country,
      loanBank: applicationData.loanBank || '', loanAmount: applicationData.loanAmount || '',
      interestRate: applicationData.interestRate || null, loanType: applicationData.loanType || null,
      category: applicationData.category || null, bio: applicationData.bio || '',
      expertise: applicationData.expertise || [], linkedIn: applicationData.linkedIn || null,
      image: applicationData.image || null, isActive: false, isApproved: false, rating: 0, studentsMentored: 0,
    }).select().single();
    if (error) throw error;
    return { success: true, message: 'Mentor application submitted successfully. We will review and get back to you soon.', data: mentor };
  }

  async getMentorStats() {
    const [{ count: total }, { count: active }, { data: mentors }] = await Promise.all([
      this.db.from('Mentor').select('*', { count: 'exact', head: true }).eq('isApproved', true),
      this.db.from('Mentor').select('*', { count: 'exact', head: true }).eq('isActive', true).eq('isApproved', true),
      this.db.from('Mentor').select('rating, studentsMentored').eq('isApproved', true),
    ]);

    const avgRating = mentors?.length ? mentors.reduce((s: number, m: any) => s + (m.rating || 0), 0) / mentors.length : 0;
    const totalMentored = mentors?.reduce((s: number, m: any) => s + (m.studentsMentored || 0), 0) || 0;

    return { success: true, data: { totalMentors: total || 0, activeMentors: active || 0, averageRating: avgRating, totalStudentsMentored: totalMentored } };
  }

  // ==================== EVENTS METHODS ====================

  async getAllEvents(filters: any) {
    const { type, category, featured, limit, offset } = filters;

    let query = this.db.from('CommunityEvent').select('*', { count: 'exact' }).order('date', { ascending: true });
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (featured !== undefined) query = query.eq('isFeatured', featured);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: events, count } = await query;
    return { success: true, data: events || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (events?.length || 0) < (count || 0) } };
  }

  async getUpcomingEvents(limit: number) {
    const { data } = await this.db.from('CommunityEvent').select('*').gte('date', new Date().toISOString()).order('date', { ascending: true }).limit(limit);
    return { success: true, data: data || [] };
  }

  async getPastEvents(limit: number, offset: number) {
    const { data, count } = await this.db.from('CommunityEvent').select('*', { count: 'exact' }).lt('date', new Date().toISOString()).order('date', { ascending: false }).range(offset, offset + limit - 1);
    return { success: true, data: data || [], pagination: { total: count || 0, limit, offset, hasMore: offset + (data?.length || 0) < (count || 0) } };
  }

  async getEventById(id: string) {
    const { data: event } = await this.db.from('CommunityEvent').select('*').eq('id', id).single();
    if (!event) throw new NotFoundException('Event not found');
    const { count: registeredCount } = await this.db.from('EventRegistration').select('*', { count: 'exact', head: true }).eq('eventId', id);
    return { success: true, data: { ...event, registeredCount: registeredCount || 0 } };
  }

  async registerForEvent(eventId: string, registrationData: any) {
    const { data: event } = await this.db.from('CommunityEvent').select('*').eq('id', eventId).single();
    if (!event) throw new NotFoundException('Event not found');
    if (new Date(event.date) < new Date()) throw new BadRequestException('Cannot register for past events');

    const { count: registeredCount } = await this.db.from('EventRegistration').select('*', { count: 'exact', head: true }).eq('eventId', eventId);
    if (event.maxAttendees && (registeredCount || 0) >= event.maxAttendees) throw new BadRequestException('Event is full');

    const { data: existingReg } = await this.db.from('EventRegistration').select('id').eq('eventId', eventId).eq('email', registrationData.email).single();
    if (existingReg) throw new BadRequestException('You are already registered for this event');

    const { data: registration, error } = await this.db.from('EventRegistration').insert({ eventId, ...registrationData }).select().single();
    if (error) throw error;

    await this.db.from('CommunityEvent').update({ attendeesCount: (event.attendeesCount || 0) + 1 }).eq('id', eventId);
    return { success: true, message: 'Successfully registered for the event', data: registration };
  }

  // ==================== SUCCESS STORIES METHODS ====================

  async getAllStories(filters: any) {
    const { country, category, limit, offset } = filters;

    let query = this.db.from('SuccessStory').select('*', { count: 'exact' }).eq('isApproved', true).order('createdAt', { ascending: false });
    if (country) query = query.ilike('country', `%${country}%`);
    if (category) query = query.ilike('category', `%${category}%`);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: stories, count } = await query;
    return { success: true, data: stories || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (stories?.length || 0) < (count || 0) } };
  }

  async getFeaturedStories(limit: number) {
    const { data } = await this.db.from('SuccessStory').select('*').eq('isApproved', true).eq('isFeatured', true).order('createdAt', { ascending: false }).limit(limit);
    return { success: true, data: data || [] };
  }

  async getStoryById(id: string) {
    const { data: story } = await this.db.from('SuccessStory').select('*').eq('id', id).single();
    if (!story) throw new NotFoundException('Story not found');
    return { success: true, data: story };
  }

  async submitStory(storyData: any) {
    const { data: story, error } = await this.db.from('SuccessStory').insert({ ...storyData, isApproved: false, isFeatured: false }).select().single();
    if (error) throw error;
    return { success: true, message: 'Success story submitted successfully. We will review and publish it soon.', data: story };
  }

  // ==================== RESOURCES METHODS ====================

  async getAllResources(filters: any) {
    const { type, category, limit, offset } = filters;

    let query = this.db.from('CommunityResource').select('*', { count: 'exact' }).order('createdAt', { ascending: false });
    if (type) query = query.eq('type', type);
    if (category) query = query.ilike('category', `%${category}%`);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: resources, count } = await query;
    return { success: true, data: resources || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (resources?.length || 0) < (count || 0) } };
  }

  async getPopularResources(limit: number) {
    const { data } = await this.db.from('CommunityResource').select('*').order('downloads', { ascending: false }).limit(limit);
    return { success: true, data: data || [] };
  }

  async getResourceById(id: string) {
    const { data: resource } = await this.db.from('CommunityResource').select('*').eq('id', id).single();
    if (!resource) throw new NotFoundException('Resource not found');
    return { success: true, data: resource };
  }

  async trackResourceView(resourceId: string) {
    const { data: resource } = await this.db.from('CommunityResource').select('downloads').eq('id', resourceId).single();
    const { data: updated } = await this.db.from('CommunityResource').update({ downloads: (resource?.downloads || 0) + 1 }).eq('id', resourceId).select('downloads').single();
    return { success: true, data: { downloads: updated?.downloads } };
  }

  // ==================== ADMIN METHODS ====================

  async createMentor(mentorData: any) {
    const { data: mentor, error } = await this.db.from('Mentor').insert({ ...mentorData, expertise: mentorData.expertise || [], isActive: mentorData.isActive !== undefined ? mentorData.isActive : true, isApproved: true, rating: mentorData.rating || 0, studentsMentored: mentorData.studentsMentored || 0 }).select().single();
    if (error) throw error;
    return { success: true, message: 'Mentor created successfully', data: mentor };
  }

  async updateMentor(id: string, updateData: any) {
    const { data: mentor, error } = await this.db.from('Mentor').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: 'Mentor updated successfully', data: mentor };
  }

  async deleteMentor(id: string) {
    await this.db.from('Mentor').delete().eq('id', id);
    return { success: true, message: 'Mentor deleted successfully' };
  }

  async createEvent(eventData: any) {
    const { data: event, error } = await this.db.from('CommunityEvent').insert({ ...eventData, attendeesCount: 0, isFeatured: eventData.isFeatured || false }).select().single();
    if (error) throw error;
    return { success: true, message: 'Event created successfully', data: event };
  }

  async updateEvent(id: string, updateData: any) {
    const { data: event, error } = await this.db.from('CommunityEvent').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: 'Event updated successfully', data: event };
  }

  async deleteEvent(id: string) {
    await this.db.from('CommunityEvent').delete().eq('id', id);
    return { success: true, message: 'Event deleted successfully' };
  }

  async createResource(resourceData: any) {
    const { data: resource, error } = await this.db.from('CommunityResource').insert({ ...resourceData, downloads: 0, isFeatured: resourceData.isFeatured || false }).select().single();
    if (error) throw error;
    return { success: true, message: 'Resource created successfully', data: resource };
  }

  async updateResource(id: string, updateData: any) {
    const { data: resource, error } = await this.db.from('CommunityResource').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: 'Resource updated successfully', data: resource };
  }

  async deleteResource(id: string) {
    await this.db.from('CommunityResource').delete().eq('id', id);
    return { success: true, message: 'Resource deleted successfully' };
  }

  async createStory(storyData: any) {
    const { data: story, error } = await this.db.from('SuccessStory').insert({ ...storyData, isApproved: storyData.isApproved !== undefined ? storyData.isApproved : true, isFeatured: storyData.isFeatured || false }).select().single();
    if (error) throw error;
    return { success: true, message: 'Success story created successfully', data: story };
  }

  async updateStory(id: string, updateData: any) {
    const { data: story, error } = await this.db.from('SuccessStory').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: 'Success story updated successfully', data: story };
  }

  async deleteStory(id: string) {
    await this.db.from('SuccessStory').delete().eq('id', id);
    return { success: true, message: 'Success story deleted successfully' };
  }

  async approveMentor(id: string, approved: boolean, reason?: string) {
    const { data: mentor, error } = await this.db.from('Mentor').update({ isApproved: approved, isActive: approved, rejectionReason: approved ? null : reason }).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: approved ? 'Mentor approved' : 'Mentor rejected', data: mentor };
  }

  async approveStory(id: string, approved: boolean, reason?: string) {
    const { data: story, error } = await this.db.from('SuccessStory').update({ isApproved: approved, rejectionReason: approved ? null : reason }).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, message: approved ? 'Story approved' : 'Story rejected', data: story };
  }

  async getAllBookings(filters: any) {
    const { status, mentorId, limit, offset } = filters;

    let query = this.db.from('MentorBooking').select('*, mentor:Mentor!mentorId(name, email, university)', { count: 'exact' }).order('createdAt', { ascending: false });
    if (status) query = query.eq('status', status);
    if (mentorId) query = query.eq('mentorId', mentorId);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: bookings, count } = await query;
    return { success: true, data: bookings || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (bookings?.length || 0) < (count || 0) } };
  }

  async getAllRegistrations(filters: any) {
    const { eventId, limit, offset } = filters;

    let query = this.db.from('EventRegistration').select('*, event:CommunityEvent!eventId(title, date, type)', { count: 'exact' }).order('createdAt', { ascending: false });
    if (eventId) query = query.eq('eventId', eventId);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: registrations, count } = await query;
    return { success: true, data: registrations || [], pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (registrations?.length || 0) < (count || 0) } };
  }

  async getCommunityStats() {
    const [
      { count: mentorCount },
      { count: eventCount },
      { count: storyCount },
      { count: resourceCount },
      { count: bookingCount },
      { count: registrationCount },
      { count: forumPostCount },
    ] = await Promise.all([
      this.db.from('Mentor').select('*', { count: 'exact', head: true }).eq('isApproved', true),
      this.db.from('CommunityEvent').select('*', { count: 'exact', head: true }),
      this.db.from('SuccessStory').select('*', { count: 'exact', head: true }).eq('isApproved', true),
      this.db.from('CommunityResource').select('*', { count: 'exact', head: true }),
      this.db.from('MentorBooking').select('*', { count: 'exact', head: true }),
      this.db.from('EventRegistration').select('*', { count: 'exact', head: true }),
      this.db.from('ForumPost').select('*', { count: 'exact', head: true }),
    ]);

    return { success: true, data: { mentors: mentorCount || 0, events: eventCount || 0, stories: storyCount || 0, resources: resourceCount || 0, bookings: bookingCount || 0, registrations: registrationCount || 0, forumPosts: forumPostCount || 0 } };
  }

  // ==================== FORUM/TOPIC METHODS ====================

  async getForumPosts(filters: any, userId?: string) {
    const { category, tag, limit, offset, sort } = filters;

    let query = this.db
      .from('ForumPost')
      .select('*, author:User!authorId(firstName, lastName, role), commentCount:ForumComment(count)', { count: 'exact' })
      .order(sort === 'popular' ? 'likes' : 'createdAt', { ascending: false });

    if (category) query = query.ilike('category', `%${category}%`);
    if (tag) query = query.contains('tags', [tag]);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: posts, count } = await query;

    // Check which posts are liked by the userId
    let likedPostIds = new Set<string>();
    if (userId && posts && posts.length > 0) {
      const { data: likedPosts } = await this.db
        .from('PostLike')
        .select('postId')
        .eq('userId', userId)
        .in('postId', posts.map((p: any) => p.id));
      likedPostIds = new Set((likedPosts || []).map((l: any) => l.postId));
    }

    return {
      success: true,
      data: (posts || []).map((post: any) => ({
        ...post,
        commentCount: Array.isArray(post.commentCount) ? post.commentCount.length : (post.commentCount || 0),
        liked: likedPostIds.has(post.id),
      })),
      pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (posts?.length || 0) < (count || 0) },
    };
  }

  async getForumPostById(id: string, userId?: string) {
    const { data: post } = await this.db
      .from('ForumPost')
      .select('*, author:User!authorId(firstName, lastName, id, role), comments:ForumComment!postId(*, author:User!authorId(firstName, lastName, id, role), replies:ForumComment!parentId(*, author:User!authorId(firstName, lastName, id, role)))')
      .eq('id', id)
      .single();

    if (!post) throw new NotFoundException('Post not found');

    // Increment views
    this.db.from('ForumPost').update({ views: (post.views || 0) + 1 }).eq('id', id).then(() => {});

    let liked = false;
    const likedCommentIds = new Set<string>();

    if (userId) {
      const { data: postLike } = await this.db.from('PostLike').select('id').eq('postId', id).eq('userId', userId).single();
      liked = !!postLike;

      const allCommentIds: string[] = [];
      (post.comments || []).forEach((c: any) => {
        allCommentIds.push(c.id);
        (c.replies || []).forEach((r: any) => allCommentIds.push(r.id));
      });

      if (allCommentIds.length > 0) {
        const { data: commentLikes } = await this.db.from('ForumCommentLike').select('commentId').eq('userId', userId).in('commentId', allCommentIds);
        (commentLikes || []).forEach((l: any) => likedCommentIds.add(l.commentId));
      }
    }

    const topLevelComments = (post.comments || []).filter((c: any) => !c.parentId);
    const commentsWithLikes = topLevelComments.map((c: any) => ({
      ...c,
      liked: likedCommentIds.has(c.id),
      replies: (c.replies || []).map((r: any) => ({ ...r, liked: likedCommentIds.has(r.id) })),
    }));

    return { success: true, data: { ...post, comments: commentsWithLikes, commentCount: (post.comments || []).length, liked } };
  }

  async searchSimilarPosts(query: string) {
    if (!query || query.trim().length < 3) return { success: true, data: [] };

    const stopwords = new Set(['the', 'and', 'for', 'how', 'can', 'what', 'why', 'which', 'does', 'are', 'was', 'get', 'not', 'any', 'but', 'you', 'your', 'that', 'this', 'have', 'with', 'will', 'from', 'its', 'into', 'than', 'then', 'about']);
    const keywords = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !stopwords.has(w));
    if (keywords.length === 0) return { success: true, data: [] };

    // Search posts matching any keyword
    const { data: posts } = await this.db
      .from('ForumPost')
      .select('id, title, category, createdAt, comments:ForumComment(count)')
      .or(keywords.map((kw) => `title.ilike.%${kw}%`).join(','))
      .order('createdAt', { ascending: false })
      .limit(20);

    const scored = (posts || []).map((p: any) => {
      const t = (p.title || '').toLowerCase();
      const score = keywords.reduce((acc: number, kw: string) => acc + (t.includes(kw) ? 1 : 0), 0);
      return { ...p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top5 = scored.slice(0, 5).map(({ score, ...p }: any) => ({
      ...p,
      commentCount: Array.isArray(p.comments) ? p.comments.length : 0,
    }));

    return { success: true, data: top5 };
  }

  async getHubs() {
    try {
      const { data } = await this.db.from('ForumPost').select('category').order('category', { ascending: true });
      const unique = Array.from(new Set((data || []).map((r: any) => r.category).filter(Boolean)));
      return { success: true, data: unique };
    } catch (error) {
      console.error('[CommunityService] getHubs failed:', error);
      return { success: true, data: [] };
    }
  }

  async createForumPost(userId: string, data: any) {
    const { data: user } = await this.db.from('User').select('id').eq('id', userId).single();
    if (!user) throw new NotFoundException('User not found');

    // Idempotency check
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentPost } = await this.db
      .from('ForumPost')
      .select('*')
      .eq('authorId', userId)
      .eq('title', data.title)
      .gte('createdAt', sixtySecondsAgo)
      .single();

    if (recentPost && data.force !== true) {
      return { success: true, message: 'Post already created recently', data: recentPost, isDuplicate: true };
    }

    const { data: post, error } = await this.db
      .from('ForumPost')
      .insert({ title: data.title, content: data.content, category: data.category || 'General', tags: data.tags || [], authorId: userId, isMentorOnly: data.isMentorOnly || false, updatedAt: new Date().toISOString() })
      .select('*, author:User!authorId(firstName, lastName, role, id)')
      .single();

    if (error) throw error;
    return { success: true, message: 'Post created successfully', data: post };
  }

  async createForumComment(userId: string, postId: string, content: string, parentId?: string) {
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const { data: recentComment } = await this.db.from('ForumComment').select('*').eq('authorId', userId).eq('postId', postId).eq('content', content).gte('createdAt', tenSecondsAgo).single();
    if (recentComment) return { success: true, data: recentComment };

    const { data: post } = await this.db.from('ForumPost').select('id').eq('id', postId).single();
    if (!post) throw new NotFoundException('Post not found');

    const { data: comment, error } = await this.db.from('ForumComment').insert({ content, postId, authorId: userId, parentId: parentId || null, updatedAt: new Date().toISOString() }).select('*, author:User!authorId(firstName, lastName, role)').single();
    if (error) throw error;
    return { success: true, message: 'Comment added successfully', data: comment };
  }

  async likeForumComment(userId: string, id: string) {
    try {
      const { data: existing } = await this.db.from('ForumCommentLike').select('id').eq('commentId', id).eq('userId', userId).single();
      const { data: comment } = await this.db.from('ForumComment').select('likes').eq('id', id).single();
      const currentLikes = comment?.likes || 0;

      if (existing) {
        await this.db.from('ForumCommentLike').delete().eq('id', existing.id);
        await this.db.from('ForumComment').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', id);
        const { data: updated } = await this.db.from('ForumComment').select('likes').eq('id', id).single();
        return { success: true, likes: updated?.likes || 0, liked: false };
      } else {
        await this.db.from('ForumCommentLike').insert({ commentId: id, userId });
        await this.db.from('ForumComment').update({ likes: currentLikes + 1 }).eq('id', id);
        const { data: updated } = await this.db.from('ForumComment').select('likes').eq('id', id).single();
        return { success: true, likes: updated?.likes || 0, liked: true };
      }
    } catch (error) {
      console.error('[CommunityService] likeForumComment failed:', error);
      throw new BadRequestException('Failed to process like action on comment');
    }
  }

  async likeForumPost(userId: string, id: string) {
    try {
      const { data: existing } = await this.db.from('PostLike').select('id').eq('postId', id).eq('userId', userId).single();
      const { data: post } = await this.db.from('ForumPost').select('likes').eq('id', id).single();
      const currentLikes = post?.likes || 0;

      if (existing) {
        await this.db.from('PostLike').delete().eq('id', existing.id);
        await this.db.from('ForumPost').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', id);
        const { data: updated } = await this.db.from('ForumPost').select('likes').eq('id', id).single();
        return { success: true, likes: updated?.likes || 0, liked: false };
      } else {
        await this.db.from('PostLike').insert({ postId: id, userId });
        await this.db.from('ForumPost').update({ likes: currentLikes + 1 }).eq('id', id);
        const { data: updated } = await this.db.from('ForumPost').select('likes').eq('id', id).single();
        return { success: true, likes: updated?.likes || 0, liked: true };
      }
    } catch (error) {
      console.error('[CommunityService] likeForumPost failed:', error);
      throw new BadRequestException('Failed to process like action on post');
    }
  }

  async shareForumPost(id: string) {
    try {
      const { data: post } = await this.db.from('ForumPost').select('views').eq('id', id).single();
      await this.db.from('ForumPost').update({ views: (post?.views || 0) + 1 }).eq('id', id);
      return { success: true, message: 'Post shared' };
    } catch (error) {
      throw new NotFoundException('Post not found');
    }
  }

  async deleteForumPost(id: string) {
    try {
      await this.db.from('ForumPost').delete().eq('id', id);
      return { success: true, message: 'Post deleted successfully' };
    } catch (error) {
      throw new NotFoundException('Post not found');
    }
  }

  async deleteForumComment(userId: string, userRole: string, commentId: string) {
    const { data: comment } = await this.db.from('ForumComment').select('id, authorId').eq('id', commentId).single();
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && userRole !== 'admin') throw new HttpException('You can only delete your own comments', HttpStatus.FORBIDDEN);
    await this.db.from('ForumComment').delete().eq('id', commentId);
    return { success: true, message: 'Comment deleted successfully' };
  }

  // ==================== MENTOR AUTH & DASHBOARD METHODS ====================

  async requestMentorOTP(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const { data: mentor } = await this.db.from('Mentor').select('*').eq('email', cleanEmail).single();
    if (!mentor) throw new NotFoundException('Mentor not found with this email');
    if (!mentor.isApproved) throw new BadRequestException('Your mentor application is pending approval');
    if (!mentor.isActive) throw new BadRequestException('Your mentor account is not active');

    const existing = this.otpStore.get(cleanEmail);
    if (existing?.lockedUntil && Date.now() < existing.lockedUntil) {
      const remainingMins = Math.ceil((existing.lockedUntil - Date.now()) / 60000);
      throw new BadRequestException(`Account verification is locked due to too many failed attempts. Please try again in ${remainingMins} minute(s).`);
    }

    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.otpStore.set(cleanEmail, { otp, expiresAt, attempts: 0 });

    return {
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      data: { email: cleanEmail, expiresIn: 300 }
    };
  }

  async verifyMentorOTP(email: string, otp: string) {
    const cleanEmail = email.toLowerCase().trim();
    const { data: mentor } = await this.db.from('Mentor').select('*').eq('email', cleanEmail).single();
    if (!mentor) throw new NotFoundException('Mentor not found');

    const storedOTP = this.otpStore.get(cleanEmail);
    if (!storedOTP) throw new BadRequestException('OTP not found. Please request a new OTP.');

    if (storedOTP.lockedUntil && Date.now() < storedOTP.lockedUntil) {
      const remainingMins = Math.ceil((storedOTP.lockedUntil - Date.now()) / 60000);
      throw new BadRequestException(`Account is locked due to too many failed attempts. Please try again in ${remainingMins} minute(s).`);
    }

    if (new Date() > storedOTP.expiresAt) {
      this.otpStore.delete(cleanEmail);
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    if (storedOTP.otp !== otp.trim()) {
      storedOTP.attempts = (storedOTP.attempts || 0) + 1;
      if (storedOTP.attempts >= 5) {
        storedOTP.lockedUntil = Date.now() + 15 * 60 * 1000;
        throw new BadRequestException('Too many incorrect OTP attempts (5/5). Account verification locked for 15 minutes.');
      }
      const remaining = 5 - storedOTP.attempts;
      throw new BadRequestException(`Invalid OTP. Please try again. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`);
    }

    this.otpStore.delete(cleanEmail);
    return { success: true, message: 'Login successful', data: { id: mentor.id, name: mentor.name, email: mentor.email, university: mentor.university, isApproved: mentor.isApproved, isActive: mentor.isActive } };
  }

  async getMentorProfile(mentorId: string) {
    const { data: mentor } = await this.db.from('Mentor').select('*').eq('id', mentorId).single();
    if (!mentor) throw new NotFoundException('Mentor not found');

    const { data: bookings } = await this.db.from('MentorBooking').select('status').eq('mentorId', mentorId);
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    (bookings || []).forEach((b: any) => { stats.total++; if (stats[b.status] !== undefined) stats[b.status]++; });

    return { success: true, data: { mentor, stats } };
  }

  async getMentorBookings(mentorId: string, filters: any) {
    const { status, limit, offset } = filters;

    let query = this.db.from('MentorBooking').select('*', { count: 'exact' }).eq('mentorId', mentorId).order('createdAt', { ascending: false });
    if (status) query = query.eq('status', status);
    if (limit) query = query.limit(limit || 20);
    if (offset) query = query.range(offset || 0, (offset || 0) + (limit || 20) - 1);

    const { data: bookings, count } = await query;
    return { success: true, data: bookings || [], pagination: { total: count || 0, limit: limit || 20, offset: offset || 0, hasMore: (offset || 0) + (bookings?.length || 0) < (count || 0) } };
  }

  async updateBookingStatus(mentorId: string, bookingId: string, status: string) {
    const { data: booking } = await this.db.from('MentorBooking').select('id').eq('id', bookingId).eq('mentorId', mentorId).single();
    if (!booking) throw new NotFoundException('Booking not found or not authorized');

    const { data: updatedBooking, error } = await this.db.from('MentorBooking').update({ status }).eq('id', bookingId).select().single();
    if (error) throw error;
    return { success: true, message: `Booking ${status} successfully`, data: updatedBooking };
  }

  async updateMentorProfile(mentorId: string, updateData: any) {
    const allowedFields = ['phone', 'bio', 'expertise', 'linkedIn', 'image', 'isActive'];
    const dataToUpdate: any = {};
    Object.keys(updateData).forEach((key) => { if (allowedFields.includes(key)) dataToUpdate[key] = updateData[key]; });

    const { data: mentor, error } = await this.db.from('Mentor').update(dataToUpdate).eq('id', mentorId).select().single();
    if (error) throw error;
    return { success: true, message: 'Profile updated successfully', data: mentor };
  }

  async getAllForumPostsAdmin(filters: any) {
    const { category, limit, offset, sort } = filters;

    let query = this.db
      .from('ForumPost')
      .select('*, author:User!authorId(firstName, lastName, role, email), comments:ForumComment(count)', { count: 'exact' })
      .order('isPinned', { ascending: false })
      .order(sort === 'popular' ? 'likes' : 'createdAt', { ascending: false });

    if (category) query = query.ilike('category', `%${category}%`);
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 20) - 1);

    const { data: posts, count } = await query;
    return {
      success: true,
      data: (posts || []).map((p: any) => ({ ...p, commentCount: Array.isArray(p.comments) ? p.comments.length : 0 })),
      pagination: { total: count || 0, limit, offset, hasMore: (offset || 0) + (posts?.length || 0) < (count || 0) },
    };
  }

  async togglePinForumPost(id: string, isPinned: boolean) {
    try {
      const { data: post, error } = await this.db.from('ForumPost').update({ isPinned }).eq('id', id).select().single();
      if (error) throw error;
      return { success: true, message: isPinned ? 'Post pinned successfully' : 'Post unpinned successfully', data: post };
    } catch (error) {
      throw new NotFoundException('Post not found');
    }
  }

  // ==================== AI DUPLICATE QUESTION DETECTION ====================

  async checkDuplicateQuestion(questionData: { title: string; content: string; category: string }) {
    try {
      // Exact match check
      const { data: exactMatch } = await this.db
        .from('ForumPost')
        .select('id, title, createdAt, comments:ForumComment(count)')
        .ilike('title', questionData.title.trim())
        .eq('category', questionData.category)
        .single();

      if (exactMatch) {
        return { isDuplicate: true, similarQuestions: [{ id: exactMatch.id, title: exactMatch.title, similarity: 1.0, reason: 'Exact title match found in this category.', url: `/community/discussions/${exactMatch.id}` }], message: 'A question with this exact title already exists.' };
      }

      const stopwords = new Set(['the', 'and', 'for', 'how', 'can', 'what', 'why', 'which', 'does', 'are', 'was', 'get', 'not', 'any', 'but', 'you', 'your', 'that', 'this', 'have', 'with', 'will', 'from', 'its', 'into', 'than', 'then', 'about']);
      const keywords = questionData.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !stopwords.has(w));

      let existingQuestions: any[] = [];
      if (keywords.length > 0) {
        const { data } = await this.db
          .from('ForumPost')
          .select('id, title, content, createdAt')
          .ilike('category', `%${questionData.category}%`)
          .or(keywords.map((kw) => `title.ilike.%${kw}%`).join(','))
          .order('createdAt', { ascending: false })
          .limit(50);
        existingQuestions = data || [];
      }

      if (existingQuestions.length === 0) {
        const { data } = await this.db.from('ForumPost').select('id, title, content, createdAt').ilike('category', `%${questionData.category}%`).order('createdAt', { ascending: false }).limit(20);
        existingQuestions = data || [];
      }

      if (existingQuestions.length === 0) return { isDuplicate: false, similarQuestions: [], message: 'No similar questions found' };

      const existingQuestionsText = existingQuestions.map((q, i) => `${i + 1}. ID: ${q.id}\n   Title: "${q.title}"\n   Preview: ${(q.content || '').substring(0, 150)}...`).join('\n\n');

      const prompt = `You are an expert at detecting duplicate or highly similar questions in a community forum.\n\nNew Question:\nTitle: "${questionData.title}"\nContent: ${questionData.content}\n\nExisting Questions in the ${questionData.category} category:\n${existingQuestionsText}\n\nTask: Identify if the new question is substantially similar to any existing questions. Questions are considered similar if they ask for the same information, even if worded differently.\nHigh similarity (>= 0.8) means they should be merged or the user should be directed to the existing one.\n\nProvide your analysis in JSON format with the following structure:\n{\n  "matches": [\n    {\n      "id": "question_id",\n      "title": "question title",\n      "similarity": 0.0-1.0,\n      "reason": "brief explanation of why they're similar"\n    }\n  ]\n}\n\nIMPORTANT RULES:\n1. Only include questions with similarity >= 0.7\n2. Similarity of 0.9-1.0 means essentially the same question or intent\n3. Similarity of 0.7-0.8 means related topics but maybe slightly different focus\n4. Maximum 5 matches\n5. Respond ONLY with valid JSON, no markdown formatting`;

      const aiResponse = await this.openRouterService.getJson<{ matches: Array<{ id: string; title: string; similarity: number; reason: string }> }>(prompt);

      const validMatches = (aiResponse.matches || [])
        .filter((m) => m.similarity >= 0.7)
        .slice(0, 5)
        .map((m) => ({ id: m.id, title: m.title, similarity: m.similarity, reason: m.reason, url: `/community/discussions/${m.id}` }));

      return { isDuplicate: validMatches.length > 0, similarQuestions: validMatches, message: validMatches.length > 0 ? `Found ${validMatches.length} similar question(s)` : 'No similar questions found' };
    } catch (error) {
      console.error('Error in duplicate question detection:', error);
      return { isDuplicate: false, similarQuestions: [], message: 'Duplicate check unavailable, but you can still post your question', error: error.message };
    }
  }
}
