import { normalizeLogs, joinContinuationLines } from '../parsers/log-normalizer';
import { extractJsonFromText } from '../parsers/json-extractor';
import { extractApiDetails } from '../parsers/api-extractor';
import { extractUserDetails } from '../parsers/user-extractor';

self.onmessage = (event: MessageEvent) => {
  const { text } = event.data;

  try {
    const startTime = performance.now();
    
    // 1. Normalize
    const normalizedLines = normalizeLogs(text);
    const joinedLines = joinContinuationLines(normalizedLines);
    
    // Join continuation lines so multi-line JSONs are extracted as one unit
    const joinedText = joinedLines.map(l => l.normalizedText).join('\n');
    
    // 2. Extract JSONs
    const jsons = extractJsonFromText(text, joinedText);
    
    // 3. Extract APIs
    const apis = extractApiDetails(text, jsons);
    
    // 4. Extract User Details
    const userDetails = extractUserDetails(text, jsons);
    
    const duration = performance.now() - startTime;

    self.postMessage({
      success: true,
      data: {
        normalizedLines: joinedLines,
        jsons,
        apis,
        userDetails,
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
