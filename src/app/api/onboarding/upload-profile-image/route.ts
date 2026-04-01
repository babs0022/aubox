import { getUserFromSession } from "@/lib/auth";
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const PROFILE_IMAGES_CONTAINER = "profile-images";

const parseConnectionString = (connectionString: string): { accountName: string; accountKey: string } | null => {
  const parts = Object.fromEntries(
    connectionString
      .split(";")
      .map((item) => {
        const separatorIndex = item.indexOf("=");
        if (separatorIndex < 0) return null;
        const key = item.slice(0, separatorIndex);
        const value = item.slice(separatorIndex + 1);
        return [key, value] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );

  const accountName = parts.AccountName;
  const accountKey = parts.AccountKey;
  if (!accountName || !accountKey) {
    return null;
  }

  return { accountName, accountKey };
};

export async function POST(request: NextRequest) {
  const sessionUser = await getUserFromSession();
  if (!sessionUser?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WebP are allowed" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be 5MB or less" }, { status: 400 });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(PROFILE_IMAGES_CONTAINER);
    await containerClient.createIfNotExists();

    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const blobName = `${sessionUser.sub}/${Date.now()}-${randomUUID()}.${extension}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const bytes = await file.arrayBuffer();
    await blockBlobClient.uploadData(bytes, {
      blobHTTPHeaders: {
        blobContentType: file.type,
      },
    });

    const parsed = parseConnectionString(connectionString);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid storage configuration" }, { status: 500 });
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(parsed.accountName, parsed.accountKey);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: PROFILE_IMAGES_CONTAINER,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(),
        expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      sharedKeyCredential
    ).toString();

    return NextResponse.json({
      success: true,
      profileImageUrl: `${blockBlobClient.url}?${sas}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
