import { useState, useEffect, useRef } from 'react';
import { normalizeLogs, joinContinuationLines } from '../parsers/log-normalizer';
import type { NormalizedLine } from '../parsers/log-normalizer';
import type { ExtractedJson, ApiDetail, UserDetail } from '../parsers/types';
import { extractJsonFromText } from '../parsers/json-extractor';
import { extractApiDetails } from '../parsers/api-extractor';
import { extractUserDetails } from '../parsers/user-extractor';

export interface ParseResult {
  normalizedLines: NormalizedLine[];
  jsons: ExtractedJson[];
  apis: ApiDetail[];
  duration: number;
}

export function useParser(addToast: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void) {
  const [rawInput, setRawInput] = useState('');
  const [normalizedLines, setNormalizedLines] = useState<NormalizedLine[]>([]);
  const [extractedJsons, setExtractedJsons] = useState<ExtractedJson[]>([]);
  const [apis, setApis] = useState<ApiDetail[]>([]);
  const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseTime, setParseTime] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Initialize and clean up Web Worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const clearAll = () => {
    setRawInput('');
    setNormalizedLines([]);
    setExtractedJsons([]);
    setApis([]);
    setUserDetails([]);
    setParseTime(0);
    setParseError(null);
    setIsParsing(false);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  const handleParse = (text: string) => {
    if (!text.trim()) {
      clearAll();
      return;
    }

    setRawInput(text);
    setIsParsing(true);
    setParseError(null);

    const lineCount = text.split(/\r?\n/).length;
    const isLarge = lineCount > 10000 || text.length > 500000; // >10K lines or >500KB

    if (isLarge) {
      addToast('That\'s a big log! 🏋️ Offloading parsing to background thread...', 'info');

      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // Create new worker
      workerRef.current = new Worker(
        new URL('../workers/parser.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event) => {
        const { success, data, error } = event.data;
        if (success) {
          setNormalizedLines(data.normalizedLines);
          setExtractedJsons(data.jsons);
          setApis(data.apis);
          setUserDetails(data.userDetails || []);
          setParseTime(Math.round(data.duration));
          addToast(`Successfully parsed in ${Math.round(data.duration)}ms! ✨`, 'success');
        } else {
          setParseError(error || 'Worker parsing error');
          addToast('Failed to parse logs.', 'error');
        }
        setIsParsing(false);
      };

      workerRef.current.onerror = (err) => {
        setParseError(err.message || 'Worker error');
        addToast('Background parser encountered an error.', 'error');
        setIsParsing(false);
      };

      // Post to worker
      workerRef.current.postMessage({ text });
    } else {
      // Small input, parse synchronously
      setTimeout(() => {
        try {
          const startTime = performance.now();
          
          const normalizedLines = normalizeLogs(text);
          const joinedLines = joinContinuationLines(normalizedLines);
          const joinedText = joinedLines.map(l => l.normalizedText).join('\n');
          
          const jsons = extractJsonFromText(text, joinedText);
          const apiDetails = extractApiDetails(text, jsons);
          const userDets = extractUserDetails(text, jsons);
          
          const duration = performance.now() - startTime;
          
          setNormalizedLines(joinedLines);
          setExtractedJsons(jsons);
          setApis(apiDetails);
          setUserDetails(userDets);
          setParseTime(Math.round(duration));
          setIsParsing(false);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : 'Parsing error');
          addToast('Failed to parse logs.', 'error');
          setIsParsing(false);
        }
      }, 50); // slight delay to allow UI to render parsing spinner
    }
  };

  return {
    rawInput,
    normalizedLines,
    extractedJsons,
    apis,
    userDetails,
    isParsing,
    parseTime,
    parseError,
    handleParse,
    clearAll,
  };
}
