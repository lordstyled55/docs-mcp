import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import { Document } from '../models/document.js';
import { createHash } from 'crypto';

export interface ParseResult {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class ParserService {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  async parseFile(filePath: string, sourceId: string): Promise<Document | null> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const buffer = await fs.readFile(filePath);
      const checksum = createHash('md5').update(buffer).digest('hex');

      let parseResult: ParseResult;
      let documentType: Document['type'];

      switch (ext) {
        case '.md':
        case '.markdown':
          parseResult = this.parseMarkdown(buffer.toString('utf-8'));
          documentType = 'markdown';
          break;
        case '.html':
        case '.htm':
          parseResult = this.parseHTML(buffer.toString('utf-8'));
          documentType = 'html';
          break;
        case '.pdf':
          parseResult = await this.parsePDF(buffer);
          documentType = 'pdf';
          break;
        case '.txt':
          parseResult = this.parseText(buffer.toString('utf-8'));
          documentType = 'text';
          break;
        case '.json':
          parseResult = this.parseJSON(buffer.toString('utf-8'));
          documentType = 'json';
          break;
        default:
          // Try to parse as text for unknown extensions
          parseResult = this.parseText(buffer.toString('utf-8'));
          documentType = 'text';
      }

      const now = new Date();
      const id = createHash('sha256').update(`${sourceId}:${filePath}`).digest('hex');

      return {
        id,
        title: parseResult.title || path.basename(filePath, ext),
        content: parseResult.content,
        type: documentType,
        sourceId,
        sourcePath: filePath,
        metadata: {
          ...parseResult.metadata,
          fileName: path.basename(filePath),
          extension: ext,
          directory: path.dirname(filePath)
        },
        tags: parseResult.tags,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime > now ? now : stats.mtime,
        size: stats.size,
        checksum
      };
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return null;
    }
  }

  private parseMarkdown(content: string): ParseResult {
    const parsed = matter(content);
    const frontmatter = parsed.data;
    const markdownContent = parsed.content;

    // Extract title from frontmatter or first heading
    let title = frontmatter.title || '';
    if (!title) {
      const firstHeading = markdownContent.match(/^#\s+(.+)$/m);
      title = firstHeading ? firstHeading[1].trim() : '';
    }

    // Convert markdown to plain text for search
    const plainText = this.md.render(markdownContent)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title,
      content: plainText,
      metadata: {
        frontmatter,
        originalMarkdown: markdownContent,
        wordCount: plainText.split(/\s+/).length
      },
      tags: frontmatter.tags || frontmatter.keywords
    };
  }

  private parseHTML(content: string): ParseResult {
    const $ = cheerio.load(content);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Extract title
    const title = $('title').text() || $('h1').first().text() || '';
    
    // Extract main content
    const bodyText = $('body').text() || $.text();
    const cleanText = bodyText.replace(/\s+/g, ' ').trim();

    // Extract metadata
    const metadata: Record<string, unknown> = {};
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv');
      const content = $(el).attr('content');
      if (name && content) {
        metadata[name] = content;
      }
    });

    // Extract keywords as tags
    const keywords = metadata.keywords as string;
    const tags = keywords ? keywords.split(',').map(t => t.trim()) : undefined;

    return {
      title: title.trim(),
      content: cleanText,
      metadata: {
        ...metadata,
        headings: $('h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get(),
        links: $('a[href]').map((_, el) => $(el).attr('href')).get()
      },
      tags
    };
  }

  private async parsePDF(buffer: Buffer): Promise<ParseResult> {
    try {
      // Dynamic import to avoid loading pdf-parse at startup
      const pdfParse = await import('pdf-parse');
      const pdf = pdfParse.default;
      const data = await pdf(buffer);
      
      // Extract title from metadata or first line
      let title = data.info?.Title || '';
      if (!title && data.text) {
        const firstLine = data.text.split('\n')[0];
        title = firstLine.length < 100 ? firstLine.trim() : '';
      }

      return {
        title,
        content: data.text.replace(/\s+/g, ' ').trim(),
        metadata: {
          info: data.info,
          numpages: data.numpages,
          version: data.version
        }
      };
    } catch (error) {
      console.error('PDF parsing failed:', error);
      // Fallback to treating as binary file
      return {
        title: 'PDF Document',
        content: `[PDF file - ${buffer.length} bytes]`,
        metadata: {
          size: buffer.length,
          type: 'pdf',
          parseError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private parseText(content: string): ParseResult {
    const lines = content.split('\n');
    const title = lines[0]?.trim() || '';
    const cleanContent = content.replace(/\s+/g, ' ').trim();

    return {
      title: title.length < 100 ? title : '',
      content: cleanContent,
      metadata: {
        lineCount: lines.length,
        wordCount: cleanContent.split(/\s+/).length
      }
    };
  }

  private parseJSON(content: string): ParseResult {
    try {
      const data = JSON.parse(content);
      
      // Try to extract title from common fields
      const title = data.title || data.name || data.id || 'JSON Document';
      
      // Convert to searchable text
      const searchableText = this.jsonToSearchableText(data);

      return {
        title: String(title),
        content: searchableText,
        metadata: {
          originalData: data,
          type: 'json',
          keys: Object.keys(data)
        }
      };
    } catch (error) {
      // If JSON parsing fails, treat as text
      return this.parseText(content);
    }
  }

  private jsonToSearchableText(obj: any, prefix = ''): string {
    const parts: string[] = [];
    
    if (obj === null || obj === undefined) {
      return '';
    }
    
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.jsonToSearchableText(item)).join(' ');
    }
    
    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const keyText = key.replace(/[_-]/g, ' ');
        const valueText = this.jsonToSearchableText(value, `${prefix}${key}.`);
        parts.push(`${keyText}: ${valueText}`);
      }
    }
    
    return parts.join(' ');
  }

  async canParse(filePath: string): Promise<boolean> {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.md', '.markdown', '.html', '.htm', '.pdf', '.txt', '.json'];
    return supportedExtensions.includes(ext);
  }

  getSupportedExtensions(): string[] {
    return ['.md', '.markdown', '.html', '.htm', '.pdf', '.txt', '.json'];
  }
}