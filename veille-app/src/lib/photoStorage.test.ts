import { describe, expect, it } from "vitest";
import { join, sep } from "path";
import {
  PRIVATE_UPLOAD_DIR,
  PUBLIC_UPLOAD_DIR,
  buildPrivateStoragePath,
  photoApiUrl,
  resolvePhotoFilePath,
} from "./photoStorage";

describe("photoStorage.resolvePhotoFilePath", () => {
  it("résout les nouvelles photos privées", () => {
    const loc = resolvePhotoFilePath("private:photos/abc.jpg");
    expect(loc).toEqual({
      absolutePath: join(PRIVATE_UPLOAD_DIR, "photos", "abc.jpg"),
      origin: "private",
    });
  });

  it("résout les anciennes photos legacy", () => {
    const loc = resolvePhotoFilePath("/uploads/photos/xyz.jpg");
    expect(loc).toEqual({
      absolutePath: join(PUBLIC_UPLOAD_DIR, "photos", "xyz.jpg"),
      origin: "legacy",
    });
  });

  it("refuse les chemins contenant `..`", () => {
    expect(resolvePhotoFilePath("private:photos/../etc/passwd")).toBeNull();
    expect(resolvePhotoFilePath("/uploads/../etc/passwd")).toBeNull();
    expect(resolvePhotoFilePath("private:..")).toBeNull();
  });

  it("refuse les chemins absolus dans la partie relative privée", () => {
    expect(resolvePhotoFilePath("private:/etc/passwd")).toBeNull();
    expect(resolvePhotoFilePath("private:\\windows\\system32")).toBeNull();
  });

  it("refuse les préfixes inconnus", () => {
    expect(resolvePhotoFilePath("foo:bar")).toBeNull();
    expect(resolvePhotoFilePath("abc.jpg")).toBeNull();
    expect(resolvePhotoFilePath("http://evil/x.jpg")).toBeNull();
  });

  it("refuse les valeurs nulles ou vides", () => {
    expect(resolvePhotoFilePath(null)).toBeNull();
    expect(resolvePhotoFilePath(undefined)).toBeNull();
    expect(resolvePhotoFilePath("")).toBeNull();
    expect(resolvePhotoFilePath("private:")).toBeNull();
    expect(resolvePhotoFilePath("/uploads/")).toBeNull();
  });

  it("normalise les segments redondants sans sortir du dossier autorisé", () => {
    const loc = resolvePhotoFilePath("private:photos/./abc.jpg");
    expect(loc?.absolutePath).toBe(
      join(PRIVATE_UPLOAD_DIR, "photos", "abc.jpg"),
    );
    expect(loc?.absolutePath.startsWith(PRIVATE_UPLOAD_DIR + sep)).toBe(true);
  });
});

describe("photoStorage.buildPrivateStoragePath", () => {
  it("préfixe avec `private:photos/`", () => {
    expect(buildPrivateStoragePath("name.jpg")).toBe("private:photos/name.jpg");
  });
});

describe("photoStorage.photoApiUrl", () => {
  it("renvoie la route auth", () => {
    expect(photoApiUrl("abc123")).toBe("/api/photos/abc123/file");
  });
});
