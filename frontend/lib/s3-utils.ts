/**
 * AWS S3 Utility Service for Document Upload & Management
 */

interface S3UploadResponse {
    success: boolean;
    s3Url: string;
    s3Key: string;
    docType: string;
    uploadedAt: string;
    error?: string;
}

interface S3Document {
    id: string;
    userId: string;
    docType: string;
    fileName: string;
    s3Key: string;
    s3Url: string;
    fileSize: number;
    uploadedAt: string;
    employmentType?: string;
    personType?: 'applicant' | 'father' | 'mother' | 'coapplicant';
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
}

import { initializeCsrf, getCsrfToken, getToken } from './api';

/**
 * Get presigned URL for file upload from backend
 */
export const getS3PresignedUrl = async (
    userId: string,
    docType: string,
    fileName: string,
    fileType: string
): Promise<{
    uploadUrl: string;
    s3Key: string;
    docId: string;
}> => {
    const token = getToken();

    let csrfToken = getCsrfToken();
    if (!csrfToken) {
        csrfToken = await initializeCsrf();
    }

    const response = await fetch('/api/documents/presigned-url', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
            userId,
            docType,
            fileName,
            fileType
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.statusText}`);
    }

    return response.json();
};

/**
 * Upload file directly to S3 using presigned URL
 */
export const uploadFileToS3 = async (
    file: File,
    uploadUrl: string,
    s3Key: string,
    onProgress?: (progress: number) => void
): Promise<S3UploadResponse> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                if (onProgress) onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 204) {
                resolve({
                    success: true,
                    s3Url: uploadUrl.split('?')[0], // Remove query params
                    s3Key,
                    docType: s3Key.split('/')[1] || 'unknown',
                    uploadedAt: new Date().toISOString()
                });
            } else {
                reject(new Error(`S3 upload failed with status ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during S3 upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
};

/**
 * Complete document upload (register in database after S3 upload)
 */
export const completeDocumentUpload = async (
    userId: string,
    docId: string,
    docType: string,
    s3Key: string,
    s3Url: string,
    personType: 'applicant' | 'father' | 'mother' | 'coapplicant',
    employmentType?: string
): Promise<S3Document> => {
    const token = getToken();

    let csrfToken = getCsrfToken();
    if (!csrfToken) {
        csrfToken = await initializeCsrf();
    }

    const response = await fetch('/api/documents/complete-upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
            userId,
            docId,
            docType,
            s3Key,
            s3Url,
            personType,
            employmentType
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to complete document upload: ${response.statusText}`);
    }

    return response.json();
};

/**
 * Fetch all documents for a user from database
 */
export const fetchUserS3Documents = async (userId: string): Promise<S3Document[]> => {
    const token = getToken();

    const response = await fetch(`/api/documents/user/${userId}`, {
        credentials: 'include',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` })
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }

    return response.json();
};

/**
 * Delete document from S3 and database
 */
export const deleteS3Document = async (docId: string): Promise<void> => {
    const token = getToken();

    const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` })
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
    }
};

/**
 * Download document from S3
 */
export const downloadS3Document = async (s3Key: string, fileName: string): Promise<void> => {
    const token = getToken();

    const response = await fetch(`/api/documents/download`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ s3Key })
    });

    if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

/**
 * Get S3 document URL
 */
export const getS3DocumentUrl = (s3Key: string): string => {
    const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET || 'loan-documents';
    const region = process.env.NEXT_PUBLIC_S3_REGION || 'us-east-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
};

export default {
    getS3PresignedUrl,
    uploadFileToS3,
    completeDocumentUpload,
    fetchUserS3Documents,
    deleteS3Document,
    downloadS3Document,
    getS3DocumentUrl
};
