import { NextResponse } from 'next/server';
import { assignCustomRole } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Both email and role are required' }, 
        { status: 400 }
      );
    }

    const validRoles = ['patient', 'nurse', 'doctor', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}` }, 
        { status: 400 }
      );
    }

    const result = await assignCustomRole(email.trim(), role);
    return NextResponse.json({
      success: true,
      message: `Successfully assigned role '${role}' to ${email}`,
      data: result
    });
  } catch (err: any) {
    console.error('Error assigning custom role:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to assign custom claim role' }, 
      { status: 500 }
    );
  }
}
