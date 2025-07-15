import Database from 'better-sqlite3';
import { Document, DocumentStats, DocumentSearchResult } from '../models/document.js';
import { SourceConfig, SourceStatus } from '../models/source.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export class StorageService {
  private db: Database.Database;
  private initialized = false;

  constructor(private dbPath: string = 'data/auto-gather.db') {
    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    fs.mkdir(dir, { recursive: true }).catch(() => {});
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        metadata TEXT,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        size INTEGER,
        checksum TEXT
      )
    `);

    // Create sources table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        schedule TEXT,
        last_crawled INTEGER,
        settings TEXT,
        filters TEXT
      )
    `);

    // Create source_status table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_status (
        source_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        last_run INTEGER,
        last_error TEXT,
        documents_found INTEGER DEFAULT 0,
        documents_processed INTEGER DEFAULT 0,
        documents_skipped INTEGER DEFAULT 0,
        duration INTEGER,
        FOREIGN KEY (source_id) REFERENCES sources (id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_source_id ON documents(source_id);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
      CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
      CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
    `);

    this.initialized = true;
  }

  // Document operations
  async saveDocument(doc: Document): Promise<void> {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO documents 
      (id, title, content, type, source_id, source_path, metadata, tags, created_at, updated_at, size, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      doc.id,
      doc.title,
      doc.content,
      doc.type,
      doc.sourceId,
      doc.sourcePath,
      doc.metadata ? JSON.stringify(doc.metadata) : null,
      doc.tags ? JSON.stringify(doc.tags) : null,
      doc.createdAt.getTime(),
      doc.updatedAt.getTime(),
      doc.size || null,
      doc.checksum || null
    );
  }

  async getDocument(id: string): Promise<Document | null> {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.rowToDocument(row);
  }

  async getDocumentsBySource(sourceId: string): Promise<Document[]> {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM documents WHERE source_id = ? ORDER BY updated_at DESC');
    const rows = stmt.all(sourceId) as any[];
    
    return rows.map(row => this.rowToDocument(row));
  }

  async searchDocuments(query: string, limit = 50): Promise<DocumentSearchResult[]> {
    await this.initialize();
    
    // Simple text search - can be enhanced with FTS later
    const stmt = this.db.prepare(`
      SELECT *, 
        (CASE 
          WHEN title LIKE ? THEN 3
          WHEN content LIKE ? THEN 1
          ELSE 0
        END) as score
      FROM documents 
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY score DESC, updated_at DESC
      LIMIT ?
    `);

    const searchTerm = `%${query}%`;
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, limit) as any[];
    
    return rows.map(row => ({
      document: this.rowToDocument(row),
      score: row.score || 0,
      highlights: this.extractHighlights(row.content, query)
    }));
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.initialize();
    
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  async getDocumentStats(): Promise<DocumentStats> {
    await this.initialize();
    
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM documents');
    const totalResult = totalStmt.get() as any;
    
    const typeStmt = this.db.prepare('SELECT type, COUNT(*) as count FROM documents GROUP BY type');
    const typeResults = typeStmt.all() as any[];
    
    const sourceStmt = this.db.prepare('SELECT source_id, COUNT(*) as count FROM documents GROUP BY source_id');
    const sourceResults = sourceStmt.all() as any[];
    
    const lastUpdatedStmt = this.db.prepare('SELECT MAX(updated_at) as last_updated FROM documents');
    const lastUpdatedResult = lastUpdatedStmt.get() as any;

    return {
      totalDocuments: totalResult.count || 0,
      documentsByType: Object.fromEntries(typeResults.map(r => [r.type, r.count])),
      documentsBySource: Object.fromEntries(sourceResults.map(r => [r.source_id, r.count])),
      totalSize: totalResult.total_size || 0,
      lastUpdated: lastUpdatedResult.last_updated ? new Date(lastUpdatedResult.last_updated) : new Date()
    };
  }

  // Source operations
  async saveSource(source: SourceConfig): Promise<void> {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sources 
      (id, name, type, url, enabled, schedule, last_crawled, settings, filters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      source.id,
      source.name,
      source.type,
      source.url,
      source.enabled ? 1 : 0,
      source.schedule || null,
      source.lastCrawled?.getTime() || null,
      source.settings ? JSON.stringify(source.settings) : null,
      source.filters ? JSON.stringify(source.filters) : null
    );
  }

  async getSource(id: string): Promise<SourceConfig | null> {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM sources WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.rowToSource(row);
  }

  async getAllSources(): Promise<SourceConfig[]> {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM sources ORDER BY name');
    const rows = stmt.all() as any[];
    
    return rows.map(row => this.rowToSource(row));
  }

  async deleteSource(id: string): Promise<boolean> {
    await this.initialize();
    
    // Delete related documents and status
    this.db.prepare('DELETE FROM documents WHERE source_id = ?').run(id);
    this.db.prepare('DELETE FROM source_status WHERE source_id = ?').run(id);
    
    const stmt = this.db.prepare('DELETE FROM sources WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  // Source status operations
  async updateSourceStatus(status: SourceStatus): Promise<void> {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO source_status 
      (source_id, status, last_run, last_error, documents_found, documents_processed, documents_skipped, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      status.sourceId,
      status.status,
      status.lastRun?.getTime() || null,
      status.lastError || null,
      status.documentsFound,
      status.documentsProcessed,
      status.documentsSkipped,
      status.duration || null
    );
  }

  async getSourceStatus(sourceId: string): Promise<SourceStatus | null> {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM source_status WHERE source_id = ?');
    const row = stmt.get(sourceId) as any;
    
    if (!row) return null;
    
    return {
      sourceId: row.source_id,
      status: row.status,
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      lastError: row.last_error || undefined,
      documentsFound: row.documents_found || 0,
      documentsProcessed: row.documents_processed || 0,
      documentsSkipped: row.documents_skipped || 0,
      duration: row.duration || undefined
    };
  }

  close(): void {
    this.db.close();
  }

  private rowToDocument(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      sourceId: row.source_id,
      sourcePath: row.source_path,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      size: row.size || undefined,
      checksum: row.checksum || undefined
    };
  }

  private rowToSource(row: any): SourceConfig {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      enabled: row.enabled === 1,
      schedule: row.schedule || undefined,
      lastCrawled: row.last_crawled ? new Date(row.last_crawled) : undefined,
      settings: row.settings ? JSON.parse(row.settings) : undefined,
      filters: row.filters ? JSON.parse(row.filters) : undefined
    };
  }

  private extractHighlights(content: string, query: string, maxLength = 200): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];
    
    for (const word of words) {
      const index = content.toLowerCase().indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + word.length + 50);
        const highlight = content.substring(start, end).trim();
        if (highlight.length > 10) {
          highlights.push(`...${highlight}...`);
        }
      }
    }
    
    return highlights.slice(0, 3); // Max 3 highlights
  }
}