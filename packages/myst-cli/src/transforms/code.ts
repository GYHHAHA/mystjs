import type { Root } from 'mdast';
import type { GenericNode } from 'myst-common';
import { select, selectAll } from 'unist-util-select';
import yaml from 'js-yaml';
import type { ISession } from '../session/types';

const CELL_OPTION_PREFIX = '#| ';

/**
 * Parse metadata from code block using js-yaml
 *
 * Metadata is defined at the begining of code cells as:
 *
 * ```python
 * #| key: value
 * #| flag: true
 *
 * print('hello world')
 * ```
 *
 * New lines around metadata will be ignored, but once a non-metadata line
 * is encountered, metadata parsing is stopped (i.e. you cannot define
 * metadata in the middle of other code).
 */
export function metadataFromCode(
  session: ISession,
  filename: string,
  value: string,
  opts?: { remove?: boolean },
): { value: string; metadata?: Record<string, any> } {
  const metaLines: string[] = [];
  const outputLines: string[] = [];
  let inHeader = true;
  value.split('\n').forEach((line) => {
    if (inHeader) {
      if (line.startsWith(CELL_OPTION_PREFIX)) {
        metaLines.push(line.substring(CELL_OPTION_PREFIX.length));
      } else if (line.trim()) {
        inHeader = false;
      }
    }
    if (!inHeader || !opts?.remove) {
      outputLines.push(line);
    }
  });
  let metadata: Record<string, any> | undefined;
  if (metaLines.length) {
    try {
      metadata = yaml.load(metaLines.join('\n')) as Record<string, any>;
    } catch {
      session.log.error(`Invalid code cell metadata in ${filename}`);
    }
  }
  if (!metadata) {
    return { value };
  }
  return {
    value: outputLines.join('\n'),
    metadata,
  };
}

/**
 * Traverse mdast, remove code cell metadata, and add it to parent block
 */
export function liftCodeMetadataToBlock(session: ISession, filename: string, mdast: Root) {
  const blocks = selectAll('block', mdast) as GenericNode[];
  blocks.forEach((block) => {
    const codeNodes = selectAll('code', block) as GenericNode[];
    let blockMetadata: Record<string, any> | undefined;
    codeNodes.forEach((node) => {
      if (!node.value) return;
      const { metadata, value } = metadataFromCode(session, filename, node.value, { remove: true });
      if (blockMetadata && metadata) {
        session.log.warn(`Multiple code blocks with metadata found in ${filename}`);
      } else {
        blockMetadata = metadata;
      }
      node.value = value;
    });
    if (blockMetadata) {
      block.data = block.data ? { ...block.data, ...blockMetadata } : blockMetadata;
    }
  });
}

/**
 * Traverse mdast, propagate block tags to code and output
 */
export function propagateBlockDataToCode(session: ISession, filename: string, mdast: Root) {
  const blocks = selectAll('block', mdast) as GenericNode[];
  blocks.forEach((block) => {
    if (!block.data || !block.data.tags) return;
    if (!Array.isArray(block.data.tags)) {
      session.log.error(`tags in code-cell directive must be a list of strings`);
    }
    // only single ('code', 'output') pair?
    const codeNode = select('code', block) as GenericNode;
    const outputNode = select('output', block) as GenericNode;
    block.data.tags.forEach((tag: string) => {
      switch (tag) {
        // should we raise when hide and remove both exist?
        case 'hide-cell':
          block.visibility = 'hide';
          break;
        case 'remove-cell':
          block.visibility = 'remove';
          break;
        case 'hide-input':
          codeNode.visibility = 'hide';
          break;
        case 'remove-input':
          codeNode.visibility = 'remove';
          break;
        case 'hide-output':
          outputNode.visibility = 'hide';
          break;
        case 'remove-output':
          outputNode.visibility = 'remove';
          break;
        default:
          session.log.warn(`tag '${tag}' is not valid in code-cell tags'`);
      }
    });
    if (!block.visibility) block.visibility = 'show';
    if (!codeNode.visibility) codeNode.visibility = 'show';
    if (!outputNode.visibility) outputNode.visibility = 'show';
    delete block.data.tags;
  });
}
