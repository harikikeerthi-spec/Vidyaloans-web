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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const cookieToken = request.cookies.get('staffAccessToken')?.value 
    || request.cookies.get('adminAccessToken')?.value 
    || request.cookies.get('bankAccessToken')?.value 
    || request.cookies.get('agentAccessToken')?.value 
    || request.cookies.get('itAccessToken')?.value 
    || request.cookies.get('accessToken')?.value 
    || request.cookies.get('token')?.value 
    || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader : (cookieToken ? `Bearer ${cookieToken}` : (authHeader ? `Bearer ${authHeader}` : ''));

  // Extract query parameters
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const limit = searchParams.get('limit') || '';
  const offset = searchParams.get('offset') || '';

  const backendQuery = new URLSearchParams();
  if (type) backendQuery.set('type', type);
  if (limit) backendQuery.set('limit', limit);
  if (offset) backendQuery.set('offset', offset);

  const queryStr = backendQuery.toString();
  const backendUrl = getBackendUrl(request);
  const url = `${backendUrl}/api/notifications${queryStr ? `?${queryStr}` : ''}`;

  const xPortal = request.headers.get('x-portal') || '';
  const referer = request.headers.get('referer') || '';
  const cookieHeader = request.headers.get('cookie') || '';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': token } : {}),
        ...(xPortal ? { 'x-portal': xPortal } : {}),
        ...(referer ? { 'referer': referer } : {}),
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return NextResponse.json({ success: true, items: [], total: 0, unreadCount: 0 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error fetching notifications:', error);
    return NextResponse.json({ success: true, items: [], total: 0, unreadCount: 0 });
  }
}

