import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import fs from "fs/promises";

// Allowed file types for ID documents
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Create uploads directory if it doesn't exist
const ensureUploadDirectory = async () => {
  try {
    await fs.access("uploads/id-documents");
  } catch (error) {
    await fs.mkdir("uploads/id-documents", { recursive: true });
  }
};

// File name sanitization
const sanitizeFileName = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
};

// Generate secure file name
const generateSecureFileName = (originalName: string): string => {
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const sanitizedBaseName = sanitizeFileName(baseName);
  const uniqueId = uuidv4();
  return `${uniqueId}_${sanitizedBaseName}${extension}`;
};

// Custom storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDirectory();
    cb(null, "uploads/id-documents");
  },
  filename: (req, file, cb) => {
    const secureFileName = generateSecureFileName(file.originalname);
    cb(null, secureFileName);
  },
});

// File filter for security
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.",
      ),
    );
  }

  // Additional security: Check file extension
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error("Invalid file extension."));
  }

  cb(null, true);
};

// Configure multer
export const uploadIdDocument = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one file at a time
  },
  fileFilter: fileFilter,
});

// Image optimization for uploaded images
export const optimizeImage = async (filePath: string): Promise<void> => {
  try {
    const extension = path.extname(filePath).toLowerCase();

    // Only optimize images, not PDFs
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
      const optimizedPath = filePath.replace(
        extension,
        `_optimized${extension}`,
      );

      await sharp(filePath)
        .resize(1200, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);

      // Replace original with optimized version
      await fs.unlink(filePath);
      await fs.rename(optimizedPath, filePath);
    }
  } catch (error) {
    console.error("Error optimizing image:", error);
    // Don't throw error - optimization is optional
  }
};

// Validate file after upload
export const validateUploadedFile = async (
  file: Express.Multer.File,
): Promise<boolean> => {
  try {
    // Check if file exists
    await fs.access(file.path);

    // Additional MIME type validation by reading file header
    const buffer = await fs.readFile(file.path, { encoding: null });
    const fileSignature = buffer.toString("hex", 0, 4);

    // Check file signatures (magic numbers)
    const validSignatures: { [key: string]: string[] } = {
      "image/jpeg": [
        "ffd8ffe0",
        "ffd8ffe1",
        "ffd8ffe2",
        "ffd8ffe3",
        "ffd8ffdb",
      ],
      "image/png": ["89504e47"],
      "application/pdf": ["25504446"],
    };

    const expectedSignatures = validSignatures[file.mimetype];
    if (
      expectedSignatures &&
      !expectedSignatures.some((sig) => fileSignature.startsWith(sig))
    ) {
      // File signature doesn't match MIME type
      await fs.unlink(file.path);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating file:", error);
    return false;
  }
};

// Clean up old files (run periodically)
export const cleanupOldFiles = async (daysOld: number = 30): Promise<void> => {
  try {
    const uploadDir = "uploads/id-documents";
    const files = await fs.readdir(uploadDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up old files:", error);
  }
};

// Get secure file URL
export const getFileUrl = (filePath: string): string => {
  // Return relative path for serving through Express static middleware
  return `/uploads/id-documents/${path.basename(filePath)}`;
};

// Delete file securely
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};
