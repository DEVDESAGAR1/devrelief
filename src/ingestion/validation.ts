/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FormatSupportInfo,
  FileValidationResult,
  DEFAULT_INGESTION_LIMITS,
  IngestionLimits,
} from './types.ts';

export const FORMAT_SUPPORT_MATRIX: FormatSupportInfo[] = [
  // Text & Engineering Logs (Supported & Tested)
  { extension: 'txt', category: 'text_log', mimeType: 'text/plain', level: 'supported_and_tested', description: 'Plaintext logs and notes' },
  { extension: 'log', category: 'text_log', mimeType: 'text/plain', level: 'supported_and_tested', description: 'CI/CD and terminal execution logs with head/tail windowing' },
  { extension: 'md', category: 'text_log', mimeType: 'text/markdown', level: 'supported_and_tested', description: 'Markdown documents and README files' },
  { extension: 'json', category: 'structured_data', mimeType: 'application/json', level: 'supported_and_tested', description: 'Structured JSON data and manifests' },
  { extension: 'jsonl', category: 'structured_data', mimeType: 'application/x-ndjson', level: 'supported_and_tested', description: 'Newline-delimited JSON logs' },
  { extension: 'yaml', category: 'structured_data', mimeType: 'text/yaml', level: 'supported_and_tested', description: 'YAML configurations and pipeline files' },
  { extension: 'yml', category: 'structured_data', mimeType: 'text/yaml', level: 'supported_and_tested', description: 'YAML configurations and pipeline files' },
  { extension: 'xml', category: 'structured_data', mimeType: 'application/xml', level: 'supported_and_tested', description: 'XML data (safe entity parsing without external DTD)' },
  { extension: 'csv', category: 'structured_data', mimeType: 'text/csv', level: 'supported_and_tested', description: 'Comma-separated tabular data' },
  { extension: 'diff', category: 'diff_patch', mimeType: 'text/x-diff', level: 'supported_and_tested', description: 'Unified Git diff files' },
  { extension: 'patch', category: 'diff_patch', mimeType: 'text/x-patch', level: 'supported_and_tested', description: 'Git patch files' },

  // Images (Supported & Tested)
  { extension: 'png', category: 'image', mimeType: 'image/png', level: 'supported_and_tested', description: 'Screenshots and diagrams', limitations: 'Max dimension 2048px; EXIF stripped' },
  { extension: 'jpg', category: 'image', mimeType: 'image/jpeg', level: 'supported_and_tested', description: 'Photographs and whiteboard captures', limitations: 'EXIF stripped for privacy' },
  { extension: 'jpeg', category: 'image', mimeType: 'image/jpeg', level: 'supported_and_tested', description: 'Photographs and whiteboard captures', limitations: 'EXIF stripped for privacy' },
  { extension: 'webp', category: 'image', mimeType: 'image/webp', level: 'supported_and_tested', description: 'Compressed screenshots and images', limitations: 'Single-frame only' },

  // Documents (Supported & Tested / Limited)
  { extension: 'pdf', category: 'document', mimeType: 'application/pdf', level: 'supported_and_tested', description: 'PDF reports and specifications', limitations: 'Text stream extraction up to 50 pages' },
  { extension: 'docx', category: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', level: 'supported_with_limitations', description: 'Word documents', limitations: 'XML body text extracted; macros disabled' },
  { extension: 'xlsx', category: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', level: 'supported_with_limitations', description: 'Excel spreadsheets', limitations: 'First 3 sheets extracted as tables' },

  // Planned Formats
  { extension: 'pptx', category: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', level: 'planned', description: 'PowerPoint presentations', limitations: 'Planned for future release' },

  // Explicitly Rejected Binary / Executables / Archives
  { extension: 'exe', category: 'unsupported', mimeType: 'application/x-msdownload', level: 'rejected', description: 'Windows executable binary', limitations: 'REJECTED: Security prohibition against executables' },
  { extension: 'dll', category: 'unsupported', mimeType: 'application/x-msdownload', level: 'rejected', description: 'Windows dynamic link library', limitations: 'REJECTED: Security prohibition against executables' },
  { extension: 'so', category: 'unsupported', mimeType: 'application/octet-stream', level: 'rejected', description: 'Linux shared library', limitations: 'REJECTED: Security prohibition against executables' },
  { extension: 'sh', category: 'unsupported', mimeType: 'application/x-sh', level: 'rejected', description: 'Shell execution script', limitations: 'REJECTED: Scripts are not executed or run' },
  { extension: 'bat', category: 'unsupported', mimeType: 'application/x-bat', level: 'rejected', description: 'Windows batch script', limitations: 'REJECTED: Scripts are not executed or run' },
  { extension: 'cmd', category: 'unsupported', mimeType: 'application/x-cmd', level: 'rejected', description: 'Windows command script', limitations: 'REJECTED: Scripts are not executed or run' },
  { extension: 'bin', category: 'unsupported', mimeType: 'application/octet-stream', level: 'rejected', description: 'Raw binary blob', limitations: 'REJECTED: Unknown binary payload' },
  { extension: 'zip', category: 'unsupported', mimeType: 'application/zip', level: 'rejected', description: 'Archive file', limitations: 'REJECTED: Direct archive ingestion blocked to prevent zip bombs' },
  { extension: 'tar', category: 'unsupported', mimeType: 'application/x-tar', level: 'rejected', description: 'TAR archive', limitations: 'REJECTED: Direct archive ingestion blocked' },
  { extension: 'gz', category: 'unsupported', mimeType: 'application/gzip', level: 'rejected', description: 'GZIP archive', limitations: 'REJECTED: Direct archive ingestion blocked' },
  { extension: '7z', category: 'unsupported', mimeType: 'application/x-7z-compressed', level: 'rejected', description: '7-Zip archive', limitations: 'REJECTED: Direct archive ingestion blocked' },
];

export class FileValidator {
  /**
   * Sanitize a filename to prevent path traversal or special character injection
   */
  public static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file.txt';
    }
    // Remove directory path traversal attempts (../, ..\, /etc/, C:\)
    const base = filename.replace(/^.*[\\/]/, '');
    // Strip control characters, quotes, and dangerous shell metacharacters
    const sanitized = base.replace(/[\x00-\x1F\x7F"';|&<>`$]/g, '_').trim();
    return sanitized || 'unnamed_file.txt';
  }

  /**
   * Extract lowercase file extension from filename
   */
  public static extractExtension(filename: string): string {
    const sanitized = this.sanitizeFilename(filename);
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot === -1 || lastDot === sanitized.length - 1) {
      return '';
    }
    return sanitized.slice(lastDot + 1).toLowerCase();
  }

  /**
   * Inspect initial bytes (magic bytes / file signature)
   */
  public static detectSignature(headerBytes: Uint8Array): {
    detectedExtension?: string;
    isExecutable: boolean;
    isArchive: boolean;
    mimeType?: string;
  } {
    if (headerBytes.length < 4) {
      return { isExecutable: false, isArchive: false };
    }

    // Windows PE / MZ: 4D 5A ('MZ')
    if (headerBytes[0] === 0x4d && headerBytes[1] === 0x5a) {
      return { isExecutable: true, isArchive: false, detectedExtension: 'exe', mimeType: 'application/x-msdownload' };
    }

    // ELF Binary: 7F 45 4C 46 ('.ELF')
    if (headerBytes[0] === 0x7f && headerBytes[1] === 0x45 && headerBytes[2] === 0x4c && headerBytes[3] === 0x46) {
      return { isExecutable: true, isArchive: false, detectedExtension: 'bin', mimeType: 'application/x-executable' };
    }

    // PNG: 89 50 4E 47
    if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4e && headerBytes[3] === 0x47) {
      return { isExecutable: false, isArchive: false, detectedExtension: 'png', mimeType: 'image/png' };
    }

    // JPEG: FF D8 FF
    if (headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) {
      return { isExecutable: false, isArchive: false, detectedExtension: 'jpg', mimeType: 'image/jpeg' };
    }

    // WebP: RIFF ... WEBP (52 49 46 46)
    if (headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46) {
      return { isExecutable: false, isArchive: false, detectedExtension: 'webp', mimeType: 'image/webp' };
    }

    // PDF: %PDF- (25 50 44 46 2D)
    if (headerBytes[0] === 0x25 && headerBytes[1] === 0x50 && headerBytes[2] === 0x44 && headerBytes[3] === 0x46) {
      return { isExecutable: false, isArchive: false, detectedExtension: 'pdf', mimeType: 'application/pdf' };
    }

    // GZIP: 1F 8B
    if (headerBytes[0] === 0x1f && headerBytes[1] === 0x8b) {
      return { isExecutable: false, isArchive: true, detectedExtension: 'gz', mimeType: 'application/gzip' };
    }

    // PKZip / Office XML: 50 4B 03 04 ('PK..')
    if (headerBytes[0] === 0x50 && headerBytes[1] === 0x4b && headerBytes[2] === 0x03 && headerBytes[3] === 0x04) {
      return { isExecutable: false, isArchive: true, detectedExtension: 'zip', mimeType: 'application/zip' };
    }

    return { isExecutable: false, isArchive: false };
  }

  /**
   * Validate file size and format against centralized limits and matrix
   */
  public static validateFile(
    filename: string,
    sizeBytes: number,
    headerBytes?: Uint8Array,
    limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
  ): FileValidationResult {
    const ext = this.extractExtension(filename);
    const sanitized = this.sanitizeFilename(filename);

    // Empty file check
    if (sizeBytes <= 0) {
      return {
        valid: false,
        error: `File "${sanitized}" is empty (0 bytes).`,
        detectedMime: 'application/octet-stream',
        detectedExtension: ext,
        category: 'unsupported',
        isRejected: true,
        rejectReason: 'EMPTY_FILE',
      };
    }

    // Size limit check
    if (sizeBytes > limits.absoluteMaxFileSizeBytes) {
      const maxMb = Math.round(limits.absoluteMaxFileSizeBytes / (1024 * 1024));
      const actualMb = (sizeBytes / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File "${sanitized}" (${actualMb} MB) exceeds maximum limit of ${maxMb} MB.`,
        detectedMime: 'application/octet-stream',
        detectedExtension: ext,
        category: 'unsupported',
        isRejected: true,
        rejectReason: 'EXCEEDS_SIZE_LIMIT',
      };
    }

    // Magic signature check if header bytes are provided
    if (headerBytes && headerBytes.length >= 4) {
      const sig = this.detectSignature(headerBytes);
      if (sig.isExecutable) {
        return {
          valid: false,
          error: `File "${sanitized}" contains an executable binary signature and is prohibited for security.`,
          detectedMime: sig.mimeType || 'application/x-executable',
          detectedExtension: ext,
          category: 'unsupported',
          isRejected: true,
          rejectReason: 'EXECUTABLE_PROHIBITED',
        };
      }

      // Check if it's a raw archive (zip, gz) not claimed as docx/xlsx
      if (sig.isArchive && ext !== 'docx' && ext !== 'xlsx') {
        return {
          valid: false,
          error: `Direct archive file "${sanitized}" is prohibited in this milestone to prevent archive bombs.`,
          detectedMime: sig.mimeType || 'application/zip',
          detectedExtension: ext,
          category: 'unsupported',
          isRejected: true,
          rejectReason: 'ARCHIVE_PROHIBITED',
        };
      }
    }

    // Lookup extension in format support matrix
    const match = FORMAT_SUPPORT_MATRIX.find((f) => f.extension === ext);

    if (!match) {
      // Allow fallback if it is a safe text-like file without dangerous extensions
      const dangerousExtensions = ['exe', 'dll', 'so', 'sh', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'zip', 'tar', 'gz', '7z'];
      if (dangerousExtensions.includes(ext)) {
        return {
          valid: false,
          error: `File format ".${ext}" is prohibited for security reasons.`,
          detectedMime: 'application/octet-stream',
          detectedExtension: ext,
          category: 'unsupported',
          isRejected: true,
          rejectReason: 'EXTENSION_PROHIBITED',
        };
      }

      // Default to text_log for unknown extensions (e.g. .env, .conf, .ini)
      return {
        valid: true,
        detectedMime: 'text/plain',
        detectedExtension: ext || 'txt',
        category: 'text_log',
        isRejected: false,
      };
    }

    if (match.level === 'rejected') {
      return {
        valid: false,
        error: `File format ".${ext}" is rejected: ${match.limitations || 'Prohibited format'}`,
        detectedMime: match.mimeType,
        detectedExtension: ext,
        category: 'unsupported',
        isRejected: true,
        rejectReason: 'FORMAT_REJECTED',
      };
    }

    if (match.level === 'planned') {
      return {
        valid: false,
        error: `File format ".${ext}" (${match.description}) is planned for a future milestone and is not yet implemented.`,
        detectedMime: match.mimeType,
        detectedExtension: ext,
        category: 'unsupported',
        isRejected: true,
        rejectReason: 'PLANNED_FORMAT_UNSUPPORTED',
      };
    }

    return {
      valid: true,
      detectedMime: match.mimeType,
      detectedExtension: ext,
      category: match.category,
      isRejected: false,
    };
  }
}
