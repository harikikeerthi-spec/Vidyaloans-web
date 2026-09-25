import { NextRequest, NextResponse } from 'next/server';

const getBackendUrl = (request: NextRequest) => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  const hostname = request.nextUrl.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:5000';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
};

async function handler(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || '';
  const cookieToken = request.cookies.get('staffAccessToken')?.value 
    || request.cookies.get('adminAccessToken')?.value 
    || request.cookies.get('token')?.value 
    || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader : (cookieToken ? `Bearer ${cookieToken}` : '');

  const backendUrl = getBackendUrl(request);
  const url = `${backendUrl}/api/notifications/mark-all-read`;

  const csrfHeader = request.headers.get('x-csrf-token') || request.headers.get('X-CSRF-Token') || '';
  const cookieHeader = request.headers.get('cookie') || '';

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': token } : {}),
        ...(csrfHeader ? { 'X-CSRF-Token': csrfHeader } : {}),
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      console.warn(`[API Warning] Backend returned ${response.status} for mark-all-read`);
      return NextResponse.json({ success: true, count: 0 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error marking all notifications read:', error);
    return NextResponse.json({ success: true, count: 0 });
  }
}

export const PUT = handler;
export const PATCH = handler;
export const POST = handler;
