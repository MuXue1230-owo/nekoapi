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

/**
 * 安全写入文件（自动创建父目录）
 */
function safeWriteFileSync(filePath, content) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content);
}

function resolveRequiredPackFormatVersion(type, version) {
  const platform = (config.platforms || []).find((item) => item.id === type);
  const versionCategory = platform?.categories?.find((item) => item.id === "version");
  const versionItem = versionCategory?.items?.find((item) => item.id === version);
  const packFormatVersion = versionItem?.requiredPackFormat?.version;

  if (typeof packFormatVersion !== "number" || Number.isNaN(packFormatVersion)) {
    return {
      ok: false,
    };
  }

  return {
    ok: true,
    version: packFormatVersion,
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
 * 从 config.json 获取指定类别的模块文件列表
 * @param {string} category - 类别名称（vanilla/mods/expansion/unfinished）
 * @param {string[]} moduleIds - 模块 ID 列表
 * @param {string} version - 游戏版本
 * @param {string} type - 构建类型（java/bedrock）
 * @returns {Object} 包含 mergedFiles 和 errors 的对象
 */
function getModuleFilesFromConfig(category, moduleIds, version, type) {
  const issues = [];
  const mergedFilesMap = new Map(); // key: targetPath, value: MergedFile
  // 构建资源根路径：/bundle/assets/rs/{category} 或 /bundle/assets/rs/differs/{version}
  const assetsRoot = bundledAssetsRoot;
  const textFileExtensions = new Set([
    ".txt",
    ".lang",
    ".properties",
    ".ini",
    ".cfg",
    ".conf",
    ".csv",
    ".tsv",
    ".md",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
  ]);

  function resolveMergeMode(targetPath) {
    const normalizedPath = normalizeArchivePath(targetPath).toLowerCase();

    if (normalizedPath.endsWith(".json") || normalizedPath.endsWith(".mcmeta")) {
      return "json";
    }

    for (const extension of textFileExtensions) {
      if (normalizedPath.endsWith(extension)) {
        return "text";
      }
    }

    return "binary";
  }

  /**
   * 在 config 中递归查找模块
   */
  function findModuleInItems(items, moduleId) {
    for (const item of items) {
      if (item.id === moduleId) {
        return item;
      }
      if (item.children && Array.isArray(item.children)) {
        const found = findModuleInItems(item.children, moduleId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * 获取模块的文件列表（包括差分文件）
   */
  function getModuleFiles(module, ver) {
    const files = [...(module.files || [])];

    // 检查是否有差分配置
    if (module.differ && module.differ[ver]) {
      const differFiles = module.differ[ver].files || [];
      differFiles.forEach(f => {
        files.push({
          ...f,
          isDiffer: true,
          differType: f.type || 'merge',
          // 差分文件从 rs/differs/{version}/original/ 目录读取
          sourcePathOverride: join(assetsRoot, 'differs', ver, 'original', f.name)
        });
      });
    }

    return files;
  }

  // 处理每个模块
  for (const moduleId of moduleIds) {
    const module = findModuleInConfig(config, moduleId);

    if (!module) {
      issues.push({
        moduleId,
        message: `Module not found: ${moduleId}`
      });
      continue;
    }

    const files = getModuleFiles(module, version);

    for (const file of files) {
      const targetPath = file.path;
      // 如果有 sourcePathOverride 则使用它，否则使用默认路径
      // 默认路径：/bundle/assets/rs/{category}/{name}
      const sourcePath = file.sourcePathOverride || join(assetsRoot, category, file.name);

      if (!mergedFilesMap.has(targetPath)) {
        mergedFilesMap.set(targetPath, {
          targetPath,
          sourcePaths: [],
          mergedFrom: [],
          differType: null,
          mergeMode: resolveMergeMode(targetPath),
        });
      }

      const mergedFile = mergedFilesMap.get(targetPath);
      mergedFile.sourcePaths.push(sourcePath);
      mergedFile.mergedFrom.push(moduleId);

      if (file.isDiffer) {
        mergedFile.differType = file.differType;
      }
    }
  }

  // 转换为数组并读取文件内容
  const mergedFiles = [];
  for (const [, fileData] of mergedFilesMap) {
    if (fileData.mergeMode === "binary" && fileData.sourcePaths.length > 1) {
      issues.push({
        moduleId: fileData.mergedFrom.find((id) => id),
        path: fileData.targetPath,
        message: "Failed to merge file: non-text formats cannot be merged.",
      });
      continue;
    }

    if (fileData.mergeMode === "json") {
      const fileContent = {};
      let hasError = false;

      for (const sourcePath of fileData.sourcePaths) {
        try {
          if (existsSync(sourcePath)) {
            const rawText = readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
            const jsonContent = JSON.parse(rawText);
            mergeJson(fileContent, jsonContent, fileData.differType);
          }
        } catch (err) {
          issues.push({
            moduleId: fileData.mergedFrom.find((id) => id),
            path: sourcePath,
            message: `Failed to read/parse file: ${err.message}`,
          });
          hasError = true;
        }
      }

      if (!hasError) {
        mergedFiles.push({
          targetPath: fileData.targetPath,
          mergeMode: fileData.mergeMode,
          content: fileContent,
          sourcePath: fileData.sourcePaths.length === 1 ? fileData.sourcePaths[0] : undefined,
          mergedFrom: fileData.mergedFrom,
        });
      }

      continue;
    }

    if (fileData.mergeMode === "text") {
      let textContent = "";
      let hasError = false;

      for (const sourcePath of fileData.sourcePaths) {
        try {
          if (existsSync(sourcePath)) {
            textContent += readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
          }
        } catch (err) {
          issues.push({
            moduleId: fileData.mergedFrom.find((id) => id),
            path: sourcePath,
            message: `Failed to read text file: ${err.message}`,
          });
          hasError = true;
        }
      }

      if (!hasError) {
        mergedFiles.push({
          targetPath: fileData.targetPath,
          mergeMode: fileData.mergeMode,
          textContent,
          sourcePath: fileData.sourcePaths.length === 1 ? fileData.sourcePaths[0] : undefined,
          mergedFrom: fileData.mergedFrom,
        });
      }

      continue;
    }

    mergedFiles.push({
      targetPath: fileData.targetPath,
      mergeMode: fileData.mergeMode,
      sourcePath: fileData.sourcePaths[0],
      mergedFrom: fileData.mergedFrom,
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      errors: issues
    };
  }

  return {
    ok: true,
    mergedFiles
  };
}

/**
 * 在 config 中递归查找模块
 */
function findModuleInConfig(config, moduleId) {
  for (const platform of config.platforms || []) {
    for (const category of platform.categories || []) {
      const found = findModuleInItems(category.items || [], moduleId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 在 items 列表中递归查找模块
 */
function findModuleInItems(items, moduleId) {
  for (const item of items) {
    if (item.id === moduleId) {
      return item;
    }
    if (item.children && Array.isArray(item.children)) {
      const found = findModuleInItems(item.children, moduleId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 合并 JSON 对象
 */
function mergeJson(target, source, differType = 'merge') {
  if (differType === 'override') {
    Object.assign(target, source);
  } else {
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (!(key in target)) {
          target[key] = {};
        }
        mergeJson(target[key], value, differType);
      } else {
        target[key] = value;
      }
    }
  }
}

/**
 * 创建构建工作区（新版本：基于 categories 结构）
 * @param {Object} buildData - 构建请求数据
 * @returns {Object} 工作区对象或错误响应
 */
function createBuildWorkspace(buildData) {
  if (!buildData || typeof buildData !== 'object') {
    return {
      ok: false,
      error: errorResponse(400, "INVALID_BUILD_DATA", "Build data is missing or invalid.")
    };
  }

  const { type, version, categories } = buildData;

  // 1. 验证基础资源
  if (!existsSync(bundledBaseRoot) || !statSync(bundledBaseRoot).isDirectory()) {
    return {
      ok: false,
      error: errorResponse(500, "BUILD_ASSETS_MISSING", "Bundled base assets are missing.")
    };
  }

  // 2. 从配置解析 pack_format
  const packFormat = resolveRequiredPackFormatVersion(type, version);
  if (!packFormat.ok) {
    return {
      ok: false,
      error: errorResponse(
        422,
        "PACK_FORMAT_VERSION_NOT_FOUND",
        "No requiredPackFormat.version matches the requested type and version.",
        {
          type,
          version,
        }
      )
    };
  }

  // 3. 创建临时工作区
  const tempDir = join("/tmp", `build-${crypto.randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  copyDirectoryRecursive(bundledBaseRoot, tempDir);
  safeWriteFileSync(
    join(tempDir, "pack.mcmeta"),
    JSON.stringify(
      {
        pack: {
          description: "让你的mc变得更可爱喵！\n作者：XiaoshiTwinkling & 望霂",
          pack_format: packFormat.version,
        },
      },
      null,
      2,
    ),
  );

  // 4. 收集工作区信息
  const workspaceInfo = {
    tempDir,
    packFormatVersion: packFormat.version,
    categories: Object.keys(categories),
    modules: {},
    errors: []
  };

  // 5. 处理每个 category
  for (const [category, moduleIds] of Object.entries(categories)) {
    if (!moduleIds || moduleIds.length === 0) continue;

    const result = getModuleFilesFromConfig(category, moduleIds, version, type);

    if (!result.ok) {
      workspaceInfo.errors.push(...result.errors);
      continue;
    }

    workspaceInfo.modules[category] = {
      moduleIds,
      files: result.mergedFiles
    };

    // 根据类别处理文件
    if (category === "vanilla") {
      // 合并所有 JSON 文件到 zh_cn.json
      const mergedLang = {};
      const zhCnModules = [];

      for (const file of result.mergedFiles) {
        if (file.mergeMode === "json" && file.content) {
          Object.assign(mergedLang, file.content);
          zhCnModules.push(...file.mergedFrom);
        }
      }

      const zhCnPath = join(tempDir, "assets", "minecraft", "lang", "zh_cn.json");
      safeWriteFileSync(zhCnPath, JSON.stringify(mergedLang, null, 2));

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

        if (file.mergeMode === "json" && file.content) {
          safeWriteFileSync(targetPath, JSON.stringify(file.content, null, 2));
        } else if (file.mergeMode === "text" && typeof file.textContent === "string") {
          safeWriteFileSync(targetPath, file.textContent);
        } else if (file.sourcePath && existsSync(file.sourcePath)) {
          safeWriteFileSync(targetPath, readFileSync(file.sourcePath));
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

    } else if (category === "expansion" || category === "extension") {
      // 处理扩展文件
      for (const file of result.mergedFiles) {
        const targetPath = join(tempDir, file.targetPath);

        if (file.mergeMode === "json" && file.content) {
          safeWriteFileSync(targetPath, JSON.stringify(file.content, null, 2));
        } else if (file.mergeMode === "text" && typeof file.textContent === "string") {
          safeWriteFileSync(targetPath, file.textContent);
        } else if (file.sourcePath && existsSync(file.sourcePath)) {
          safeWriteFileSync(targetPath, readFileSync(file.sourcePath));
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

function isLegacyDirectDownloadRequest(buildData) {
  return buildData.type === "java" && buildData.version === legacyDirectDownload.version;
}

function isBuildTypeReady(buildData) {
  return buildData.type === "java";
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
    "/nlp",
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

function handleNlpPage() {
  try {
    const htmlPath = join("/bundle/pages", "nlp.html");
    if (!existsSync(htmlPath)) {
      return errorResponse(404, "NOT_FOUND", "Page not found.");
    }
    const htmlContent = readFileSync(htmlPath, "utf8");
    return new Response(htmlContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load page.");
  }
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

    if (pathname === "/nlp") {
      if (request.method !== "GET") {
        return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET is allowed for /nlp.");
      }

      return handleNlpPage();
    }

    return errorResponse(404, "NOT_FOUND", "Route not found.");
  },
};
