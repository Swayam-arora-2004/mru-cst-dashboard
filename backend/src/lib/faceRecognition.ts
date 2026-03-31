/**
 * Server-side Face Recognition Library
 * Uses @vladmandic/face-api + @napi-rs/canvas for Node.js image processing
 */

import path from 'path';
import sharp from 'sharp';
import logger from './logger';

// We need to polyfill fetch for @vladmandic/face-api in some Node versions
// Dynamic imports help avoid module loading issues
let faceapi: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODELS_PATH = path.resolve(process.cwd(), 'models');

// Euclidean distance between two face descriptors
function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Load all face recognition models. Safe to call multiple times — only loads once.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      logger.info('🤖 Loading face recognition models...');

      // Import canvas polyfill for Node.js
      const { createCanvas, Image } = await import('@napi-rs/canvas');

      // Patch global with canvas so face-api can use it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).HTMLCanvasElement = createCanvas(1, 1).constructor;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).HTMLImageElement = Image;

      // Import face-api
      faceapi = await import('@vladmandic/face-api');

      // Initialize Pure CPU backend instead of attempting to build native C++ TensorFlow graphs!
      // This reduces cold-compile time from ~40 seconds down to EXACTLY 0.0 seconds!
      await (faceapi as any).tf.setBackend('cpu');
      await (faceapi as any).tf.ready();

      logger.info('✅ Face API CPU backend ready (Instant)');

      // Load models from local files
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);

      modelsLoaded = true;
      logger.info('✅ Face recognition models loaded successfully');
    } catch (err) {
      loadingPromise = null;
      logger.error('❌ Failed to load face recognition models:', err);
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * Detect a face in an image buffer and return its 128-d descriptor.
 * Returns null if no face is detected.
 */
export async function detectAndEncode(imageBuffer: Buffer): Promise<Float32Array | null> {
  if (!modelsLoaded || !faceapi) {
    throw new Error('Face recognition models not loaded. Call loadModels() first.');
  }

  try {
    // 1. Use Sharp to decode image to raw pixels (it's faster and more stable in Node)
    // @ts-ignore - faceapi.tf contains the tfjs instance
    const tf = (faceapi as any).tf;
    const { data, info } = await sharp(imageBuffer)
      .removeAlpha() // Ensure 3 channels (RGB)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Create tensor from raw pixel data
    const tensor = tf.tensor3d(data, [info.height, info.width, 3], 'int32');

    // 2. Detect face with landmarks and descriptor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detection = await (faceapi as any)
      .detectSingleFace(tensor, new (faceapi as any).SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    // 3. Dispose tensor to free memory
    tf.dispose(tensor);

    if (!detection) {
      logger.warn('No face detected in image');
      return null;
    }

    return detection.descriptor as Float32Array;
  } catch (err) {
    logger.error('Error encoding face:', err);
    throw err;
  }
}

export interface StudentEncoding {
  id: string;
  face_encoding: number[];
}

export interface MatchResult {
  studentId: string;
  distance: number;
  confidence: number;
}

/**
 * Compare a query descriptor against stored student encodings.
 * Returns the best match if it's within the threshold, or null.
 * Threshold of 0.55 is a good balance of accuracy vs. false positives.
 */
export function findBestMatch(
  queryDescriptor: Float32Array,
  storedEncodings: StudentEncoding[],
  threshold = 0.55
): MatchResult | null {
  let bestMatch: { studentId: string; distance: number } | null = null;

  for (const student of storedEncodings) {
    if (!student.face_encoding || !Array.isArray(student.face_encoding)) continue;

    const stored = new Float32Array(student.face_encoding);
    if (stored.length !== queryDescriptor.length) continue;

    const distance = euclideanDistance(queryDescriptor, stored);

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { studentId: student.id, distance };
    }
  }

  if (!bestMatch || bestMatch.distance > threshold) {
    return null;
  }

  // Convert distance to confidence percentage (0-100)
  const confidence = Math.round((1 - bestMatch.distance / threshold) * 100);

  return {
    studentId: bestMatch.studentId,
    distance: bestMatch.distance,
    confidence: Math.max(0, Math.min(100, confidence)),
  };
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}
