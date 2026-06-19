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

  // Page segmentation modes (subset used by this app).
  export enum PSM {
    AUTO = '3',
    SINGLE_COLUMN = '4',
    SINGLE_BLOCK = '6',
  }

  export interface WorkerParams {
    tessedit_pageseg_mode: PSM;
    tessedit_char_whitelist: string;
  }

  export interface Worker {
    recognize(image: Blob | string | HTMLImageElement | HTMLCanvasElement): Promise<RecognizeResult>;
    setParameters(params: Partial<WorkerParams>): Promise<unknown>;
    terminate(): Promise<void>;
  }

  export function createWorker(
    lang?: string,
    oem?: number,
    options?: WorkerOptions
  ): Promise<Worker>;

  const Tesseract: {
    createWorker: typeof createWorker;
    PSM: typeof PSM;
  };

  export default Tesseract;
}
