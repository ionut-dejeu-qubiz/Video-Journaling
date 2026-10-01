import { NextRequest, NextResponse } from 'next/server';
import { getUploadDates } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import { computeStreakData } from '@/lib/streak';
import type { ApiResponse, StreakData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const email = await getSessionEmail(request);
    const dates = await getUploadDates(email);
    const streakData = computeStreakData(dates);

    return NextResponse.json({
      success: true,
      data: streakData,
    } satisfies ApiResponse<StreakData>);
  } catch (error) {
    console.error('Streak error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute streak data' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
