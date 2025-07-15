#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { StorageService, CrawlerService, SearchService } from './core/services/index.js';
import { ToolsHandler } from './core/tools.js';
import { ResourcesHandler } from './core/resources.js';
import { PromptsHandler } from './core/prompts.js';

class AutoGatherMCPServer {
  private server: Server;
  private storage: StorageService;
  private crawler: CrawlerService;
  private search: SearchService;
  private tools: ToolsHandler;
  private resources: ResourcesHandler;
  private prompts: PromptsHandler;

  constructor() {
    this.server = new Server(
      {
        name: 'auto-gather-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Initialize services
    this.storage = new StorageService();
    this.crawler = new CrawlerService(this.storage);
    this.search = new SearchService(this.storage);

    // Initialize handlers
    this.tools = new ToolsHandler(this.storage, this.crawler, this.search);
    this.resources = new ResourcesHandler(this.storage, this.search);
    this.prompts = new PromptsHandler(this.storage, this.search);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.tools.handleToolCall(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.resources.getResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        const result = await this.resources.handleResourceRequest(uri);
        return {
          contents: [
            {
              uri,
              mimeType: result.mimeType,
              text: result.content,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });

    // Prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.prompts.getPrompts(),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.prompts.handlePromptRequest(name, args || {});
        return {
          description: `Generated ${name} prompt`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: result.content,
              },
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          description: `Error generating ${name} prompt`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            },
          ],
        };
      }
    });
  }

  async start(): Promise<void> {
    // Initialize storage and search index
    await this.storage.initialize();
    await this.search.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Auto-Gather MCP Server started successfully');
    console.error('Ready to discover, collect, and organize documentation!');
  }

  async stop(): Promise<void> {
    this.storage.close();
    await this.server.close();
  }
}

// Handle graceful shutdown
async function main() {
  const server = new AutoGatherMCPServer();

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { AutoGatherMCPServer };