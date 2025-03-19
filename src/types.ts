export interface Project {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  tags: string[];
  isPinned: boolean;
  createdAt: number;
}

export interface Secret {
  id: string;
  projectId: string;
  title: string;
  content: string;
  category: string;
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedData {
  iv: string;
  content: string;
}

export type Theme = 'light' | 'dark';