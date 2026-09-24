// Global TypeScript types for the Vidya Loans application

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    passportNumber?: string;
    role?: "user" | "admin" | "super_admin";
    createdAt?: string;

    // Onboarding & Profile Preferences
    goal?: string;
    studyDestination?: string;
    courseName?: string;
    targetUniversity?: string;
    intakeSeason?: string;
    bachelorsDegree?: string;
    workExp?: number;
    gpa?: number;
    entranceTest?: string;
    entranceScore?: string;
    englishTest?: string;
    englishScore?: string;
    budget?: string;
    pincode?: string;
    loanAmount?: string;
    admitStatus?: string;
}

export interface AuthTokenPayload {
    sub: string;
    email: string;
    role: string;
    exp?: number;
    iat?: number;
}

export interface LoginResponse {
    success: boolean;
    message?: string;
    access_token: string;
    refresh_token?: string;
    userExists: boolean;
    firstName?: string;
    lastName?: string;
}

export interface LoanApplication {
    id: string;
    userId: string;
    bank: string;
    loanType: string;
    amount: number;
    status: string;
    purpose?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BlogPost {
    id: string;
    title: string;
    subtitle?: string;
    slug: string;
    excerpt?: string;
    content: string;
    blocks?: any[];
    coverImage?: string;
    featuredImage?: string;
    author?: string;
    authorName?: string;
    authorImage?: string;
    authorRole?: string;
    tags?: string[];
    category?: string;
    readTime?: number;
    views?: number;
    isFeatured?: boolean;
    isPublished?: boolean;
    published?: boolean;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ForumPost {
    id: string;
    title: string;
    content: string;
    userId: string;
    author?: User;
    topic?: string;
    slug?: string;
    likes: number;
    likedByUser?: boolean;
    isPinned?: boolean;
    comments?: ForumComment[];
    _count?: { comments: number; likes: number };
    createdAt: string;
    updatedAt: string;
}

export interface ForumComment {
    id: string;
    content: string;
    userId: string;
    author?: User;
    postId: string;
    likes: number;
    likedByUser?: boolean;
    replies?: ForumComment[];
    createdAt: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
}
