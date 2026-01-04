/**
 * ============================================================================
 * S3 CLIENT - Cloud Storage for Video Files
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file sets up a client for S3-compatible object storage and provides
 * utilities for generating signed upload URLs.
 *
 * WHAT IS S3 / OBJECT STORAGE?
 * ----------------------------
 * S3 (Simple Storage Service) is cloud file storage. Unlike a regular
 * filesystem with folders, it's a flat key-value store:
 *
 *   Key: "videos/abc123/my-video.mp4"
 *   Value: (binary file data)
 *
 * Benefits:
 *   - Unlimited storage (you pay for what you use)
 *   - Built-in redundancy (files are replicated)
 *   - Can serve files directly to users via URL
 *   - Works with CDNs for fast global delivery
 *
 * S3-COMPATIBLE SERVICES:
 * -----------------------
 * Many services use the same API as AWS S3:
 *   - AWS S3 (the original)
 *   - MinIO (self-hosted, great for local dev)
 *   - Cloudflare R2 (no egress fees)
 *   - DigitalOcean Spaces
 *   - Backblaze B2
 *   - Wasabi
 *
 * This means our code works with any of them!
 *
 * SIGNED URLS - THE KEY CONCEPT:
 * ------------------------------
 * We use "pre-signed URLs" for uploads. Here's why:
 *
 * WITHOUT signed URLs (bad):
 *   1. User uploads to our API server
 *   2. API server uploads to S3
 *   3. Double upload = slow & wastes our bandwidth
 *
 * WITH signed URLs (good):
 *   1. API creates a special URL that allows one upload
 *   2. User uploads directly to S3 with that URL
 *   3. Our server never touches the file data!
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │                     SIGNED URL FLOW                            │
 *   │                                                                │
 *   │  1. User: "I want to upload video.mp4"                        │
 *   │     └──→ POST /uploads/video/signed-url { title, size... }    │
 *   │                                                                │
 *   │  2. Server: Creates signed URL valid for 1 hour               │
 *   │     └──→ Returns { uploadUrl, storageKey, videoId }           │
 *   │                                                                │
 *   │  3. User: Uploads directly to S3                              │
 *   │     └──→ PUT {uploadUrl} with file data                       │
 *   │                                                                │
 *   │  4. User: "Upload complete!"                                  │
 *   │     └──→ POST /videos/{videoId}/confirm-upload                │
 *   │                                                                │
 *   │  5. Server: Updates status, triggers processing                │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - config/env.ts: Provides S3_* configuration
 * - routes/uploads.ts: Uses generateSignedUploadUrl
 * - routes/videos.ts: Uses getPublicUrl for playback
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";

/**
 * S3 client instance
 *
 * PSEUDOCODE:
 * -----------
 * Create an S3 client configured for our storage provider:
 *
 *   endpoint: The S3-compatible API URL
 *     - AWS: https://s3.amazonaws.com
 *     - MinIO: http://localhost:9000
 *     - R2: https://xxx.r2.cloudflarestorage.com
 *
 *   region: AWS region or any string for non-AWS
 *     - AWS: us-east-1, eu-west-1, etc.
 *     - MinIO: doesn't matter, use default
 *
 *   credentials: Access key pair for authentication
 *     - Like a username/password for the API
 *     - NEVER expose the secret!
 *
 *   forcePathStyle: true
 *     - Important for S3-compatible services!
 *     - AWS uses: bucket.s3.amazonaws.com/key
 *     - Others use: s3.example.com/bucket/key
 *     - forcePathStyle uses the second format
 */
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  // Force path-style for S3-compatible services like R2, MinIO
  forcePathStyle: true,
});

/**
 * generateSignedUploadUrl - Create a URL that allows one file upload
 *
 * PSEUDOCODE:
 * -----------
 * INPUT:
 *   - storageKey: Where to store the file (e.g., "videos/abc123/video.mp4")
 *   - mimeType: What type of file (e.g., "video/mp4")
 *   - fileSizeBytes: Expected size (for validation)
 *
 * OUTPUT:
 *   - Signed URL that allows PUT request to upload the file
 *
 * HOW IT WORKS:
 *
 * 1. CREATE A PUT COMMAND
 *    PutObjectCommand describes what operation we're pre-authorizing:
 *      - Bucket: Which storage bucket
 *      - Key: The file path (storageKey)
 *      - ContentType: The MIME type (must match when uploading)
 *      - ContentLength: The file size (must match when uploading)
 *
 * 2. SIGN THE COMMAND
 *    getSignedUrl creates a special URL that:
 *      - Includes cryptographic signature
 *      - Only works for this exact operation
 *      - Expires after 1 hour (3600 seconds)
 *      - Can only be used once
 *
 * 3. RETURN THE URL
 *    Client uses this URL to upload directly to S3
 *
 * SECURITY:
 *   - The URL can only upload to the specified key
 *   - Wrong file type or size will be rejected
 *   - URL expires after 1 hour
 *   - Signature prevents URL tampering
 */
export async function generateSignedUploadUrl(
  storageKey: string,
  mimeType: string,
  fileSizeBytes: number
): Promise<string> {
  // Step 1: Create the command describing what we're authorizing
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: storageKey,
    ContentType: mimeType,
    ContentLength: fileSizeBytes,
  });

  // Step 2: Generate the signed URL
  // expiresIn is in seconds (3600 = 1 hour)
  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });

  // Step 3: Return the URL for the client to use
  return signedUrl;
}

/**
 * getPublicUrl - Get the public URL for an uploaded file
 *
 * PSEUDOCODE:
 * -----------
 * INPUT:
 *   - storageKey: The file path in S3 (e.g., "videos/abc123/video.mp4")
 *
 * OUTPUT:
 *   - Public URL to access the file
 *
 * HOW IT WORKS:
 *   1. Take the S3 endpoint URL
 *   2. Remove trailing slash if present
 *   3. Append bucket name and storage key
 *
 * EXAMPLE:
 *   endpoint: "https://s3.amazonaws.com/"
 *   bucket: "my-videos"
 *   storageKey: "videos/abc123/video.mp4"
 *   Result: "https://s3.amazonaws.com/my-videos/videos/abc123/video.mp4"
 *
 * IMPORTANT:
 *   This assumes the bucket has public read access configured.
 *   For private buckets, you'd use signed URLs for downloads too.
 *
 *   In production, you might:
 *     - Use a CDN URL instead (e.g., cdn.yoursite.com)
 *     - Generate signed download URLs for private content
 *     - Use different URLs for different quality levels
 */
export function getPublicUrl(storageKey: string): string {
  // Construct the public URL for the object
  // This assumes the bucket has public read access or you're using a CDN
  // For private buckets, generate signed URLs for downloads instead
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
  return `${endpoint}/${env.S3_BUCKET_NAME}/${storageKey}`;
}
