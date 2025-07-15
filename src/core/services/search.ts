import Fuse, { IFuseOptions, FuseResult } from 'fuse.js';
import { Document, DocumentSearchResult } from '../models/document.js';
import { StorageService } from './storage.js';

export interface SearchOptions {
  limit?: number;
  threshold?: number; // 0.0 = exact match, 1.0 = match anything
  includeScore?: boolean;
  includeMatches?: boolean;
  sourceIds?: string[];
  types?: string[];
  tags?: string[];
}

export class SearchService {
  private fuse: Fuse<Document> | null = null;
  private documents: Document[] = [];
  private lastIndexUpdate = 0;
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    await this.rebuildIndex();
  }

  async rebuildIndex(): Promise<void> {
    // Get all documents from storage
    const sources = await this.storage.getAllSources();
    this.documents = [];
    
    for (const source of sources) {
      const sourceDocs = await this.storage.getDocumentsBySource(source.id);
      this.documents.push(...sourceDocs);
    }

    // Configure Fuse.js
    const options: IFuseOptions<Document> = {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'content', weight: 0.3 },
        { name: 'tags', weight: 0.2 },
        { name: 'metadata.fileName', weight: 0.1 }
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    };

    this.fuse = new Fuse(this.documents, options);
    this.lastIndexUpdate = Date.now();
  }

  async search(query: string, options: SearchOptions = {}): Promise<DocumentSearchResult[]> {
    // Check if we need to rebuild the index
    const stats = await this.storage.getDocumentStats();
    if (stats.lastUpdated.getTime() > this.lastIndexUpdate) {
      await this.rebuildIndex();
    }

    if (!this.fuse || !query.trim()) {
      return [];
    }

    const {
      limit = 50,
      threshold = 0.3,
      sourceIds,
      types,
      tags
    } = options;

    // If threshold is different from default, create a new Fuse instance
    let searchInstance = this.fuse;
    if (threshold !== 0.3) {
      const searchOptions: IFuseOptions<Document> = {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'content', weight: 0.3 },
          { name: 'tags', weight: 0.2 },
          { name: 'metadata.fileName', weight: 0.1 }
        ],
        threshold,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        ignoreLocation: true,
      };
      searchInstance = new Fuse(this.documents, searchOptions);
    }

    const fuseResults = searchInstance!.search(query, { limit: limit * 2 }); // Get more to filter

    // Filter results
    let filteredResults = fuseResults;

    if (sourceIds && sourceIds.length > 0) {
      filteredResults = filteredResults.filter(result => 
        sourceIds.includes(result.item.sourceId)
      );
    }

    if (types && types.length > 0) {
      filteredResults = filteredResults.filter(result => 
        types.includes(result.item.type)
      );
    }

    if (tags && tags.length > 0) {
      filteredResults = filteredResults.filter(result => 
        result.item.tags && result.item.tags.some(tag => tags.includes(tag))
      );
    }

    // Convert to DocumentSearchResult format
    const results: DocumentSearchResult[] = filteredResults
      .slice(0, limit)
      .map(result => ({
        document: result.item,
        score: 1 - (result.score || 0), // Invert score so higher is better
        highlights: this.extractHighlights(result, query)
      }));

    return results;
  }

  async searchByType(type: string, limit = 50): Promise<Document[]> {
    await this.rebuildIndex();
    return this.documents
      .filter(doc => doc.type === type)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async searchBySource(sourceId: string, limit = 50): Promise<Document[]> {
    return this.storage.getDocumentsBySource(sourceId);
  }

  async searchByTags(tags: string[], limit = 50): Promise<Document[]> {
    await this.rebuildIndex();
    return this.documents
      .filter(doc => 
        doc.tags && doc.tags.some(tag => tags.includes(tag))
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async getRecentDocuments(limit = 20): Promise<Document[]> {
    await this.rebuildIndex();
    return this.documents
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async getSimilarDocuments(documentId: string, limit = 10): Promise<DocumentSearchResult[]> {
    const document = await this.storage.getDocument(documentId);
    if (!document) return [];

    // Use document title and tags as search query
    const query = [document.title, ...(document.tags || [])].join(' ');
    const results = await this.search(query, { limit: limit + 1 });

    // Remove the original document from results
    return results.filter(result => result.document.id !== documentId);
  }

  private extractHighlights(result: FuseResult<Document>, query: string): string[] {
    const highlights: string[] = [];
    
    if (result.matches) {
      for (const match of result.matches) {
        if (match.indices && match.value) {
          for (const [start, end] of match.indices) {
            const highlight = this.createHighlight(match.value, start, end);
            if (highlight) {
              highlights.push(highlight);
            }
          }
        }
      }
    }

    // If no matches found, try to extract from content
    if (highlights.length === 0) {
      const contentHighlight = this.extractContentHighlight(result.item.content, query);
      if (contentHighlight) {
        highlights.push(contentHighlight);
      }
    }

    return highlights.slice(0, 3); // Limit to 3 highlights
  }

  private createHighlight(text: string, start: number, end: number, contextLength = 50): string {
    const highlightStart = Math.max(0, start - contextLength);
    const highlightEnd = Math.min(text.length, end + contextLength);
    
    let highlight = text.substring(highlightStart, highlightEnd);
    
    // Add ellipsis if we're not at the start/end
    if (highlightStart > 0) highlight = '...' + highlight;
    if (highlightEnd < text.length) highlight = highlight + '...';
    
    return highlight.trim();
  }

  private extractContentHighlight(content: string, query: string): string | null {
    const words = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    for (const word of words) {
      const index = contentLower.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + word.length + 50);
        const highlight = content.substring(start, end).trim();
        
        if (highlight.length > 10) {
          return start > 0 ? `...${highlight}...` : highlight;
        }
      }
    }
    
    return null;
  }

  getIndexStats(): { documentCount: number, lastUpdate: Date } {
    return {
      documentCount: this.documents.length,
      lastUpdate: new Date(this.lastIndexUpdate)
    };
  }
}