# Auto-Gather MCP Server

An MCP server that automatically discovers, collects, and organizes documentation from various sources. Built for the Model Context Protocol (MCP), this server provides AI assistants with intelligent access to your documentation ecosystem.

## Features

### 🔍 Multi-Source Documentation Collection
- **Local Files**: Crawl local directories for documentation
- **Git Repositories**: *(Coming soon)* Clone and index git repos
- **Web Sources**: *(Coming soon)* Crawl websites and wikis
- **API Sources**: *(Coming soon)* Pull from documentation APIs

### 📄 Multi-Format Support
- **Markdown** files (`.md`, `.markdown`)
- **HTML** pages (`.html`, `.htm`)
- **PDF** documents (`.pdf`)
- **Text** files (`.txt`)
- **JSON** data (`.json`)

### 🔎 Intelligent Search
- **Fuzzy search** powered by Fuse.js
- **Content highlighting** in search results
- **Tag-based filtering** and organization
- **Similarity search** for related documents

### 🤖 AI-Powered Analysis
- **Documentation analysis** for quality and completeness
- **Gap identification** in coverage
- **Improvement suggestions** for existing content
- **Outline generation** based on existing docs

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Clone or create project:**
   ```bash
   git clone <repository-url>
   cd auto-gather-mcp-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Configure sources** (see Configuration section below)

## Configuration

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "auto-gather": {
      "command": "node",
      "args": ["/path/to/auto-gather-mcp-server/build/index.js"],
      "cwd": "/path/to/auto-gather-mcp-server"
    }
  }
}
```

### Documentation Sources

Use the MCP tools to configure sources, or create a configuration manually:

1. **Add a local documentation source:**
   ```javascript
   // Use the add_source tool
   {
     "name": "My Project Docs",
     "type": "local", 
     "url": "file:///path/to/docs",
     "filters": {
       "include": ["*.md", "*.txt"],
       "exclude": ["node_modules/**", ".git/**"],
       "maxDepth": 5,
       "maxSize": 10485760
     }
   }
   ```

2. **Example configuration** is provided in `config/sources.example.json`

## Usage

### Available Tools

#### Source Management
- **`add_source`** - Add new documentation sources
- **`list_sources`** - View all configured sources
- **`get_source`** - Get detailed source information
- **`update_source`** - Modify source settings
- **`delete_source`** - Remove sources and their documents
- **`crawl_source`** - Manually trigger source crawling
- **`crawl_all_sources`** - Crawl all enabled sources

#### Document Access
- **`search_docs`** - Search through collected documentation
- **`get_document`** - Retrieve specific documents
- **`get_recent_docs`** - Get recently updated documents
- **`get_similar_docs`** - Find similar documents
- **`get_stats`** - View collection statistics

### Available Resources

#### Live Data Access
- **`docs://documents`** - Access all collected documents
- **`docs://sources`** - View source configurations and status
- **`docs://search/{query}`** - Live search results
- **`docs://document/{id}`** - Individual document content
- **`docs://stats`** - Collection statistics
- **`docs://recent`** - Recently updated documents

### Available Prompts

#### AI-Powered Analysis
- **`analyze_documentation`** - Comprehensive documentation analysis
- **`suggest_improvements`** - AI-powered improvement suggestions
- **`create_outline`** - Generate documentation outlines
- **`summarize_content`** - Create content summaries
- **`find_gaps`** - Identify documentation gaps

## Examples

### Basic Workflow

1. **Add a documentation source:**
   ```bash
   # Via MCP tool call
   add_source {
     "name": "Project Documentation",
     "type": "local",
     "url": "file:///Users/me/projects/myapp/docs"
   }
   ```

2. **Crawl the source:**
   ```bash
   crawl_source { "source_id": "source_123" }
   ```

3. **Search for information:**
   ```bash
   search_docs { 
     "query": "authentication setup",
     "limit": 10
   }
   ```

4. **Get AI analysis:**
   ```bash
   analyze_documentation {
     "focus_area": "API documentation"
   }
   ```

### Advanced Search

```bash
# Search with filters
search_docs {
  "query": "database configuration",
  "types": ["markdown", "json"],
  "tags": ["setup", "config"],
  "threshold": 0.2
}

# Find similar documents
get_similar_docs {
  "document_id": "doc_abc123",
  "limit": 5
}
```

### AI-Powered Analysis

```bash
# Analyze specific source
analyze_documentation {
  "source_id": "local_docs",
  "focus_area": "getting started"
}

# Find documentation gaps
find_gaps {
  "reference_topics": ["installation", "configuration", "troubleshooting"],
  "comparison_source": "main_docs"
}

# Generate improvement suggestions
suggest_improvements {
  "document_id": "doc_123",
  "criteria": "clarity"
}
```

## Architecture

### Core Components

```
src/
├── core/
│   ├── models/          # Data models (Document, Source)
│   ├── services/        # Core business logic
│   │   ├── storage.ts   # SQLite database operations
│   │   ├── parser.ts    # Multi-format document parsing
│   │   ├── crawler.ts   # Source crawling logic
│   │   └── search.ts    # Search and indexing
│   ├── tools.ts         # MCP tools implementation
│   ├── resources.ts     # MCP resources implementation
│   └── prompts.ts       # MCP prompts implementation
└── index.ts             # Main server entry point
```

### Data Storage

- **SQLite database** for document storage and metadata
- **File-based configuration** for source management
- **In-memory search index** using Fuse.js

### Supported File Types

| Extension | Type | Parser |
|-----------|------|--------|
| `.md`, `.markdown` | Markdown | gray-matter + markdown-it |
| `.html`, `.htm` | HTML | cheerio |
| `.pdf` | PDF | pdf-parse |
| `.txt` | Text | Built-in |
| `.json` | JSON | Built-in |

## Development

### Scripts

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode compilation
npm run start      # Start the server
npm run clean      # Clean build artifacts
```

### Project Structure

The server follows a modular architecture:

- **Models**: Zod schemas for type safety
- **Services**: Core business logic with clear interfaces
- **Handlers**: MCP protocol implementations
- **Storage**: SQLite with prepared statements
- **Search**: Fuzzy search with configurable options

### Adding New Source Types

1. Extend the `SourceType` enum in `models/source.ts`
2. Implement crawling logic in `CrawlerService`
3. Add parsing logic if needed in `ParserService`
4. Update tool schemas and handlers

### Adding New File Types

1. Add extension to `ParserService.getSupportedExtensions()`
2. Implement parsing logic in `ParserService.parseFile()`
3. Add appropriate content extraction methods

## Troubleshooting

### Common Issues

**Database locked errors:**
- Ensure only one server instance is running
- Check file permissions in the `data/` directory

**Source crawling fails:**
- Verify file paths are accessible
- Check filter patterns (glob syntax)
- Review source status with `get_source` tool

**Search returns no results:**
- Rebuild search index: restart the server
- Check if documents were successfully crawled
- Verify search query and filters

**Performance issues:**
- Reduce `maxDepth` in source filters
- Set appropriate `maxSize` limits
- Consider excluding large binary files

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=auto-gather* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

### Phase 2: Enhanced Sources
- [ ] Git repository support
- [ ] Web crawling capabilities  
- [ ] API documentation sources
- [ ] Webhook notifications

### Phase 3: Advanced Features
- [ ] Real-time collaboration
- [ ] Advanced AI analysis
- [ ] Custom export templates
- [ ] Multi-language support

### Phase 4: Enterprise Features
- [ ] Authentication and authorization
- [ ] Team workflow integration
- [ ] Advanced analytics dashboard
- [ ] Custom plugin architecture

---

**Need help?** Check the documentation, search existing issues, or create a new issue for support.
