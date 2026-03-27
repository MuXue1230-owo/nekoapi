import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { DurableObject } from "cloudflare:workers";
import { dirname, join, relative } from "node:path";
import JSZip from "jszip";
import config from "./assets/config.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const bundledAssetsRoot = "/bundle/assets/rs";
const bundledBaseRoot = join(bundledAssetsRoot, "base");
const bundledMcmetaRoot = join(bundledAssetsRoot, "mcmeta");
const legacyDirectDownload = {
  version: "java-1-12-2",
  pathname: "/download/java-1-12-2-direct",
  filename: "Neko Language Pack v2.0.8 for 1.12.2.zip",
};
const legacyDirectDownloadPath = join(bundledAssetsRoot, legacyDirectDownload.filename);
const generatedDownloadPathPrefix = "/download/";
const buildArchiveStorageBinding = "BUILD_ARCHIVES";
const buildArchiveChunkSize = 1024 * 1024;
const buildArchiveStorageBatchSize = 128;
const buildArchiveTtlMs = 60 * 60 * 1000;
const buildBooleanFields = ["new_lang", "random"];
const allowedBuildTypes = ["java", "bedrock"];

// 类别到 rs 目录的映射
const categoryToRsDir = {
  "original": "original",
  "vanilla": "original",
  "mods": "mods",
  "extension": "extension"
};

function jsonResponse(data, status = 200) {
	const headers = new Headers(corsHeaders);
	return Response.json(data, {
		status,
		headers,
	});
}

function errorResponse(status, code, message, extra = {}) {
  return jsonResponse(
    {
      ok: false,
      code,
      message,
      ...extra,
    },
    status,
  );
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStringArray(value, fieldName, issues) {
  if (!Array.isArray(value)) {
    issues.push({
      field: fieldName,
      message: `${fieldName} must be an array of strings.`,
    });
    return;
  }

  const invalidIndex = value.findIndex((item) => typeof item !== "string");

  if (invalidIndex !== -1) {
    issues.push({
      field: fieldName,
      message: `${fieldName}[${invalidIndex}] must be a string.`,
    });
  }
}

function normalizeRelativeArchivePath(rawPath) {
  if (typeof rawPath !== "string") {
    return null;
  }

  const normalizedPath = normalizeArchivePath(rawPath.trim());

  if (
    normalizedPath === "" ||
    normalizedPath.endsWith("/") ||
    normalizedPath.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalizedPath)
  ) {
    return null;
  }

  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return segments.join("/");
}

function validateBuildRequest(payload) {
  const issues = [];

  if (!isPlainObject(payload)) {
    return {
      ok: false,
      issues: [
        {
          field: "$",
          message: "Request body must be a JSON object.",
        },
      ],
    };
  }

  if (!allowedBuildTypes.includes(payload.type)) {
    issues.push({
      field: "type",
      message: 'type must be "java" or "bedrock".',
    });
  }

  if (typeof payload.version !== "string" || payload.version.trim() === "") {
    issues.push({
      field: "version",
      message: "version must be a non-empty string.",
    });
  }

  // 验证 categories 对象格式：{category: [modules]}
  if (payload.categories && !isPlainObject(payload.categories)) {
    issues.push({
      field: "categories",
      message: "categories must be an object with category keys and module arrays as values.",
    });
  } else if (payload.categories) {
    for (const [category, modules] of Object.entries(payload.categories)) {
      if (!Array.isArray(modules)) {
        issues.push({
          field: `categories.${category}`,
          message: `${category} must be an array of module IDs.`,
        });
      } else {
        for (let i = 0; i < modules.length; i++) {
          if (typeof modules[i] !== "string") {
            issues.push({
              field: `categories.${category}[${i}]`,
              message: `${category}[${i}] must be a string.`,
            });
          }
        }
      }
    }
  }

  for (const fieldName of buildBooleanFields) {
    if (typeof payload[fieldName] !== "boolean") {
      issues.push({
        field: fieldName,
        message: `${fieldName} must be a boolean.`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    data: {
      type: payload.type,
      version: payload.version.trim(),
      categories: payload.categories || {},
      new_lang: payload.new_lang,
      random: payload.random,
    },
  };
}

function copyDirectoryRecursive(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
      continue;
    }

    writeFileSync(targetPath, readFileSync(sourcePath));
  }
}

function listMcmetaTemplates() {
  if (!existsSync(bundledMcmetaRoot)) {
    return [];
  }

  return readdirSync(bundledMcmetaRoot).filter((name) => name.endsWith(".mcmeta"));
}

function buildMcmetaCandidates(type, version) {
  const candidates = [];
  const seen = new Set();
  const rawVersion = version.trim();

  const appendCandidate = (filename) => {
    if (!filename || seen.has(filename)) {
      return;
    }

    seen.add(filename);
    candidates.push(filename);
  };

  if (rawVersion.startsWith(`${type}-`)) {
    const versionParts = rawVersion.split("-");

    appendCandidate(`${rawVersion}.mcmeta`);

    for (let count = versionParts.length - 1; count >= 3; count -= 1) {
      appendCandidate(`${versionParts.slice(0, count).join("-")}.mcmeta`);
    }

    return candidates;
  }

  const dotVersionParts = rawVersion.split(".").filter(Boolean);

  appendCandidate(`${type}-${rawVersion}.mcmeta`);
  appendCandidate(`${type}-${rawVersion.replaceAll(".", "-")}.mcmeta`);

  for (let count = dotVersionParts.length - 1; count >= 2; count -= 1) {
    appendCandidate(`${type}-${dotVersionParts.slice(0, count).join(".")}.mcmeta`);
    appendCandidate(`${type}-${dotVersionParts.slice(0, count).join("-")}.mcmeta`);
  }

  return candidates;
}

function resolveMcmetaTemplate(type, version) {
  const availableTemplates = listMcmetaTemplates();

  for (const candidate of buildMcmetaCandidates(type, version)) {
    if (availableTemplates.includes(candidate)) {
      return {
        ok: true,
        filename: candidate,
        sourcePath: join(bundledMcmetaRoot, candidate),
      };
    }
  }

  return {
    ok: false,
    availableTemplates,
  };
}

function readJsonFile(jsonPath) {
  const rawText = readFileSync(jsonPath, "utf8").replace(/^\uFEFF/, "");

  return JSON.parse(rawText);
}

function normalizeArchivePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function batchArray(values, size) {
  const batches = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}

function splitUint8Array(value, chunkSize) {
  const chunks = [];

  for (let offset = 0; offset < value.byteLength; offset += chunkSize) {
    chunks.push(value.slice(offset, offset + chunkSize));
  }

  return chunks;
}

function collectFilesRecursively(rootDir, currentDir = rootDir) {
  const files = [];

  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(rootDir, absolutePath));
      continue;
    }

    files.push({
      absolutePath,
      archivePath: normalizeArchivePath(relative(rootDir, absolutePath)),
    });
  }

  return files;
}

/**
 * 创建构建工作区（新版本：基于 categories 结构）
 * @param {Object} buildRequest - 构建请求对象
 * @returns {Object} 工作区对象或错误响应
 */
function createBuildWorkspace(buildRequest) {
  const { type, version, categories } = buildRequest.data;

  // 1. 验证基础资源
  if (!existsSync(bundledBaseRoot) || !statSync(bundledBaseRoot).isDirectory()) {
    return {
      ok: false,
      error: errorResponse(500, "BUILD_ASSETS_MISSING", "Bundled base assets are missing.")
    };
  }

  // 2. 解析 mcmeta 模板
  const mcmetaTemplate = resolveMcmetaTemplate(type, version);
  if (!mcmetaTemplate.ok) {
    return {
      ok: false,
      error: errorResponse(
        422,
        "MCMETA_TEMPLATE_NOT_FOUND",
        "No mcmeta template matches the requested type and version.",
        {
          type,
          version,
          availableTemplates: mcmetaTemplate.availableTemplates
        }
      )
    };
  }

  // 3. 创建临时工作区
  const tempDir = join("/tmp", `build-${crypto.randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  copyDirectoryRecursive(bundledBaseRoot, tempDir);
  writeFileSync(join(tempDir, "pack.mcmeta"), readFileSync(mcmetaTemplate.sourcePath));

  // 4. 收集工作区信息
  const workspaceInfo = {
    tempDir,
    mcmetaTemplate: mcmetaTemplate.filename,
    categories: Object.keys(categories),
    modules: {},
    errors: []
  };

  // 5. 处理每个 category
  for (const [category, moduleIds] of Object.entries(categories)) {
    if (!moduleIds || moduleIds.length === 0) continue;

    const result = getModuleFilesFromConfig(category, moduleIds, version);

    if (!result.ok) {
      workspaceInfo.errors.push(...result.errors);
      continue;
    }

    workspaceInfo.modules[category] = {
      moduleIds,
      files: result.mergedFiles
    };

    // 根据类别处理文件
    if (category === "original" || category === "vanilla") {
      // 合并所有 JSON 文件到 zh_cn.json
      const mergedLang = {};
      const zhCnModules = [];

      for (const file of result.mergedFiles) {
        if (file.content) {
          Object.assign(mergedLang, file.content);
          zhCnModules.push(...file.mergedFrom);
        }
      }

      const zhCnPath = join(tempDir, "assets", "minecraft", "lang", "zh_cn.json");
      writeFileSync(zhCnPath, JSON.stringify(mergedLang, null, 2));

      workspaceInfo.zhCnPath = zhCnPath;
      workspaceInfo.zhCnEntries = Object.keys(mergedLang).length;
      workspaceInfo.zhCnModules = [...new Set(zhCnModules)];

    } else if (category === "mods") {
      // 处理 mod 文件
      for (const file of result.mergedFiles) {
        const match = file.targetPath.match(/assets\/([^/]+)\/lang\/zh_cn\.json$/);
        if (!match) continue;

        const namespace = match[1];
        const targetPath = join(tempDir, "assets", namespace, "lang", "zh_cn.json");

        mkdirSync(join(tempDir, "assets", namespace, "lang"), { recursive: true });

        if (file.content) {
          writeFileSync(targetPath, JSON.stringify(file.content, null, 2));
        } else if (file.sourcePath && existsSync(file.sourcePath)) {
          writeFileSync(targetPath, readFileSync(file.sourcePath));
        }

        if (!workspaceInfo.modules[category].namespaces) {
          workspaceInfo.modules[category].namespaces = [];
        }
        workspaceInfo.modules[category].namespaces.push({
          namespace,
          entries: Object.keys(file.content || {}),
          modules: file.mergedFrom || []
        });
      }

    } else if (category === "extension") {
      // 处理扩展文件
      for (const file of result.mergedFiles) {
        const targetPath = join(tempDir, file.targetPath);
        mkdirSync(dirname(targetPath), { recursive: true });

        if (file.content) {
          writeFileSync(targetPath, JSON.stringify(file.content, null, 2));
        } else if (file.sourcePath && existsSync(file.sourcePath)) {
          writeFileSync(targetPath, readFileSync(file.sourcePath));
        }
      }
    }
  }

  // 6. 检查是否有严重错误
  if (workspaceInfo.errors.length > 0) {
    return {
      ok: false,
      error: errorResponse(
        422,
        "MODULE_CONFIG_ERROR",
        "One or more modules have configuration errors.",
        { errors: workspaceInfo.errors }
      )
    };
  }

  // 7. 返回成功的工作区
  return {
    ok: true,
    workspace: workspaceInfo
  };
}

function isLegacyDirectDownloadRequest(buildRequest) {
  return buildRequest.type === "java" && buildRequest.version === legacyDirectDownload.version;
}

function isBuildTypeReady(buildRequest) {
  return buildRequest.type === "java";
}

function handleDirectDownload(pathname) {
  if (pathname !== legacyDirectDownload.pathname) {
    return errorResponse(404, "NOT_FOUND", "Route not found.");
  }

  if (!existsSync(legacyDirectDownloadPath)) {
    return errorResponse(500, "DOWNLOAD_ASSET_MISSING", "Direct download asset is missing.");
  }

  const file = readFileSync(legacyDirectDownloadPath);

  return new Response(file, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${legacyDirectDownload.filename}"`,
      "Content-Length": String(file.byteLength),
    },
  });
}

async function createBuildArchive(workspace, version) {
  const archive = new JSZip();
  const archiveFilename = `NekoLanguagePack-BuildVer-${version}.zip`;
  const files = collectFilesRecursively(workspace.tempDir);

  for (const file of files) {
    archive.file(file.archivePath, readFileSync(file.absolutePath));
  }

  const content = await archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9,
    },
  });

  return {
    downloadId: crypto.randomUUID(),
    filename: archiveFilename,
    content,
  };
}

function resolveBuildArchiveStorage(env) {
  const binding = env?.[buildArchiveStorageBinding];

  if (!binding) {
    return {
      ok: false,
    };
  }

  return {
    ok: true,
    binding,
  };
}

async function storeBuildArchive(env, archive) {
  const storage = resolveBuildArchiveStorage(env);

  if (!storage.ok) {
    return {
      ok: false,
      error: errorResponse(500, "DOWNLOAD_STORAGE_UNAVAILABLE", "Build download storage is not configured."),
    };
  }

  const downloadPathname = `${generatedDownloadPathPrefix}${archive.downloadId}`;
  const durableObjectId = storage.binding.idFromName(archive.downloadId);
  const durableObjectStub = storage.binding.get(durableObjectId);
  const storeResponse = await durableObjectStub.fetch("https://build-archives.internal/store", {
    method: "PUT",
    headers: {
      "X-Archive-Filename": archive.filename,
      "X-Archive-Size": String(archive.content.byteLength),
    },
    body: archive.content,
  });

  if (!storeResponse.ok) {
    return {
      ok: false,
      error: errorResponse(500, "DOWNLOAD_STORAGE_WRITE_FAILED", "Failed to store build download."),
    };
  }

  return {
    ok: true,
    download: {
      pathname: downloadPathname,
      filename: archive.filename,
      size: archive.content.byteLength,
    },
  };
}

async function handleGeneratedDownload(request, env) {
  const storage = resolveBuildArchiveStorage(env);

  if (!storage.ok) {
    return errorResponse(500, "DOWNLOAD_STORAGE_UNAVAILABLE", "Build download storage is not configured.");
  }

  const { pathname } = new URL(request.url);

  if (!pathname.startsWith(generatedDownloadPathPrefix)) {
    return errorResponse(404, "NOT_FOUND", "Route not found.");
  }

  const downloadId = pathname.slice(generatedDownloadPathPrefix.length);

  if (!downloadId) {
    return errorResponse(404, "DOWNLOAD_NOT_FOUND", "Download link not found or expired.");
  }

  const durableObjectId = storage.binding.idFromName(downloadId);
  const durableObjectStub = storage.binding.get(durableObjectId);
  const downloadResponse = await durableObjectStub.fetch("https://build-archives.internal/download");

  if (downloadResponse.status === 404) {
    return errorResponse(404, "DOWNLOAD_NOT_FOUND", "Download link not found or expired.");
  }

  if (!downloadResponse.ok) {
    return errorResponse(500, "DOWNLOAD_STORAGE_READ_FAILED", "Failed to read build download.");
  }

  return downloadResponse;
}

async function handleBuild(request, env) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const validation = validateBuildRequest(payload);

  if (!validation.ok) {
    return errorResponse(422, "INVALID_BUILD_REQUEST", "Build request validation failed.", {
      issues: validation.issues,
    });
  }

  if (!isBuildTypeReady(validation.data)) {
    return errorResponse(
      503,
      "BEDROCK_RESOURCES_NOT_READY",
      "Bedrock resources are not ready yet.",
      {
        data: validation.data,
      },
    );
  }

  if (isLegacyDirectDownloadRequest(validation.data)) {
    return jsonResponse(
      {
        ok: true,
        code: "DIRECT_DOWNLOAD_REQUIRED",
        message: "This version is only available as a direct download package.",
        data: validation.data,
        download: {
          pathname: legacyDirectDownload.pathname,
          filename: legacyDirectDownload.filename,
        },
      },
      200,
    );
  }

  const workspace = createBuildWorkspace(validation.data);

  if (!workspace.ok) {
    return workspace.error;
  }

  const archive = await createBuildArchive(workspace.workspace, validation.data.version);
  const storedArchive = await storeBuildArchive(env, archive);

  rmSync(workspace.workspace.tempDir, { recursive: true, force: true });

  if (!storedArchive.ok) {
    return storedArchive.error;
  }

  return jsonResponse(
    {
      ok: true,
      code: "BUILD_ARCHIVE_READY",
      message: "Build archive created and ready to download.",
      data: validation.data,
      workspace: workspace.workspace,
      download: storedArchive.download,
    },
    201,
  );
}

export class BuildArchiveStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "PUT" && pathname === "/store") {
      const archiveContent = new Uint8Array(await request.arrayBuffer());
      const archiveFilename = request.headers.get("X-Archive-Filename") ?? "download.zip";
      const archiveSizeHeader = Number.parseInt(request.headers.get("X-Archive-Size") ?? "", 10);
      const archiveSize = Number.isFinite(archiveSizeHeader) ? archiveSizeHeader : archiveContent.byteLength;
      const expiresAt = Date.now() + buildArchiveTtlMs;
      const chunkEntries = {};
      const archiveChunks = splitUint8Array(archiveContent, buildArchiveChunkSize);

      archiveChunks.forEach((chunk, index) => {
        chunkEntries[`chunk:${index}`] = chunk;
      });

      await this.ctx.storage.deleteAll();
      await this.ctx.storage.put("meta", {
        filename: archiveFilename,
        size: archiveSize,
        chunkCount: archiveChunks.length,
        expiresAt,
      });

      for (const batch of batchArray(Object.entries(chunkEntries), buildArchiveStorageBatchSize)) {
        await this.ctx.storage.put(Object.fromEntries(batch));
      }

      await this.ctx.storage.setAlarm(expiresAt);

      return new Response(null, {
        status: 204,
      });
    }

    if (request.method === "GET" && pathname === "/download") {
      const metadata = await this.ctx.storage.get("meta");

      if (!metadata || metadata.expiresAt <= Date.now()) {
        await this.ctx.storage.deleteAll();

        return new Response(null, {
          status: 404,
        });
      }

      const chunkKeys = Array.from({ length: metadata.chunkCount }, (_, index) => `chunk:${index}`);
      const chunkBuffers = [];

      for (const batch of batchArray(chunkKeys, buildArchiveStorageBatchSize)) {
        const chunkMap = await this.ctx.storage.get(batch);

        for (const key of batch) {
          const chunk = chunkMap.get(key);

          if (!(chunk instanceof Uint8Array)) {
            return new Response(null, {
              status: 404,
            });
          }

          chunkBuffers.push(chunk);
        }
      }

      const archiveContent = new Uint8Array(metadata.size);
      let offset = 0;

      for (const chunk of chunkBuffers) {
        archiveContent.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return new Response(archiveContent, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${metadata.filename}"`,
          "Content-Length": String(metadata.size),
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (request.method === "DELETE" && pathname === "/download") {
      await this.ctx.storage.deleteAll();

      return new Response(null, {
        status: 204,
      });
    }

    return new Response(null, {
      status: 404,
    });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

function handleOptions(pathname) {
  const allowedPaths = [
    "/config.json",
    "/build",
    legacyDirectDownload.pathname,
  ];

  const isAllowed =
    allowedPaths.includes(pathname) ||
    pathname.startsWith("/download/");

  if (!isAllowed) {
    return new Response(null, {
      status: 404,
      headers: corsHeaders,
    });
  }

  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(pathname);
    }

    if (pathname === "/config.json") {
      if (request.method !== "GET") {
        return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET is allowed for /config.json.");
      }

      return jsonResponse(config);
    }

    if (pathname === "/build") {
      if (request.method !== "POST") {
        return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is allowed for /build.");
      }

      return handleBuild(request, env);
    }

    if (pathname === legacyDirectDownload.pathname) {
      if (request.method !== "GET") {
        return errorResponse(
          405,
          "METHOD_NOT_ALLOWED",
          `Only GET is allowed for ${legacyDirectDownload.pathname}.`,
        );
      }

      return handleDirectDownload(pathname);
    }

    if (pathname.startsWith("/download/")) {
      if (request.method !== "GET") {
        return errorResponse(405, "METHOD_NOT_ALLOWED", `Only GET is allowed for ${pathname}.`);
      }

      return handleGeneratedDownload(request, env);
    }

    return errorResponse(404, "NOT_FOUND", "Route not found.");
  },
};
