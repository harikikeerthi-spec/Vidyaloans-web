import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'}/ai/popular-countries`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Backend API error:', response.status);
      // Return default countries on error
      return NextResponse.json({
        success: true,
        countries: [
          'United States',
          'United Kingdom',
          'Canada',
          'Australia',
          'Germany',
          'France',
          'Netherlands',
          'Switzerland',
          'Singapore',
          'Japan',
          'New Zealand',
          'Sweden',
          'Ireland',
          'Spain',
          'Italy',
        ],
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Popular countries error:', error);
    // Return default countries on error
    return NextResponse.json({
      success: true,
      countries: [
        'United States',
        'United Kingdom',
        'Canada',
        'Australia',
        'Germany',
        'France',
        'Netherlands',
        'Switzerland',
        'Singapore',
        'Japan',
        'New Zealand',
        'Sweden',
        'Ireland',
        'Spain',
        'Italy',
      ],
    });
  }
}
