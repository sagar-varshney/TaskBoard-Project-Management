const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { config } = require("../config/env");
const AppError = require("../utils/app-error");

const localUploadRoot = path.isAbsolute(config.storage.localUploadRoot)
  ? config.storage.localUploadRoot
  : path.join(process.cwd(), config.storage.localUploadRoot);

function storageProvider() {
  return config.storage.provider;
}

function r2Configuration() {
  const values = config.storage.r2;

  if (storageProvider() === "r2" && Object.values(values).some((value) => !value)) {
    throw new AppError("R2 storage is selected but its credentials are incomplete", 503);
  }

  return values;
}

function r2Client() {
  const config = r2Configuration();

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    // R2 expects the bucket in the URL path, not as a bucket.account-id hostname.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function objectKeyFor(issueId, fileName) {
  return `tickets/${issueId}/${crypto.randomUUID()}-${fileName}`;
}

async function uploadAttachmentObject({ issueId, fileName, mimeType, buffer }) {
  if (storageProvider() === "r2") {
    const config = r2Configuration();
    const objectKey = objectKeyFor(issueId, fileName);

    await r2Client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          issueId: String(issueId)
        }
      })
    );

    return {
      storageProvider: "r2",
      objectKey,
      storagePath: null
    };
  }

  const ticketDirectory = path.join(localUploadRoot, String(issueId));
  const storedFileName = `${Date.now()}-${fileName}`;
  const storagePath = path.join(ticketDirectory, storedFileName);

  await fs.mkdir(ticketDirectory, { recursive: true });
  await fs.writeFile(storagePath, buffer);

  return {
    storageProvider: "local",
    objectKey: null,
    storagePath
  };
}

async function createPresignedPutUrl({ issueId, fileName, mimeType }) {
  if (storageProvider() !== "r2") {
    throw new AppError("Direct uploads require R2 storage", 503);
  }

  const config = r2Configuration();
  const objectKey = objectKeyFor(issueId, fileName);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: mimeType
  });
  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });

  return {
    uploadUrl,
    objectKey,
    storageProvider: "r2",
    expiresInSeconds: 300
  };
}

async function readAttachmentObject(attachmentStorage) {
  if (attachmentStorage.storage_provider === "r2") {
    if (!attachmentStorage.object_key) {
      throw new AppError("Attachment object key is missing", 500);
    }

    const config = r2Configuration();
    const response = await r2Client().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: attachmentStorage.object_key
      })
    );

    return Buffer.from(await response.Body.transformToByteArray());
  }

  if (!attachmentStorage.storage_path) {
    throw new AppError("Attachment local storage path is missing", 500);
  }

  return fs.readFile(attachmentStorage.storage_path);
}

module.exports = {
  createPresignedPutUrl,
  readAttachmentObject,
  storageProvider,
  uploadAttachmentObject
};
