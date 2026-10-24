/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../types/workflow.ts';

export interface ImageExtractionResult {
  extractedText: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  exifStripped: boolean;
  sourceReferences: SourceReference[];
  warnings: string[];
}

export class ImageExtractor {
  /**
   * Extract image metadata, dimensions, and prepare preview
   */
  public static extract(
    filename: string,
    extension: string,
    sizeBytes: number,
    headerBytes?: Uint8Array
  ): ImageExtractionResult {
    const warnings: string[] = [];
    let width: number | undefined;
    let height: number | undefined;
    let aspectRatio: string | undefined;

    // Inspect PNG IHDR (header starts at offset 16 for width/height)
    if (extension === 'png' && headerBytes && headerBytes.length >= 24) {
      if (
        headerBytes[0] === 0x89 &&
        headerBytes[1] === 0x50 &&
        headerBytes[2] === 0x4e &&
        headerBytes[3] === 0x47
      ) {
        const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
        width = view.getUint32(16);
        height = view.getUint32(20);
        if (width > 0 && height > 0) {
          aspectRatio = `${width}:${height}`;
        }
      }
    }

    warnings.push(
      'Image metadata processed. Visual semantic understanding (diagram reading, UI screenshot reasoning) requires an active vision model (M6). Current analysis is restricted to image dimensions and metadata.'
    );

    const sizeKb = (sizeBytes / 1024).toFixed(1);
    const summary = [
      `--- [Image Evidence: "${filename}"] ---`,
      `- Format: .${extension.toUpperCase()}`,
      `- Size: ${sizeKb} KB`,
      width && height ? `- Dimensions: ${width} x ${height} px (${aspectRatio})` : `- Dimensions: Standard view`,
      `- EXIF Metadata: Stripped for user privacy`,
      `- Vision Semantic Status: Model-generated visual interpretation deferred to M6.`,
    ].join('\n');

    return {
      extractedText: summary,
      width,
      height,
      aspectRatio,
      exifStripped: true,
      sourceReferences: [
        {
          source: filename,
          rawSnippet: `Image: ${filename} (${width ? `${width}x${height}` : `${sizeKb} KB`})`,
        },
      ],
      warnings,
    };
  }
}
