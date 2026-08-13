import fs from 'fs/promises';
import path from 'path';

export async function resolveAndValidatePath(
  rawPath: string,
  accessType: 'read' | 'write'
): Promise<string> {
  const absolutePath = path.resolve(rawPath);

  // Simplified validation - for Phase 1, we'll do basic security checks
  // In a production environment, you'd want more robust root validation

  // Basic security: prevent access to system directories
  const normalizedPath = path.normalize(absolutePath);
  const dangerousPaths = ['/etc', '/bin', '/usr/bin', '/var', '/sys', '/proc'];
  const isDangerous = dangerousPaths.some((dangerous) => normalizedPath.startsWith(dangerous));

  if (isDangerous) {
    throw new Error(`Access to system directory "${normalizedPath}" is not allowed.`);
  }

  if (accessType === 'write') {
    const dir = path.dirname(absolutePath);
    try {
      await fs.access(dir, fs.constants.W_OK);
    } catch {
      // Try to create the directory if it doesn't exist
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch {
        throw new Error(`Directory "${dir}" is not writable and could not be created.`);
      }
    }
  } else if (accessType === 'read') {
    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch {
      throw new Error(`File "${absolutePath}" is not readable or does not exist.`);
    }
  }
  return absolutePath;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, 'utf8');
  } catch {
    throw new Error(`Failed to write file: ${filePath}`);
  }
}

export async function writeFileBuffer(filePath: string, content: Buffer): Promise<void> {
  try {
    await fs.writeFile(filePath, content);
  } catch {
    throw new Error(`Failed to write file: ${filePath}`);
  }
}

export async function readFileToBuffer(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch {
    throw new Error(`Failed to read file: ${filePath}`);
  }
}
