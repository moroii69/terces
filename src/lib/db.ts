import { openDB } from 'idb';
import type { Project, Secret } from '../types';

const DB_NAME = 'secrets-manager';
const DB_VERSION = 2;

let dbPromise;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Create stores in version 1
        if (oldVersion < 1) {
          db.createObjectStore('projects', { keyPath: 'id' });
          const secretStore = db.createObjectStore('secrets', { keyPath: 'id' });
          secretStore.createIndex('projectId', 'projectId');
          secretStore.createIndex('isDeleted', 'isDeleted');
        }

        // Add indices in version 2 if upgrading from version 1
        else if (oldVersion === 1) {
          const secretStore = db.transaction('secrets', 'readwrite')
            .objectStore('secrets');

          // Only create indices if they don't exist
          if (!secretStore.indexNames.contains('projectId')) {
            secretStore.createIndex('projectId', 'projectId');
          }
          if (!secretStore.indexNames.contains('isDeleted')) {
            secretStore.createIndex('isDeleted', 'isDeleted');
          }
        }
      },
    });
  }
  return dbPromise;
}

export const projectsDB = {
  async getAll(): Promise<Project[]> {
    const db = await initDB();
    const projects = await db.getAll('projects');
    return projects.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });
  },

  async add(project: Project): Promise<string> {
    const db = await initDB();
    await db.add('projects', project);
    return project.id;
  },

  async update(project: Project): Promise<void> {
    const db = await initDB();
    await db.put('projects', project);
  },

  async delete(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('projects', id);
  },

  async togglePin(id: string): Promise<void> {
    const db = await initDB();
    const project = await db.get('projects', id);
    if (project) {
      project.isPinned = !project.isPinned;
      await db.put('projects', project);
    }
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    const db = await initDB();
    const project = await db.get('projects', id);
    if (project) {
      project.tags = tags;
      await db.put('projects', project);
    }
  }
};

export const secretsDB = {
  async getAllByProject(projectId: string): Promise<Secret[]> {
    const db = await initDB();
    const tx = db.transaction('secrets', 'readonly');
    const index = tx.store.index('projectId');
    const secrets = await index.getAll(projectId);
    return secrets.filter(secret => !secret.isDeleted);
  },

  async searchAll(query: string): Promise<Secret[]> {
    const db = await initDB();
    const allSecrets = await db.getAll('secrets');
    const regex = new RegExp(query, 'i');
    return allSecrets.filter(secret =>
      !secret.isDeleted && (
        regex.test(secret.title) ||
        regex.test(secret.category)
      )
    );
  },

  async getDeleted(): Promise<Secret[]> {
    const db = await initDB();
    const tx = db.transaction('secrets', 'readonly');
    const index = tx.store.index('isDeleted');
    return index.getAll(true);
  },

  async add(secret: Secret): Promise<string> {
    const db = await initDB();
    await db.add('secrets', { ...secret, isDeleted: false });
    return secret.id;
  },

  async update(secret: Secret): Promise<void> {
    const db = await initDB();
    await db.put('secrets', { ...secret, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    const db = await initDB();
    const secret = await db.get('secrets', id);
    if (secret) {
      await db.put('secrets', {
        ...secret,
        isDeleted: true,
        deletedAt: Date.now()
      });
    }
  },

  async restore(id: string): Promise<void> {
    const db = await initDB();
    const secret = await db.get('secrets', id);
    if (secret) {
      await db.put('secrets', {
        ...secret,
        isDeleted: false,
        deletedAt: undefined
      });
    }
  },

  async permanentDelete(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('secrets', id);
  }
};