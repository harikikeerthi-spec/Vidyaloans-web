import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortlist = [], profile = {} } = body;

    if (!shortlist || shortlist.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Shortlist is required' },
        { status: 400 }
      );
    }

    const baseApiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
    const apiUrl = baseApiUrl.endsWith('/api') ? baseApiUrl.slice(0, -4) : baseApiUrl;
    const response = await fetch(
      `${apiUrl}/api/ai/compare-shortlist`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shortlist,
          profile,
        }),
      }
    );

    if (!response.ok) {
      console.error('Backend API error:', response.status);
      return NextResponse.json(
        { success: false, message: 'Failed to compare shortlist' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Shortlist comparison error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while comparing shortlist' },
      { status: 500 }
    );
  }
}
