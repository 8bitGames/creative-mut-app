import { type NextRequest, NextResponse } from 'next/server';
import { type MachineTokenPayload, verifyMachineToken } from './tokens';

export interface AuthenticatedRequest extends NextRequest {
  machine: MachineTokenPayload;
}

export async function validateMachineToken(
  request: NextRequest
): Promise<{ valid: true; payload: MachineTokenPayload } | { valid: false; error: string }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const payload = verifyMachineToken(token);

  if (!payload) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  return { valid: true, payload };
}

export function apiError(code: string, message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
