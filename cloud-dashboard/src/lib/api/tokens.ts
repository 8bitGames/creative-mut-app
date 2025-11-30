import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.MACHINE_API_JWT_SECRET || 'fallback-jwt-secret-change-in-production';
const TOKEN_EXPIRY = '30d'; // 30 days

export interface MachineTokenPayload {
  machineId: string;
  organizationId: string;
  hardwareId: string;
  iat: number;
  exp: number;
}

export function generateMachineToken(payload: Omit<MachineTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyMachineToken(token: string): MachineTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as MachineTokenPayload;
  } catch {
    return null;
  }
}
