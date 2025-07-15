import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { StorageService, SearchService } from './services/index.js';

export class ResourcesHandler {
  constructor(
    private storage: StorageService,
    private search: SearchService
  ) {}

  getResources(): Resource[] {
    return [
      {
        uri: 'docs://documents',
        name: 'All Documents',
        description: 'Access to all collected documents',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://sources',
        name: 'Documentation Sources',
        description: 'Configuration and status of all documentation sources',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://search/{query}',
        name: 'Search Results',
        description: 'Live search results for a given query',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://document/{id}',
        name: 'Document Content',
        description: 'Full content of a specific document',
        mimeType: 'text/plain'
      },
      {
        uri: 'docs://stats',
        name: 'Collection Statistics',
        description: 'Statistics about the documentation collection',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://recent',
        name: 'Recent Documents',
        description: 'Recently updated documents',
        mimeType: 'application/json'
      }
    ];
  }

  async handleResourceRequest(uri: string): Promise<{ content: string; mimeType: string }> {
    const url = new URL(uri);
    const pathParts = url.pathname.split('/').filter(Boolean);

    switch (pathParts[0]) {
      case 'documents':
        return this.handleDocumentsResource(pathParts.slice(1));
      case 'sources':
        return this.handleSourcesResource(pathParts.slice(1));
      case 'search':
        return this.handleSearchResource(pathParts.slice(1));
      case 'document':
        return this.handleDocumentResource(pathParts.slice(1));
      case 'stats':
        return this.handleStatsResource();
      case 'recent':
        return this.handleRecentResource();
      default:
        throw new Error(`Unknown resource path: ${pathParts[0]}`);
    }
  }

  private async handleDocumentsResource(pathParts: string[]): Promise<{ content: string; mimeType: string }> {
    if (pathParts.length === 0) {
      // Get all documents summary
      const sources = await this.storage.getAllSources();
      const documents = [];
      
      for (const source of sources) {
        const sourceDocs = await this.storage.getDocumentsBySource(source.id);
        documents.push(...sourceDocs.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          sourceId: doc.sourceId,
          sourcePath: doc.sourcePath,
          tags: doc.tags,
          updatedAt: doc.updatedAt.toISOString(),
          size: doc.size
        })));
      }

      return {
        content: JSON.stringify({
          count: documents.length,
          documents: documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    throw new Error(`Invalid documents resource path: ${pathParts.join('/')}`);
  }

  private async handleSourcesResource(pathParts: string[]): Promise<{ content: string; mimeType: string }> {
    if (pathParts.length === 0) {
      // Get all sources with status
      const sources = await this.storage.getAllSources();
      const sourcesWithStatus = await Promise.all(
        sources.map(async (source) => {
          const status = await this.storage.getSourceStatus(source.id);
          const documents = await this.storage.getDocumentsBySource(source.id);
          
          return {
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            lastCrawled: source.lastCrawled?.toISOString(),
            status: status?.status || 'idle',
            documentsCount: documents.length,
            filters: source.filters
          };
        })
      );

      return {
        content: JSON.stringify({
          count: sourcesWithStatus.length,
          sources: sourcesWithStatus
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    if (pathParts.length === 1) {
      // Get specific source
      const sourceId = pathParts[0];
      const source = await this.storage.getSource(sourceId);
      
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }

      const status = await this.storage.getSourceStatus(sourceId);
      const documents = await this.storage.getDocumentsBySource(sourceId);

      return {
        content: JSON.stringify({
          source: {
            ...source,
            lastCrawled: source.lastCrawled?.toISOString()
          },
          status,
          documentsCount: documents.length,
          documents: documents.slice(0, 10).map(doc => ({
            id: doc.id,
            title: doc.title,
            type: doc.type,
            updatedAt: doc.updatedAt.toISOString()
          }))
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    throw new Error(`Invalid sources resource path: ${pathParts.join('/')}`);
  }

  private async handleSearchResource(pathParts: string[]): Promise<{ content: string; mimeType: string }> {
    if (pathParts.length === 1) {
      const query = decodeURIComponent(pathParts[0]);
      const results = await this.search.search(query, { limit: 50 });

      return {
        content: JSON.stringify({
          query,
          resultsCount: results.length,
          results: results.map(result => ({
            document: {
              id: result.document.id,
              title: result.document.title,
              type: result.document.type,
              sourceId: result.document.sourceId,
              sourcePath: result.document.sourcePath,
              tags: result.document.tags,
              updatedAt: result.document.updatedAt.toISOString()
            },
            score: result.score,
            highlights: result.highlights
          }))
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    throw new Error(`Invalid search resource path: ${pathParts.join('/')}`);
  }

  private async handleDocumentResource(pathParts: string[]): Promise<{ content: string; mimeType: string }> {
    if (pathParts.length === 1) {
      const documentId = pathParts[0];
      const document = await this.storage.getDocument(documentId);

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Return full document content as plain text for easy reading
      let content = `Title: ${document.title}\n`;
      content += `Type: ${document.type}\n`;
      content += `Source: ${document.sourceId}\n`;
      content += `Path: ${document.sourcePath}\n`;
      content += `Updated: ${document.updatedAt.toISOString()}\n`;
      
      if (document.tags && document.tags.length > 0) {
        content += `Tags: ${document.tags.join(', ')}\n`;
      }
      
      content += '\n' + '='.repeat(80) + '\n\n';
      content += document.content;

      return {
        content,
        mimeType: 'text/plain'
      };
    }

    throw new Error(`Invalid document resource path: ${pathParts.join('/')}`);
  }

  private async handleStatsResource(): Promise<{ content: string; mimeType: string }> {
    const stats = await this.storage.getDocumentStats();
    const indexStats = this.search.getIndexStats();
    const sources = await this.storage.getAllSources();

    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const status = await this.storage.getSourceStatus(source.id);
        const docs = await this.storage.getDocumentsBySource(source.id);
        return {
          name: source.name,
          type: source.type,
          enabled: source.enabled,
          documentsCount: docs.length,
          lastCrawled: source.lastCrawled?.toISOString(),
          status: status?.status || 'idle'
        };
      })
    );

    return {
      content: JSON.stringify({
        overview: {
          totalDocuments: stats.totalDocuments,
          totalSize: stats.totalSize,
          lastUpdated: stats.lastUpdated.toISOString()
        },
        documentsByType: stats.documentsByType,
        documentsBySource: stats.documentsBySource,
        search: {
          indexedDocuments: indexStats.documentCount,
          lastIndexUpdate: indexStats.lastUpdate.toISOString()
        },
        sources: {
          total: sources.length,
          enabled: sources.filter(s => s.enabled).length,
          details: sourcesWithCounts
        }
      }, null, 2),
      mimeType: 'application/json'
    };
  }

  private async handleRecentResource(): Promise<{ content: string; mimeType: string }> {
    const documents = await this.search.getRecentDocuments(30);

    return {
      content: JSON.stringify({
        count: documents.length,
        documents: documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          sourceId: doc.sourceId,
          sourcePath: doc.sourcePath,
          tags: doc.tags,
          updatedAt: doc.updatedAt.toISOString(),
          size: doc.size
        }))
      }, null, 2),
      mimeType: 'application/json'
    };
  }
}