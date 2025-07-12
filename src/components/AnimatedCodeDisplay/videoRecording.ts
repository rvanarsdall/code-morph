/**
 * Video recording utilities for capturing animated code displays
 */

import html2canvas from "html2canvas";

export interface RecordingState {
  isRecording: boolean;
  progress: number;
  status: string;
}

export interface VideoRecordingOptions {
  canvasElement: HTMLCanvasElement;
  sourceElement: HTMLElement;
  duration: number;
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Record animation using canvas-based approach only
 */
export async function recordAnimation(
  options: VideoRecordingOptions & {
    onTriggerAnimation?: () => void; // Callback to trigger animation after recording starts
  }
): Promise<Blob | null> {
  const {
    canvasElement,
    sourceElement,
    duration,
    onProgress,
    onStatusChange,
    onTriggerAnimation,
  } = options;

  try {
    onStatusChange?.("Setting up recording...");

    // Setup canvas to match source element
    setupRecordingCanvas(canvasElement);

    // Use canvas stream with higher frame rate for better quality
    const stream = canvasElement.captureStream(60); // 60 FPS
    if (!stream) {
      throw new Error("Failed to capture canvas stream");
    }

    // Check MediaRecorder support
    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error("WebM video recording not supported");
        }
      }
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for higher quality
    });

    const chunks: Blob[] = [];
    const startTime = Date.now();

    // Start continuous rendering to canvas immediately
    let animationFrame: number;
    let isRendering = false;
    let lastRenderTime = 0;
    let lastElementHash = "";
    const renderInterval = 1000 / 60; // 60 FPS for smoother recording
    let recordingStarted = false;

    // Function to get a simple hash of element content for change detection
    const getElementHash = (el: HTMLElement): string => {
      return (
        el.innerHTML.length +
        "-" +
        el.getBoundingClientRect().width +
        "-" +
        el.getBoundingClientRect().height
      );
    };

    const renderLoop = async () => {
      if (isRendering) {
        animationFrame = requestAnimationFrame(renderLoop);
        return;
      }

      const now = Date.now();
      if (now - lastRenderTime < renderInterval) {
        animationFrame = requestAnimationFrame(renderLoop);
        return;
      }

      // Always render during recording to capture animation changes
      if (recordingStarted) {
        isRendering = true;
        lastRenderTime = now;

        try {
          await renderElementToCanvas(sourceElement, canvasElement);
        } catch (error) {
          console.warn("Frame render failed:", error);
        }

        isRendering = false;
      } else {
        // Before recording starts, only render on content changes
        const currentHash = getElementHash(sourceElement);
        if (currentHash === lastElementHash && lastRenderTime > 0) {
          animationFrame = requestAnimationFrame(renderLoop);
          return;
        }

        isRendering = true;
        lastRenderTime = now;
        lastElementHash = currentHash;

        try {
          await renderElementToCanvas(sourceElement, canvasElement);
        } catch (error) {
          console.warn("Frame render failed:", error);
        }

        isRendering = false;
      }

      animationFrame = requestAnimationFrame(renderLoop);
    };

    // Start render loop immediately
    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        onStatusChange?.("Processing video...");
        // Stop the render loop
        cancelAnimationFrame(animationFrame);
        // Stop all tracks to clean up
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        cancelAnimationFrame(animationFrame);
        stream.getTracks().forEach((track) => track.stop());
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

      // Start render loop and recording immediately
      renderLoop();
      recordingStarted = true;
      onStatusChange?.("Recording...");
      mediaRecorder.start(100); // Collect data every 100ms

      // After a 2-second buffer, trigger the animation
      setTimeout(() => {
        console.log("🎬 Triggering animation during recording...");
        onTriggerAnimation?.();
      }, 2000); // 2-second buffer at the start of the recording
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
  targetCanvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas 2D context");
  }

  // Standard video dimensions (16:9 aspect ratio) - Higher resolution
  const videoWidth = 1920;
  const videoHeight = 1080;
  const scale = window.devicePixelRatio || 1;

  console.log("Canvas setup for video recording:", {
    videoSize: { width: videoWidth, height: videoHeight },
    scale,
  });

  // Set canvas to standard video size
  targetCanvas.width = videoWidth * scale;
  targetCanvas.height = videoHeight * scale;
  targetCanvas.style.width = `${videoWidth}px`;
  targetCanvas.style.height = `${videoHeight}px`;

  // Scale context
  ctx.scale(scale, scale);

  // Set a dark background for the video
  ctx.fillStyle = "#1f2937"; // Dark gray background
  ctx.fillRect(0, 0, videoWidth, videoHeight);

  return ctx;
}

/**
 * Render DOM element to canvas using html2canvas
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
    // Video canvas dimensions (logical pixels) - Higher resolution
    const videoWidth = 1920;
    const videoHeight = 1080;

    // Clear canvas with dark background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, videoWidth, videoHeight);

    // Use html2canvas to capture the element with higher quality settings
    const elementCanvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    // Get element dimensions
    const elementWidth = elementCanvas.width;
    const elementHeight = elementCanvas.height;

    // Calculate content area dimensions (leave some padding)
    const padding = 40;
    const contentWidth = videoWidth - padding * 2;
    const contentHeight = videoHeight - padding * 2;

    // Calculate scale to fit content within the content area
    const scaleX = contentWidth / elementWidth;
    const scaleY = contentHeight / elementHeight;
    const contentScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1

    // Calculate position to center the content
    const scaledWidth = elementWidth * contentScale;
    const scaledHeight = elementHeight * contentScale;
    const offsetX = (videoWidth - scaledWidth) / 2;
    const offsetY = (videoHeight - scaledHeight) / 2;

    console.log("html2canvas positioning:", {
      element: { width: elementWidth, height: elementHeight },
      video: { width: videoWidth, height: videoHeight },
      contentScale,
      scaledSize: { width: scaledWidth, height: scaledHeight },
      position: { x: offsetX, y: offsetY },
    });

    // Draw the captured element onto the video canvas
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(contentScale, contentScale);
    ctx.drawImage(elementCanvas, 0, 0);
    ctx.restore();
  } catch (error) {
    console.error(
      "Failed to render element to canvas with html2canvas:",
      error
    );
    throw error;
  }
}
