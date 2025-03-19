// src/types/pdf.d.ts

// Extend the Window interface to include PDF.js
interface Window {
  "pdfjs-dist/build/pdf": any;
}

// Basic PDF.js type definitions
declare namespace PDFJs {
  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): Promise<void>;
  }

  interface PDFPageProxy {
    getViewport(options: { scale: number }): PDFViewport;
    render(options: {
      canvasContext: CanvasRenderingContext2D;
      viewport: PDFViewport;
    }): {
      promise: Promise<void>;
    };
  }

  interface PDFViewport {
    width: number;
    height: number;
  }

  interface getDocumentOptions {
    url?: string;
    data?: Uint8Array;
  }

  interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  interface PDFJsStatic {
    getDocument(source: string | getDocumentOptions): PDFDocumentLoadingTask;
    GlobalWorkerOptions: {
      workerSrc: string;
    };
  }
}
