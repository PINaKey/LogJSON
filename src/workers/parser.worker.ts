import { normalizeLogs } from '../parsers/log-normalizer';
import { extractJsonFromText } from '../parsers/json-extractor';
import { extractApiDetails } from '../parsers/api-extractor';

self.onmessage = (event: MessageEvent) => {
  const { text } = event.data;

  try {
    const startTime = performance.now();
    
    // 1. Normalize
    const normalizedLines = normalizeLogs(text);
    
    // 2. Extract JSONs
    const jsons = extractJsonFromText(text);
    
    // 3. Extract APIs
    const apis = extractApiDetails(text, jsons);
    
    const duration = performance.now() - startTime;

    self.postMessage({
      success: true,
      data: {
        normalizedLines,
        jsons,
        apis,
        duration,
      },
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    });
  }
};
