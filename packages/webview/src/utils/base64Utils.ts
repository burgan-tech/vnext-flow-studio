// Utility functions for Base64 encoding/decoding

/**
 * Decodes Base64 string if it appears to be Base64 encoded, otherwise returns the original string
 * @param code The string to decode
 * @returns The decoded string or original string if not Base64
 */
export function decodeBase64(code: string): string {
  if (!code) {
    return code;
  }

  try {
    // Check if it looks like Base64 and decode it
    const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(code) && code.length % 4 === 0 && code.length > 10;
    if (isBase64) {
      const decoded = atob(code);
      return decoded;
    } else {
      return code;
    }
  } catch {
    return code;
  }
}

/**
 * Encodes string to Base64 if it contains C# code patterns
 * @param code The string to encode
 * @returns The Base64 encoded string or original string if no encoding needed
 */
export function encodeBase64(code: string): string {
  if (!code) {
    return code;
  }

  // Check if the code contains C# patterns that should be encoded
  const hasCSharpPatterns = /using\s+System|public\s+class|ScriptBase|IMapping|ITimerMapping|ScriptContext|WorkflowTask|TimerSchedule/.test(code);

  if (hasCSharpPatterns) {
    return btoa(code);
  } else {
    return code;
  }
}
