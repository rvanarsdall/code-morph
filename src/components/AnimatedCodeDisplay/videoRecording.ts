/**
 * Video recording utilities for capturing animated code displays
 */

export interface RecordingState {
  isRecording: boolean;
  progress: number;
  status: string;
}

export interface VideoRecordingOptions {
  canvasElement: HTMLCanvasElement;
  duration: number;
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Record animation to MP4 using MediaRecorder API
 */
export async function recordAnimation(
  options: VideoRecordingOptions
): Promise<Blob | null> {
  const { canvasElement, duration, onProgress, onStatusChange } = options;

  try {
    onStatusChange?.("Initializing recording...");

    // Get canvas stream
    const stream = canvasElement.captureStream(30); // 30 FPS
    if (!stream) {
      throw new Error("Failed to capture canvas stream");
    }

    // Check MediaRecorder support
    if (!MediaRecorder.isTypeSupported("video/webm")) {
      throw new Error("WebM video recording not supported");
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });

    const chunks: Blob[] = [];
    const startTime = Date.now();

    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        onStatusChange?.("Processing video...");
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        reject(new Error("Recording failed"));
      };

      // Progress tracking
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        onProgress?.(progress);

        if (elapsed >= duration) {
          clearInterval(progressInterval);
          mediaRecorder.stop();
        }
      }, 100);

      onStatusChange?.("Recording...");
      mediaRecorder.start();
    });
  } catch (error) {
    console.error("Recording setup failed:", error);
    onStatusChange?.("Recording failed");
    return null;
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Setup canvas for recording with proper dimensions and styling
 */
export function setupRecordingCanvas(
  sourceElement: HTMLElement,
  targetCanvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas 2D context");
  }

  // Get source element dimensions
  const rect = sourceElement.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  // Set canvas size
  targetCanvas.width = rect.width * scale;
  targetCanvas.height = rect.height * scale;
  targetCanvas.style.width = `${rect.width}px`;
  targetCanvas.style.height = `${rect.height}px`;

  // Scale context
  ctx.scale(scale, scale);

  return ctx;
}

/**
 * Render DOM element to canvas using html2canvas-like approach
 */
export async function renderElementToCanvas(
  element: HTMLElement,
  canvas: HTMLCanvasElement
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas 2D context");
  }

  try {
    // Create an SVG representation of the DOM element
    const svg = await domToSvg(element);
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  } catch (error) {
    console.error("Failed to render element to canvas:", error);
    throw error;
  }
}

/**
 * Convert DOM element to SVG string
 */
async function domToSvg(element: HTMLElement): Promise<string> {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  // Get all the text content and styling
  const textContent = element.innerText;
  const fontSize = computedStyle.fontSize;
  const fontFamily = computedStyle.fontFamily;
  const color = computedStyle.color;
  const backgroundColor = computedStyle.backgroundColor;

  // Create a simple SVG representation
  const svg = `
    <svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          font-family: ${fontFamily};
          font-size: ${fontSize};
          color: ${color};
          background-color: ${backgroundColor};
          padding: 1rem;
          white-space: pre-wrap;
          overflow: hidden;
        ">
          ${textContent}
        </div>
      </foreignObject>
    </svg>
  `;

  return svg;
}
