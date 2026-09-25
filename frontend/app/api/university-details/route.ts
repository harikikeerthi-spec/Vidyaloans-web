import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const country = searchParams.get('country');

    if (!name || !country) {
      return NextResponse.json(
        { success: false, message: 'Name and country are required', details: null },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'}/ai/university-details/${encodeURIComponent(name)}/${encodeURIComponent(country)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Backend API error:', response.status);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch university details', details: null },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('University details error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while fetching university details', details: null },
      { status: 500 }
    );
  }
}
