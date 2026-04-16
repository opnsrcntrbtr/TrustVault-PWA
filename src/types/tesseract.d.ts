/**
 * Type declarations for tesseract.js
 */

declare module 'tesseract.js' {
  export interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
      lines: Array<{
        text: string;
        confidence: number;
        words: Array<{
          text: string;
          confidence: number;
        }>;
      }>;
    };
  }

  export interface WorkerOptions {
    logger?: (progress: { status: string; progress: number }) => void;
    langPath?: string;
    workerPath?: string;
    corePath?: string;
  }

  export interface Worker {
    recognize(image: Blob | string | HTMLImageElement | HTMLCanvasElement): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(
    lang?: string,
    oem?: number,
    options?: WorkerOptions
  ): Promise<Worker>;

  const Tesseract: {
    createWorker: typeof createWorker;
  };

  export default Tesseract;
}
