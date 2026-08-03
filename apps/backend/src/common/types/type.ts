export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: string;
  search?: string;
}

// Single definition lives in @repo/types so the mobile client shares it.
// Re-exported here so existing `src/common/types/type` importers are unaffected.
export type { PaginationInfo } from '@repo/types';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename: string;
}

export interface ApiResponse<T = any> {
  message: string;
  success: boolean;
  data?: T;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
  score: number;
}
