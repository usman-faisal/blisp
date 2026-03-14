import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

export const verifyPassword = ({ password, salt, hash }: { password: string; salt: string; hash: string }) => {
  const candidateHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === candidateHash;
};

export const generateSecureToken = async (length: number = 32): Promise<string> => {
  const token = crypto.randomBytes(length).toString('hex');
  return await bcrypt.hash(token, 10);
};
