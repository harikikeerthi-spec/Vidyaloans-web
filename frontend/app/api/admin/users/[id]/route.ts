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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  // Accept token from Authorization header (localStorage-based portals) or cookie fallback
  const authHeader = request.headers.get('Authorization') || '';
  const cookieToken = request.cookies.get('adminAccessToken')?.value 
    || request.cookies.get('token')?.value 
    || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader : (cookieToken ? `Bearer ${cookieToken}` : '');

  try {
    // Fetch user data from backend
    const backendUrl = getBackendUrl(request);
    const response = await fetch(
      `${backendUrl}/api/users/admin/${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {}),
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Return the user data (handle both success and direct data responses)
    if (data.success === false) {
      return NextResponse.json(
        { error: data.message },
        { status: 404 }
      );
    }

    return NextResponse.json(data.data || data);
  } catch (error) {
    console.error('[API] Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
