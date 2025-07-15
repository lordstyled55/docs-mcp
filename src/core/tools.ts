import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { StorageService, CrawlerService, SearchService } from './services/index.js';
import { SourceConfigSchema } from './models/source.js';

export class ToolsHandler {
  constructor(
    private storage: StorageService,
    private crawler: CrawlerService,
    private search: SearchService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'add_source',
        description: 'Add a new documentation source to be crawled and indexed',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Human-readable name for the source'
            },
            type: {
              type: 'string',
              enum: ['local', 'git', 'web', 'api'],
              description: 'Type of source to add'
            },
            url: {
              type: 'string',
              description: 'Source URL or path (e.g., file:///path/to/docs, https://github.com/user/repo)'
            },
            enabled: {
              type: 'boolean',
              description: 'Whether the source should be enabled for crawling',
              default: true
            },
            filters: {
              type: 'object',
              properties: {
                include: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Glob patterns for files to include'
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Glob patterns for files to exclude'
                },
                maxDepth: {
                  type: 'number',
                  description: 'Maximum directory depth to crawl'
                },
                maxSize: {
                  type: 'number',
                  description: 'Maximum file size in bytes'
                }
              },
              description: 'Filtering options for the source'
            }
          },
          required: ['name', 'type', 'url']
        }
      },
      {
        name: 'list_sources',
        description: 'List all configured documentation sources',
        inputSchema: {
          type: 'object',
          properties: {
            enabled_only: {
              type: 'boolean',
              description: 'Only show enabled sources',
              default: false
            }
          }
        }
      },
      {
        name: 'get_source',
        description: 'Get detailed information about a specific source',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'ID of the source to retrieve'
            }
          },
          required: ['source_id']
        }
      },
      {
        name: 'update_source',
        description: 'Update an existing documentation source',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'ID of the source to update'
            },
            name: {
              type: 'string',
              description: 'Updated name for the source'
            },
            enabled: {
              type: 'boolean',
              description: 'Whether the source should be enabled'
            },
            filters: {
              type: 'object',
              properties: {
                include: {
                  type: 'array',
                  items: { type: 'string' }
                },
                exclude: {
                  type: 'array',
                  items: { type: 'string' }
                },
                maxDepth: { type: 'number' },
                maxSize: { type: 'number' }
              }
            }
          },
          required: ['source_id']
        }
      },
      {
        name: 'delete_source',
        description: 'Delete a documentation source and all its documents',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'ID of the source to delete'
            }
          },
          required: ['source_id']
        }
      },
      {
        name: 'crawl_source',
        description: 'Manually trigger crawling of a specific source',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'ID of the source to crawl'
            }
          },
          required: ['source_id']
        }
      },
      {
        name: 'crawl_all_sources',
        description: 'Crawl all enabled sources',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'search_docs',
        description: 'Search through all collected documentation',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 20
            },
            threshold: {
              type: 'number',
              description: 'Search similarity threshold (0.0 = exact match, 1.0 = match anything)',
              default: 0.3,
              minimum: 0.0,
              maximum: 1.0
            },
            source_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by specific source IDs'
            },
            types: {
              type: 'array',
              items: { type: 'string', enum: ['markdown', 'html', 'pdf', 'text', 'json'] },
              description: 'Filter by document types'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by document tags'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_document',
        description: 'Retrieve a specific document by ID',
        inputSchema: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              description: 'ID of the document to retrieve'
            }
          },
          required: ['document_id']
        }
      },
      {
        name: 'get_recent_docs',
        description: 'Get recently updated documents',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of documents to return',
              default: 20
            }
          }
        }
      },
      {
        name: 'get_similar_docs',
        description: 'Find documents similar to a given document',
        inputSchema: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              description: 'ID of the reference document'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of similar documents to return',
              default: 10
            }
          },
          required: ['document_id']
        }
      },
      {
        name: 'get_stats',
        description: 'Get statistics about the documentation collection',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async handleToolCall(name: string, arguments_: unknown): Promise<unknown> {
    switch (name) {
      case 'add_source':
        return this.handleAddSource(arguments_);
      case 'list_sources':
        return this.handleListSources(arguments_);
      case 'get_source':
        return this.handleGetSource(arguments_);
      case 'update_source':
        return this.handleUpdateSource(arguments_);
      case 'delete_source':
        return this.handleDeleteSource(arguments_);
      case 'crawl_source':
        return this.handleCrawlSource(arguments_);
      case 'crawl_all_sources':
        return this.handleCrawlAllSources(arguments_);
      case 'search_docs':
        return this.handleSearchDocs(arguments_);
      case 'get_document':
        return this.handleGetDocument(arguments_);
      case 'get_recent_docs':
        return this.handleGetRecentDocs(arguments_);
      case 'get_similar_docs':
        return this.handleGetSimilarDocs(arguments_);
      case 'get_stats':
        return this.handleGetStats(arguments_);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async handleAddSource(args: unknown) {
    const parsed = z.object({
      name: z.string(),
      type: z.enum(['local', 'git', 'web', 'api']),
      url: z.string(),
      enabled: z.boolean().default(true),
      filters: z.object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
        maxDepth: z.number().optional(),
        maxSize: z.number().optional(),
      }).optional()
    }).parse(args);

    const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const source = SourceConfigSchema.parse({
      id,
      name: parsed.name,
      type: parsed.type,
      url: parsed.url,
      enabled: parsed.enabled,
      filters: parsed.filters,
      lastCrawled: undefined
    });

    await this.storage.saveSource(source);
    
    return {
      success: true,
      source_id: id,
      message: `Source '${parsed.name}' added successfully`
    };
  }

  private async handleListSources(args: unknown) {
    const parsed = z.object({
      enabled_only: z.boolean().default(false)
    }).parse(args);

    const sources = await this.storage.getAllSources();
    const filteredSources = parsed.enabled_only ? sources.filter(s => s.enabled) : sources;

    const sourcesWithStatus = await Promise.all(
      filteredSources.map(async (source) => {
        const status = await this.storage.getSourceStatus(source.id);
        return {
          ...source,
          status: status?.status || 'idle',
          lastCrawled: source.lastCrawled?.toISOString(),
          documentsCount: status?.documentsProcessed || 0
        };
      })
    );

    return {
      sources: sourcesWithStatus,
      count: sourcesWithStatus.length
    };
  }

  private async handleGetSource(args: unknown) {
    const parsed = z.object({
      source_id: z.string()
    }).parse(args);

    const source = await this.storage.getSource(parsed.source_id);
    if (!source) {
      throw new Error(`Source not found: ${parsed.source_id}`);
    }

    const status = await this.storage.getSourceStatus(parsed.source_id);
    const documents = await this.storage.getDocumentsBySource(parsed.source_id);

    return {
      source: {
        ...source,
        lastCrawled: source.lastCrawled?.toISOString()
      },
      status,
      documentsCount: documents.length,
      recentDocuments: documents.slice(0, 5).map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        updatedAt: doc.updatedAt.toISOString()
      }))
    };
  }

  private async handleUpdateSource(args: unknown) {
    const parsed = z.object({
      source_id: z.string(),
      name: z.string().optional(),
      enabled: z.boolean().optional(),
      filters: z.object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
        maxDepth: z.number().optional(),
        maxSize: z.number().optional(),
      }).optional()
    }).parse(args);

    const source = await this.storage.getSource(parsed.source_id);
    if (!source) {
      throw new Error(`Source not found: ${parsed.source_id}`);
    }

    const updatedSource = {
      ...source,
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.enabled !== undefined && { enabled: parsed.enabled }),
      ...(parsed.filters && { filters: { ...source.filters, ...parsed.filters } })
    };

    await this.storage.saveSource(updatedSource);

    return {
      success: true,
      message: `Source '${updatedSource.name}' updated successfully`
    };
  }

  private async handleDeleteSource(args: unknown) {
    const parsed = z.object({
      source_id: z.string()
    }).parse(args);

    const source = await this.storage.getSource(parsed.source_id);
    if (!source) {
      throw new Error(`Source not found: ${parsed.source_id}`);
    }

    const deleted = await this.storage.deleteSource(parsed.source_id);
    
    return {
      success: deleted,
      message: deleted ? `Source '${source.name}' deleted successfully` : 'Failed to delete source'
    };
  }

  private async handleCrawlSource(args: unknown) {
    const parsed = z.object({
      source_id: z.string()
    }).parse(args);

    const source = await this.storage.getSource(parsed.source_id);
    if (!source) {
      throw new Error(`Source not found: ${parsed.source_id}`);
    }

    const result = await this.crawler.crawlSource(source);
    
    return {
      success: true,
      source_name: source.name,
      result: {
        documentsFound: result.documentsFound,
        documentsProcessed: result.documentsProcessed,
        documentsSkipped: result.documentsSkipped,
        errors: result.errors
      }
    };
  }

  private async handleCrawlAllSources(args: unknown) {
    const results = await this.crawler.crawlAllEnabledSources();
    
    const summary = {
      sourcesProcessed: results.size,
      totalDocumentsFound: 0,
      totalDocumentsProcessed: 0,
      totalDocumentsSkipped: 0,
      totalErrors: 0,
      sourceResults: [] as any[]
    };

    for (const [sourceId, result] of results) {
      const source = await this.storage.getSource(sourceId);
      summary.totalDocumentsFound += result.documentsFound;
      summary.totalDocumentsProcessed += result.documentsProcessed;
      summary.totalDocumentsSkipped += result.documentsSkipped;
      summary.totalErrors += result.errors.length;
      
      summary.sourceResults.push({
        sourceId,
        sourceName: source?.name || 'Unknown',
        result: {
          documentsFound: result.documentsFound,
          documentsProcessed: result.documentsProcessed,
          documentsSkipped: result.documentsSkipped,
          errors: result.errors
        }
      });
    }

    return summary;
  }

  private async handleSearchDocs(args: unknown) {
    const parsed = z.object({
      query: z.string(),
      limit: z.number().default(20),
      threshold: z.number().min(0).max(1).default(0.3),
      source_ids: z.array(z.string()).optional(),
      types: z.array(z.enum(['markdown', 'html', 'pdf', 'text', 'json'])).optional(),
      tags: z.array(z.string()).optional()
    }).parse(args);

    const results = await this.search.search(parsed.query, {
      limit: parsed.limit,
      threshold: parsed.threshold,
      sourceIds: parsed.source_ids,
      types: parsed.types,
      tags: parsed.tags
    });

    return {
      query: parsed.query,
      resultsCount: results.length,
      results: results.map(result => ({
        document: {
          id: result.document.id,
          title: result.document.title,
          type: result.document.type,
          sourceId: result.document.sourceId,
          sourcePath: result.document.sourcePath,
          tags: result.document.tags,
          updatedAt: result.document.updatedAt.toISOString(),
          size: result.document.size
        },
        score: result.score,
        highlights: result.highlights
      }))
    };
  }

  private async handleGetDocument(args: unknown) {
    const parsed = z.object({
      document_id: z.string()
    }).parse(args);

    const document = await this.storage.getDocument(parsed.document_id);
    if (!document) {
      throw new Error(`Document not found: ${parsed.document_id}`);
    }

    return {
      id: document.id,
      title: document.title,
      content: document.content,
      type: document.type,
      sourceId: document.sourceId,
      sourcePath: document.sourcePath,
      metadata: document.metadata,
      tags: document.tags,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      size: document.size,
      checksum: document.checksum
    };
  }

  private async handleGetRecentDocs(args: unknown) {
    const parsed = z.object({
      limit: z.number().default(20)
    }).parse(args);

    const documents = await this.search.getRecentDocuments(parsed.limit);

    return {
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
    };
  }

  private async handleGetSimilarDocs(args: unknown) {
    const parsed = z.object({
      document_id: z.string(),
      limit: z.number().default(10)
    }).parse(args);

    const results = await this.search.getSimilarDocuments(parsed.document_id, parsed.limit);

    return {
      referenceDocumentId: parsed.document_id,
      count: results.length,
      similarDocuments: results.map(result => ({
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
    };
  }

  private async handleGetStats(args: unknown) {
    const stats = await this.storage.getDocumentStats();
    const indexStats = this.search.getIndexStats();

    return {
      documents: {
        total: stats.totalDocuments,
        byType: stats.documentsByType,
        bySource: stats.documentsBySource,
        totalSize: stats.totalSize,
        lastUpdated: stats.lastUpdated.toISOString()
      },
      search: {
        indexedDocuments: indexStats.documentCount,
        lastIndexUpdate: indexStats.lastUpdate.toISOString()
      }
    };
  }
}