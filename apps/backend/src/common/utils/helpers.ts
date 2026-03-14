import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

export const throwError = (message: string | any, statusCode?: number): HttpException => {
  return new HttpException(message, statusCode || HttpStatus.INTERNAL_SERVER_ERROR);
};

export const getRandomFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const generateSecureOTP = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    const randIndex = crypto.randomInt(0, digits.length);
    otp += digits[randIndex];
  }
  return otp;
};

export const generateSecurePassword = (length: number = 12): string => {
  if (length < 6) {
    throw new Error('Password length must be at least 6 characters');
  }

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+';
  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';

  password += getRandomChar(uppercase);
  password += getRandomChar(lowercase);
  password += getRandomChar(numbers);
  password += getRandomChar(symbols);

  for (let i = 4; i < length; i++) {
    password += getRandomChar(allChars);
  }

  return shuffleString(password);
};

const getRandomChar = (chars: string): string => {
  const randIndex = crypto.randomInt(0, chars.length);
  return chars[randIndex];
};

const shuffleString = (str: string): string => {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
