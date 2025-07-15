import * as fs from 'fs/promises';
import * as path from 'path';
import { SourceConfig, SourceStatus } from '../models/source.js';
import { Document } from '../models/document.js';
import { ParserService } from './parser.js';
import { StorageService } from './storage.js';

export interface CrawlResult {
  documentsFound: number;
  documentsProcessed: number;
  documentsSkipped: number;
  errors: string[];
}

export class CrawlerService {
  private parser: ParserService;
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.parser = new ParserService();
    this.storage = storage;
  }

  async crawlSource(source: SourceConfig): Promise<CrawlResult> {
    const startTime = Date.now();
    const result: CrawlResult = {
      documentsFound: 0,
      documentsProcessed: 0,
      documentsSkipped: 0,
      errors: []
    };

    // Update status to crawling
    await this.storage.updateSourceStatus({
      sourceId: source.id,
      status: 'crawling',
      lastRun: new Date(),
      lastError: undefined,
      documentsFound: 0,
      documentsProcessed: 0,
      documentsSkipped: 0
    });

    try {
      switch (source.type) {
        case 'local':
          await this.crawlLocalFiles(source, result);
          break;
        case 'git':
          throw new Error('Git sources not yet implemented');
        case 'web':
          throw new Error('Web sources not yet implemented');
        case 'api':
          throw new Error('API sources not yet implemented');
        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }

      // Update status to success
      await this.storage.updateSourceStatus({
        sourceId: source.id,
        status: 'success',
        lastRun: new Date(),
        lastError: undefined,
        documentsFound: result.documentsFound,
        documentsProcessed: result.documentsProcessed,
        documentsSkipped: result.documentsSkipped,
        duration: Date.now() - startTime
      });

      // Update source last crawled time
      source.lastCrawled = new Date();
      await this.storage.saveSource(source);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      // Update status to error
      await this.storage.updateSourceStatus({
        sourceId: source.id,
        status: 'error',
        lastRun: new Date(),
        lastError: errorMessage,
        documentsFound: result.documentsFound,
        documentsProcessed: result.documentsProcessed,
        documentsSkipped: result.documentsSkipped,
        duration: Date.now() - startTime
      });
    }

    return result;
  }

  private async crawlLocalFiles(source: SourceConfig, result: CrawlResult): Promise<void> {
    const rootPath = source.url.replace('file://', '');
    
    // Validate path exists
    try {
      const stats = await fs.stat(rootPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${rootPath}`);
      }
    } catch (error) {
      throw new Error(`Cannot access path: ${rootPath}`);
    }

    const filters = source.filters || {};
    const maxDepth = filters.maxDepth || 10;
    const maxSize = filters.maxSize || 10 * 1024 * 1024; // 10MB default
    
    await this.crawlDirectory(rootPath, source, result, 0, maxDepth, maxSize);
  }

  private async crawlDirectory(
    dirPath: string, 
    source: SourceConfig, 
    result: CrawlResult, 
    currentDepth: number, 
    maxDepth: number,
    maxSize: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(source.url.replace('file://', ''), fullPath);

        // Check filters
        if (!this.shouldProcessPath(relativePath, source.filters)) {
          result.documentsSkipped++;
          continue;
        }

        if (entry.isDirectory()) {
          await this.crawlDirectory(fullPath, source, result, currentDepth + 1, maxDepth, maxSize);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            
            // Check file size
            if (stats.size > maxSize) {
              result.documentsSkipped++;
              continue;
            }

            // Check if we can parse this file
            if (!(await this.parser.canParse(fullPath))) {
              result.documentsSkipped++;
              continue;
            }

            result.documentsFound++;

            // Check if document already exists and is up to date
            const docId = require('crypto').createHash('sha256')
              .update(`${source.id}:${fullPath}`)
              .digest('hex');
            
            const existingDoc = await this.storage.getDocument(docId);
            if (existingDoc && existingDoc.updatedAt >= stats.mtime) {
              result.documentsSkipped++;
              continue;
            }

            // Parse and save document
            const document = await this.parser.parseFile(fullPath, source.id);
            if (document) {
              await this.storage.saveDocument(document);
              result.documentsProcessed++;
            } else {
              result.documentsSkipped++;
            }

          } catch (error) {
            const errorMsg = `Error processing file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            result.documentsSkipped++;
          }
        }
      }
    } catch (error) {
      const errorMsg = `Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
    }
  }

  private shouldProcessPath(relativePath: string, filters?: SourceConfig['filters']): boolean {
    if (!filters) return true;

    // Check include patterns
    if (filters.include && filters.include.length > 0) {
      const included = filters.include.some(pattern => this.matchGlob(relativePath, pattern));
      if (!included) return false;
    }

    // Check exclude patterns
    if (filters.exclude && filters.exclude.length > 0) {
      const excluded = filters.exclude.some(pattern => this.matchGlob(relativePath, pattern));
      if (excluded) return false;
    }

    return true;
  }

  private matchGlob(path: string, pattern: string): boolean {
    // Simple glob matching - can be enhanced with a proper glob library
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(path);
  }

  async crawlAllEnabledSources(): Promise<Map<string, CrawlResult>> {
    const sources = await this.storage.getAllSources();
    const enabledSources = sources.filter(s => s.enabled);
    const results = new Map<string, CrawlResult>();

    for (const source of enabledSources) {
      try {
        const result = await this.crawlSource(source);
        results.set(source.id, result);
      } catch (error) {
        results.set(source.id, {
          documentsFound: 0,
          documentsProcessed: 0,
          documentsSkipped: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    return results;
  }
}