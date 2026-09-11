import { NextResponse } from 'next/server';
import { getStaffDirectory } from '@/lib/adminAuth';

export async function GET() {
  try {
    const staff = await getStaffDirectory();
    return NextResponse.json({
      success: true,
      staff
    });
  } catch (err: any) {
    console.error('Error fetching staff directory:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch staff directory' },
      { status: 500 }
    );
  }
}
