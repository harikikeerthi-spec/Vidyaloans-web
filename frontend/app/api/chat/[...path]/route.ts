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

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const authHeader = request.headers.get('Authorization') || '';
  const cookieToken = request.cookies.get('staffAccessToken')?.value 
    || request.cookies.get('adminAccessToken')?.value 
    || request.cookies.get('token')?.value 
    || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader : (cookieToken ? `Bearer ${cookieToken}` : '');

  // Reconstruct query parameters
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();
  const backendUrl = getBackendUrl(request);
  const url = `${backendUrl}/api/chat/${path.join('/')}${queryStr ? `?${queryStr}` : ''}`;

  const method = request.method;
  const csrfHeader = request.headers.get('x-csrf-token') || request.headers.get('X-CSRF-Token') || '';
  const cookieHeader = request.headers.get('cookie') || '';
  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': token } : {}),
    ...(csrfHeader ? { 'X-CSRF-Token': csrfHeader } : {}),
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
  };

  let body: any = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      body = await request.blob();
    } else {
      headers['Content-Type'] = 'application/json';
      try {
        const json = await request.json();
        body = JSON.stringify(json);
      } catch (err) {
        body = undefined;
      }
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend returned error ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API Proxy] Error forwarding request to /chat/${path.join('/')}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as DELETE,
};
