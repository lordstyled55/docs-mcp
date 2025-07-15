import { Prompt } from '@modelcontextprotocol/sdk/types.js';
import { StorageService, SearchService } from './services/index.js';

export class PromptsHandler {
  constructor(
    private storage: StorageService,
    private search: SearchService
  ) {}

  getPrompts(): Prompt[] {
    return [
      {
        name: 'analyze_documentation',
        description: 'Analyze documentation collection for completeness, quality, and gaps',
        arguments: [
          {
            name: 'source_id',
            description: 'Optional: Analyze specific source only',
            required: false
          },
          {
            name: 'focus_area',
            description: 'Optional: Focus analysis on specific area (e.g., "API", "setup", "examples")',
            required: false
          }
        ]
      },
      {
        name: 'suggest_improvements',
        description: 'Suggest improvements for documentation based on analysis',
        arguments: [
          {
            name: 'document_id',
            description: 'Optional: Suggest improvements for specific document',
            required: false
          },
          {
            name: 'criteria',
            description: 'Improvement criteria (e.g., "clarity", "completeness", "examples")',
            required: false
          }
        ]
      },
      {
        name: 'create_outline',
        description: 'Generate documentation structure outline based on existing content',
        arguments: [
          {
            name: 'topic',
            description: 'Topic or area to create outline for',
            required: true
          },
          {
            name: 'depth',
            description: 'Outline depth level (1-5)',
            required: false
          }
        ]
      },
      {
        name: 'summarize_content',
        description: 'Create summaries of documentation content',
        arguments: [
          {
            name: 'scope',
            description: 'Scope of summary: "all", "source", "topic", or "recent"',
            required: true
          },
          {
            name: 'identifier',
            description: 'Source ID, topic name, or search query (depending on scope)',
            required: false
          },
          {
            name: 'length',
            description: 'Summary length: "brief", "medium", or "detailed"',
            required: false
          }
        ]
      },
      {
        name: 'find_gaps',
        description: 'Identify gaps in documentation coverage',
        arguments: [
          {
            name: 'reference_topics',
            description: 'Optional: List of topics that should be covered',
            required: false
          },
          {
            name: 'comparison_source',
            description: 'Optional: Compare against another documentation source',
            required: false
          }
        ]
      }
    ];
  }

  async handlePromptRequest(name: string, arguments_: Record<string, unknown>): Promise<{ content: string }> {
    switch (name) {
      case 'analyze_documentation':
        return this.handleAnalyzeDocumentation(arguments_);
      case 'suggest_improvements':
        return this.handleSuggestImprovements(arguments_);
      case 'create_outline':
        return this.handleCreateOutline(arguments_);
      case 'summarize_content':
        return this.handleSummarizeContent(arguments_);
      case 'find_gaps':
        return this.handleFindGaps(arguments_);
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  private async handleAnalyzeDocumentation(args: Record<string, unknown>): Promise<{ content: string }> {
    const sourceId = args.source_id as string | undefined;
    const focusArea = args.focus_area as string | undefined;

    // Gather documentation data
    let documents: any[] = [];
    let sources: any[] = [];

    if (sourceId) {
      const source = await this.storage.getSource(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      sources.push(source);
      const sourceDocs = await this.storage.getDocumentsBySource(sourceId);
      documents = sourceDocs;
    } else {
      sources = await this.storage.getAllSources();
      for (const source of sources) {
        const sourceDocs = await this.storage.getDocumentsBySource(source.id);
        documents.push(...sourceDocs);
      }
    }

    // Filter by focus area if specified
    if (focusArea) {
      documents = documents.filter(doc => 
        doc.title.toLowerCase().includes(focusArea.toLowerCase()) ||
        doc.content.toLowerCase().includes(focusArea.toLowerCase()) ||
        (doc.tags && doc.tags.some((tag: string) => tag.toLowerCase().includes(focusArea.toLowerCase())))
      );
    }

    const stats = await this.storage.getDocumentStats();

    let content = "# Documentation Analysis Report\n\n";
    
    if (sourceId) {
      content += `**Analysis Scope:** Source "${sources[0].name}" (${sourceId})\n`;
    } else {
      content += "**Analysis Scope:** All documentation sources\n";
    }
    
    if (focusArea) {
      content += `**Focus Area:** ${focusArea}\n`;
    }
    
    content += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Overview
    content += "## Overview\n\n";
    content += `- **Total Documents:** ${documents.length}\n`;
    content += `- **Document Types:** ${Object.entries(stats.documentsByType).map(([type, count]) => `${type} (${count})`).join(', ')}\n`;
    content += `- **Total Size:** ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n`;
    content += `- **Last Updated:** ${stats.lastUpdated.toISOString()}\n\n`;

    // Content analysis
    content += "## Content Analysis\n\n";
    
    const typeDistribution = documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

         content += "### Document Type Distribution\n";
     for (const [type, count] of Object.entries(typeDistribution)) {
       const percentage = ((count as number / documents.length) * 100).toFixed(1);
       content += `- **${type}:** ${count} documents (${percentage}%)\n`;
     }
     content += "\n";

    // Source analysis
    if (!sourceId && sources.length > 1) {
      content += "### Source Analysis\n";
      const sourceStats = documents.reduce((acc, doc) => {
        acc[doc.sourceId] = (acc[doc.sourceId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

             for (const [sourceId, count] of Object.entries(sourceStats)) {
         const source = sources.find(s => s.id === sourceId);
         const percentage = ((count as number / documents.length) * 100).toFixed(1);
         content += `- **${source?.name || sourceId}:** ${count} documents (${percentage}%)\n`;
       }
      content += "\n";
    }

    // Recent activity
    content += "### Recent Activity\n";
    const recentDocs = documents
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10);
    
    if (recentDocs.length > 0) {
      content += "Most recently updated documents:\n";
      for (const doc of recentDocs) {
        content += `- **${doc.title}** (${doc.type}) - ${doc.updatedAt.toISOString()}\n`;
      }
    } else {
      content += "No recent activity found.\n";
    }
    content += "\n";

    // Analysis recommendations
    content += "## Analysis & Recommendations\n\n";
    content += "### Quality Assessment\n";

    // Check for common issues
    const docsWithoutTitles = documents.filter(doc => !doc.title || doc.title.trim() === '');
    const docsWithoutTags = documents.filter(doc => !doc.tags || doc.tags.length === 0);
    const smallDocs = documents.filter(doc => doc.content.length < 100);
    const largeDocs = documents.filter(doc => doc.content.length > 50000);

    if (docsWithoutTitles.length > 0) {
      content += `- **⚠️ ${docsWithoutTitles.length} documents missing proper titles**\n`;
    }
    if (docsWithoutTags.length > 0) {
      content += `- **ℹ️ ${docsWithoutTags.length} documents without tags** (${((docsWithoutTags.length / documents.length) * 100).toFixed(1)}%)\n`;
    }
    if (smallDocs.length > 0) {
      content += `- **⚠️ ${smallDocs.length} very small documents** (< 100 characters)\n`;
    }
    if (largeDocs.length > 0) {
      content += `- **ℹ️ ${largeDocs.length} very large documents** (> 50,000 characters)\n`;
    }

    content += "\n### Improvement Suggestions\n";
    
    if (docsWithoutTags.length > documents.length * 0.5) {
      content += "- **Add tags to documents** to improve discoverability and organization\n";
    }
    
    if (typeDistribution.markdown && typeDistribution.markdown > documents.length * 0.7) {
      content += "- **Consider diversifying document types** (add HTML, PDF, or structured JSON content)\n";
    }
    
    if (documents.length < 10) {
      content += "- **Expand documentation coverage** - consider adding more sources or content\n";
    }

    content += "- **Regular updates** - ensure documentation stays current with recent changes\n";
    content += "- **Cross-references** - add links between related documents\n";
    content += "- **Examples and tutorials** - enhance with practical examples\n";

    return { content };
  }

  private async handleSuggestImprovements(args: Record<string, unknown>): Promise<{ content: string }> {
    const documentId = args.document_id as string | undefined;
    const criteria = args.criteria as string | undefined;

    let content = "# Documentation Improvement Suggestions\n\n";
    content += `**Generated:** ${new Date().toISOString()}\n\n`;

    if (documentId) {
      // Analyze specific document
      const document = await this.storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      content += `**Document:** ${document.title}\n`;
      content += `**Type:** ${document.type}\n`;
      content += `**Source:** ${document.sourceId}\n`;
      content += `**Path:** ${document.sourcePath}\n\n`;

      content += "## Document Analysis\n\n";
      content += `- **Content Length:** ${document.content.length} characters\n`;
      content += `- **Word Count:** ~${document.content.split(/\s+/).length} words\n`;
      content += `- **Has Tags:** ${document.tags && document.tags.length > 0 ? 'Yes' : 'No'}\n`;
      content += `- **Last Updated:** ${document.updatedAt.toISOString()}\n\n`;

      content += "## Specific Suggestions\n\n";

      // Title analysis
      if (!document.title || document.title.trim().length < 3) {
        content += "### Title\n";
        content += "- **Issue:** Missing or very short title\n";
        content += "- **Suggestion:** Add a descriptive title that clearly indicates the document's purpose\n\n";
      }

      // Content structure
      if (document.type === 'markdown' && !document.content.includes('#')) {
        content += "### Structure\n";
        content += "- **Issue:** No headings detected in markdown content\n";
        content += "- **Suggestion:** Add headings to create a clear document structure\n\n";
      }

      // Tags
      if (!document.tags || document.tags.length === 0) {
        content += "### Tags\n";
        content += "- **Issue:** No tags assigned\n";
        content += "- **Suggestion:** Add relevant tags to improve discoverability\n\n";
      }

      // Content quality
      if (document.content.length < 200) {
        content += "### Content\n";
        content += "- **Issue:** Very short content\n";
        content += "- **Suggestion:** Consider expanding with examples, explanations, or additional details\n\n";
      }

      // Find similar documents for cross-referencing
      const similarDocs = await this.search.getSimilarDocuments(documentId, 3);
      if (similarDocs.length > 0) {
        content += "### Cross-References\n";
        content += "- **Suggestion:** Consider adding links to related documents:\n";
        for (const similar of similarDocs) {
          content += `  - ${similar.document.title} (score: ${similar.score.toFixed(2)})\n`;
        }
        content += "\n";
      }

    } else {
      // General improvements across all documentation
      const stats = await this.storage.getDocumentStats();
      const sources = await this.storage.getAllSources();
      
      content += "## General Documentation Improvements\n\n";

      // Coverage analysis
      content += "### Coverage\n";
      content += `- **Total Documents:** ${stats.totalDocuments}\n`;
      content += `- **Sources:** ${sources.length} configured, ${sources.filter(s => s.enabled).length} enabled\n\n`;

      if (stats.totalDocuments < 50) {
        content += "**Suggestion:** Expand documentation coverage by:\n";
        content += "- Adding more documentation sources\n";
        content += "- Including different types of content (tutorials, API docs, examples)\n";
        content += "- Documenting internal processes and decisions\n\n";
      }

      // Type diversity
      content += "### Content Diversity\n";
      const typeCount = Object.keys(stats.documentsByType).length;
      content += `- **Document Types:** ${typeCount} different types\n`;
      
      if (typeCount < 3) {
        content += "**Suggestion:** Diversify content types:\n";
        content += "- Add visual content (HTML pages with diagrams)\n";
        content += "- Include structured data (JSON configurations)\n";
        content += "- Consider video transcripts or presentation notes\n\n";
      }

      // Maintenance
      content += "### Maintenance\n";
      const lastUpdate = stats.lastUpdated;
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      
      content += `- **Last Update:** ${Math.round(daysSinceUpdate)} days ago\n`;
      
      if (daysSinceUpdate > 30) {
        content += "**Suggestion:** Documentation appears stale:\n";
        content += "- Set up regular crawling schedules\n";
        content += "- Review and update existing content\n";
        content += "- Add new sources for current information\n\n";
      }
    }

    // Criteria-specific suggestions
    if (criteria) {
      content += `## Specific Focus: ${criteria}\n\n`;
      
      switch (criteria.toLowerCase()) {
        case 'clarity':
          content += "### Clarity Improvements\n";
          content += "- Use clear, concise language\n";
          content += "- Define technical terms and acronyms\n";
          content += "- Structure content with clear headings\n";
          content += "- Use bullet points and lists for readability\n\n";
          break;
          
        case 'completeness':
          content += "### Completeness Improvements\n";
          content += "- Add comprehensive examples\n";
          content += "- Include error handling scenarios\n";
          content += "- Document all available options/parameters\n";
          content += "- Add troubleshooting sections\n\n";
          break;
          
        case 'examples':
          content += "### Example Improvements\n";
          content += "- Add practical, real-world examples\n";
          content += "- Include code snippets with explanations\n";
          content += "- Show before/after scenarios\n";
          content += "- Provide step-by-step tutorials\n\n";
          break;
      }
    }

    return { content };
  }

  private async handleCreateOutline(args: Record<string, unknown>): Promise<{ content: string }> {
    const topic = args.topic as string;
    const depth = (args.depth as number) || 3;

    if (!topic) {
      throw new Error("Topic is required for outline creation");
    }

    // Search for relevant documents
    const searchResults = await this.search.search(topic, { limit: 20 });
    
    let content = `# Documentation Outline: ${topic}\n\n`;
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Depth Level:** ${depth}\n`;
    content += `**Based on:** ${searchResults.length} relevant documents\n\n`;

    if (searchResults.length === 0) {
      content += "## No Existing Content Found\n\n";
      content += "### Suggested Outline Structure\n";
      content += "1. **Introduction**\n";
      content += "   - Overview\n";
      content += "   - Key concepts\n";
      content += "2. **Getting Started**\n";
      content += "   - Prerequisites\n";
      content += "   - Setup instructions\n";
      content += "3. **Main Content**\n";
      content += "   - Core functionality\n";
      content += "   - Examples\n";
      content += "4. **Advanced Topics**\n";
      content += "   - Best practices\n";
      content += "   - Troubleshooting\n";
      content += "5. **Reference**\n";
      content += "   - API documentation\n";
      content += "   - Configuration options\n\n";
      return { content };
    }

    content += "## Analysis of Existing Content\n\n";
    
    // Analyze document titles and content to create structure
    const sections = new Map<string, string[]>();
    
    for (const result of searchResults) {
      const doc = result.document;
      
      // Extract potential section headers from content
      const lines = doc.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || (trimmed.length > 0 && trimmed.length < 100 && /^[A-Z][a-zA-Z\s]+$/.test(trimmed))) {
          const sectionKey = this.normalizeSection(trimmed);
          if (!sections.has(sectionKey)) {
            sections.set(sectionKey, []);
          }
          sections.get(sectionKey)!.push(doc.title);
        }
      }
    }

    // Create outline based on found content
    content += "### Current Content Coverage\n";
    for (const result of searchResults.slice(0, 10)) {
      content += `- **${result.document.title}** (${result.document.type}) - Score: ${result.score.toFixed(2)}\n`;
    }
    content += "\n";

    content += "## Proposed Outline Structure\n\n";
    
    // Generate structured outline
    const outlineItems = this.generateOutlineStructure(topic, sections, depth);
    
    for (let i = 0; i < outlineItems.length; i++) {
      const item = outlineItems[i];
      content += this.formatOutlineItem(item, 1, depth);
    }

    content += "\n## Implementation Notes\n\n";
    content += "- **Existing Coverage:** Review highlighted documents for current content\n";
    content += "- **Gaps:** Identify sections that need new content\n";
    content += "- **Cross-References:** Link related sections together\n";
    content += "- **Examples:** Ensure each major section has practical examples\n";

    return { content };
  }

  private async handleSummarizeContent(args: Record<string, unknown>): Promise<{ content: string }> {
    const scope = args.scope as string;
    const identifier = args.identifier as string | undefined;
    const length = (args.length as string) || 'medium';

    if (!scope) {
      throw new Error("Scope is required for content summarization");
    }

    let documents: any[] = [];
    let content = `# Documentation Summary\n\n`;
    content += `**Scope:** ${scope}\n`;
    content += `**Length:** ${length}\n`;
    content += `**Generated:** ${new Date().toISOString()}\n\n`;

    switch (scope) {
      case 'all':
        const allSources = await this.storage.getAllSources();
        for (const source of allSources) {
          const sourceDocs = await this.storage.getDocumentsBySource(source.id);
          documents.push(...sourceDocs);
        }
        content += `**Coverage:** All ${documents.length} documents across ${allSources.length} sources\n\n`;
        break;

      case 'source':
        if (!identifier) {
          throw new Error("Source ID required when scope is 'source'");
        }
        const source = await this.storage.getSource(identifier);
        if (!source) {
          throw new Error(`Source not found: ${identifier}`);
        }
        documents = await this.storage.getDocumentsBySource(identifier);
        content += `**Source:** ${source.name}\n`;
        content += `**Coverage:** ${documents.length} documents\n\n`;
        break;

      case 'topic':
        if (!identifier) {
          throw new Error("Topic query required when scope is 'topic'");
        }
        const searchResults = await this.search.search(identifier, { limit: 50 });
        documents = searchResults.map(r => r.document);
        content += `**Topic:** ${identifier}\n`;
        content += `**Coverage:** ${documents.length} matching documents\n\n`;
        break;

      case 'recent':
        documents = await this.search.getRecentDocuments(20);
        content += `**Coverage:** ${documents.length} most recently updated documents\n\n`;
        break;

      default:
        throw new Error(`Unknown scope: ${scope}`);
    }

    if (documents.length === 0) {
      content += "## No Content Found\n\n";
      content += "No documents match the specified scope and criteria.\n";
      return { content };
    }

    // Generate summary based on length preference
    content += "## Summary\n\n";

    if (length === 'brief') {
      content += this.generateBriefSummary(documents);
    } else if (length === 'detailed') {
      content += this.generateDetailedSummary(documents);
    } else {
      content += this.generateMediumSummary(documents);
    }

    return { content };
  }

  private async handleFindGaps(args: Record<string, unknown>): Promise<{ content: string }> {
    const referenceTopics = args.reference_topics as string[] | undefined;
    const comparisonSource = args.comparison_source as string | undefined;

    let content = "# Documentation Gap Analysis\n\n";
    content += `**Generated:** ${new Date().toISOString()}\n\n`;

    const allSources = await this.storage.getAllSources();
    const stats = await this.storage.getDocumentStats();

    content += "## Current Coverage\n\n";
    content += `- **Total Documents:** ${stats.totalDocuments}\n`;
    content += `- **Active Sources:** ${allSources.filter(s => s.enabled).length}\n`;
    content += `- **Document Types:** ${Object.keys(stats.documentsByType).join(', ')}\n\n`;

    // Analyze gaps based on reference topics
    if (referenceTopics && referenceTopics.length > 0) {
      content += "## Topic Coverage Analysis\n\n";
      
      for (const topic of referenceTopics) {
        const results = await this.search.search(topic, { limit: 10 });
        content += `### ${topic}\n`;
        
        if (results.length === 0) {
          content += "❌ **No coverage found** - This topic needs documentation\n\n";
        } else if (results.length < 3) {
          content += `⚠️ **Limited coverage** - Only ${results.length} document(s) found:\n`;
          for (const result of results) {
            content += `- ${result.document.title} (score: ${result.score.toFixed(2)})\n`;
          }
          content += "\n";
        } else {
          content += `✅ **Good coverage** - ${results.length} documents found\n\n`;
        }
      }
    }

    // Source-specific gaps
    content += "## Source Analysis\n\n";
    
    for (const source of allSources) {
      const sourceDocs = await this.storage.getDocumentsBySource(source.id);
      const status = await this.storage.getSourceStatus(source.id);
      
      content += `### ${source.name}\n`;
      content += `- **Status:** ${source.enabled ? 'Enabled' : 'Disabled'}\n`;
      content += `- **Documents:** ${sourceDocs.length}\n`;
      content += `- **Last Crawled:** ${source.lastCrawled?.toISOString() || 'Never'}\n`;
      
      if (!source.enabled) {
        content += "⚠️ **Source disabled** - Enable to include in documentation\n";
      } else if (sourceDocs.length === 0) {
        content += "❌ **No documents** - Check source configuration and accessibility\n";
      } else if (status?.status === 'error') {
        content += `❌ **Crawling errors** - ${status.lastError}\n`;
      }
      content += "\n";
    }

    // Comparison analysis
    if (comparisonSource) {
      content += "## Comparison Analysis\n\n";
      content += `Comparing against source: ${comparisonSource}\n\n`;
      
      const refSource = await this.storage.getSource(comparisonSource);
      if (refSource) {
        const refDocs = await this.storage.getDocumentsBySource(comparisonSource);
        
        // Extract topics from reference source
        const refTopics = new Set<string>();
        for (const doc of refDocs) {
          if (doc.tags) {
            doc.tags.forEach(tag => refTopics.add(tag));
          }
          // Extract key terms from titles
          const titleWords = doc.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          titleWords.forEach(word => refTopics.add(word));
        }

        content += "### Topics in reference source but missing elsewhere:\n";
        let gapsFound = 0;
        
        for (const topic of Array.from(refTopics).slice(0, 20)) {
          const otherResults = await this.search.search(topic, { 
            limit: 5,
            sourceIds: allSources.filter(s => s.id !== comparisonSource).map(s => s.id)
          });
          
          if (otherResults.length === 0) {
            content += `- **${topic}** - Only in ${refSource.name}\n`;
            gapsFound++;
          }
        }
        
        if (gapsFound === 0) {
          content += "✅ No significant gaps found\n";
        }
      } else {
        content += `❌ Comparison source not found: ${comparisonSource}\n`;
      }
    }

    // General recommendations
    content += "\n## Recommendations\n\n";
    content += "### High Priority\n";
    
    if (stats.totalDocuments < 20) {
      content += "- **Expand content coverage** - Add more documentation sources\n";
    }
    
    const disabledSources = allSources.filter(s => !s.enabled);
    if (disabledSources.length > 0) {
      content += `- **Enable ${disabledSources.length} disabled source(s)** to increase coverage\n`;
    }
    
    const errorSources = await Promise.all(
      allSources.map(async s => ({
        source: s,
        status: await this.storage.getSourceStatus(s.id)
      }))
    );
    const sourcesWithErrors = errorSources.filter(s => s.status?.status === 'error');
    
    if (sourcesWithErrors.length > 0) {
      content += `- **Fix ${sourcesWithErrors.length} source(s) with errors**\n`;
    }

    content += "\n### Medium Priority\n";
    content += "- **Add cross-references** between related documents\n";
    content += "- **Standardize tagging** for better discoverability\n";
    content += "- **Regular content reviews** to ensure accuracy\n";

    return { content };
  }

  private normalizeSection(text: string): string {
    return text.replace(/^#+\s*/, '').toLowerCase().trim();
  }

  private generateOutlineStructure(topic: string, sections: Map<string, string[]>, depth: number): any[] {
    // This is a simplified outline generator
    // In a real implementation, you might use NLP or more sophisticated analysis
    
    const commonSections = [
      { title: 'Introduction', subsections: ['Overview', 'Prerequisites', 'Key Concepts'] },
      { title: 'Getting Started', subsections: ['Installation', 'Setup', 'First Steps'] },
      { title: 'Core Features', subsections: ['Basic Usage', 'Examples', 'Common Patterns'] },
      { title: 'Advanced Topics', subsections: ['Configuration', 'Customization', 'Integration'] },
      { title: 'Reference', subsections: ['API Documentation', 'Command Reference', 'Configuration Options'] },
      { title: 'Troubleshooting', subsections: ['Common Issues', 'Error Messages', 'FAQ'] }
    ];

    return commonSections.map(section => ({
      ...section,
      subsections: depth > 1 ? section.subsections : []
    }));
  }

  private formatOutlineItem(item: any, level: number, maxDepth: number): string {
    const indent = '  '.repeat(level - 1);
    const bullet = level === 1 ? '##' : '-';
    let result = `${indent}${bullet} **${item.title}**\n`;
    
    if (level < maxDepth && item.subsections) {
      for (const sub of item.subsections) {
        result += `${indent}  - ${sub}\n`;
      }
    }
    
    return result + '\n';
  }

  private generateBriefSummary(documents: any[]): string {
    const totalDocs = documents.length;
    const types = [...new Set(documents.map(d => d.type))];
    const recentCount = documents.filter(d => {
      const daysSince = (Date.now() - d.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30;
    }).length;

    return `**${totalDocs} documents** covering ${types.join(', ')} formats. ` +
           `${recentCount} documents updated in the last 30 days. ` +
           `Key topics include the most frequently mentioned concepts across all content.`;
  }

  private generateMediumSummary(documents: any[]): string {
    let summary = `This collection contains **${documents.length} documents** spanning multiple formats and topics.\n\n`;
    
    // Type breakdown
    const typeStats = documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    summary += "### Content Types\n";
    for (const [type, count] of Object.entries(typeStats)) {
      summary += `- **${type}**: ${count} documents\n`;
    }
    summary += "\n";

    // Recent activity
    const recent = documents
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5);
    
    summary += "### Recent Updates\n";
    for (const doc of recent) {
      summary += `- ${doc.title} (${doc.updatedAt.toDateString()})\n`;
    }
    summary += "\n";

    // Tag analysis
    const allTags = documents.flatMap(d => d.tags || []);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
         const topTags = Object.entries(tagCounts)
       .sort(([,a], [,b]) => (b as number) - (a as number))
       .slice(0, 10);
    
    if (topTags.length > 0) {
      summary += "### Common Topics\n";
      for (const [tag, count] of topTags) {
        summary += `- ${tag} (${count} documents)\n`;
      }
    }

    return summary;
  }

  private generateDetailedSummary(documents: any[]): string {
    let summary = this.generateMediumSummary(documents);
    
    summary += "\n### Document Details\n\n";
    
    const sortedDocs = documents
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    for (const doc of sortedDocs.slice(0, 20)) {
      summary += `#### ${doc.title}\n`;
      summary += `- **Type**: ${doc.type}\n`;
      summary += `- **Source**: ${doc.sourceId}\n`;
      summary += `- **Updated**: ${doc.updatedAt.toDateString()}\n`;
      summary += `- **Size**: ${doc.content.length} characters\n`;
      
      if (doc.tags && doc.tags.length > 0) {
        summary += `- **Tags**: ${doc.tags.join(', ')}\n`;
      }
      
      // Content preview
      const preview = doc.content.substring(0, 200).trim();
      summary += `- **Preview**: ${preview}${doc.content.length > 200 ? '...' : ''}\n\n`;
    }

    if (documents.length > 20) {
      summary += `\n*Showing first 20 of ${documents.length} documents*\n`;
    }

    return summary;
  }
}