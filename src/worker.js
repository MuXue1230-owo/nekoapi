import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
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
const bundledOriginalRoot = join(bundledAssetsRoot, "original");
const bundledDiffersRoot = join(bundledAssetsRoot, "differs");
const bundledExtensionRoot = join(bundledAssetsRoot, "extension");
const bundledModsRoot = join(bundledAssetsRoot, "mods");
const legacyDirectDownload = {
  version: "java-1-12-2",
  pathname: "/download/java-1-12-2-direct",
  filename: "Neko Language Pack v2.0.8 for 1.12.2.zip",
};
const legacyDirectDownloadPath = join(bundledAssetsRoot, legacyDirectDownload.filename);
const buildArrayFields = ["original", "extension", "mod", "unfinished"];
const buildBooleanFields = ["new_lang", "random"];
const allowedBuildTypes = ["java", "bedrock"];

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders,
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

  for (const fieldName of buildArrayFields) {
    validateStringArray(payload[fieldName], fieldName, issues);
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
      original: payload.original,
      extension: payload.extension,
      mod: payload.mod,
      unfinished: payload.unfinished,
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

function resolveOriginalModule(moduleId) {
  const sourcePath = join(bundledOriginalRoot, `${moduleId}.json`);

  if (!existsSync(sourcePath)) {
    return {
      ok: false,
      moduleId,
    };
  }

  return {
    ok: true,
    moduleId,
    sourcePath,
  };
}

function resolveDifferModule(moduleId) {
  const sourcePath = join(bundledDiffersRoot, `${moduleId}.json`);

  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    return {
      ok: false,
      moduleId,
    };
  }

  return {
    ok: true,
    moduleId,
    sourcePath,
  };
}

function readJsonFile(jsonPath) {
  const rawText = readFileSync(jsonPath, "utf8").replace(/^\uFEFF/, "");

  return JSON.parse(rawText);
}

function normalizeArchivePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function mergeOriginalModules(moduleIds) {
  const merged = {};
  const resolvedModules = [];

  for (const moduleId of moduleIds) {
    const resolvedModule = resolveOriginalModule(moduleId);

    if (!resolvedModule.ok) {
      return resolvedModule;
    }

    let moduleContent;

    try {
      moduleContent = readJsonFile(resolvedModule.sourcePath);
    } catch {
      return {
        ok: false,
        moduleId,
        invalid: true,
      };
    }

    Object.assign(merged, moduleContent);
    resolvedModules.push(moduleId);
  }

  return {
    ok: true,
    resolvedModules,
    merged,
  };
}

function mergeDifferModule(moduleId, targetPath) {
  const resolvedModule = resolveDifferModule(moduleId);

  if (!resolvedModule.ok) {
    return {
      ok: true,
      applied: false,
      moduleId,
    };
  }

  let targetContent;
  let differContent;

  try {
    targetContent = readJsonFile(targetPath);
    differContent = readJsonFile(resolvedModule.sourcePath);
  } catch {
    return {
      ok: false,
      moduleId,
      invalid: true,
    };
  }

  const merged = {
    ...targetContent,
    ...differContent,
  };

  writeFileSync(targetPath, JSON.stringify(merged, null, 2));

  return {
    ok: true,
    applied: true,
    moduleId,
    entries: Object.keys(differContent).length,
    mergedEntries: Object.keys(merged).length,
    path: resolvedModule.sourcePath,
  };
}

function resolveExtensionFile(moduleId) {
  const sourcePath = join(bundledExtensionRoot, moduleId);

  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    return {
      ok: false,
      moduleId,
    };
  }

  return {
    ok: true,
    moduleId,
    sourcePath,
    filename: moduleId,
  };
}

function buildModCandidates(moduleId) {
  const rawId = moduleId.trim();
  const normalizedId = rawId.toLowerCase();
  const compactId = normalizedId.replace(/[^a-z0-9_]/g, "");
  const candidates = [];
  const seen = new Set();

  const appendCandidate = (namespace) => {
    if (!namespace || seen.has(namespace)) {
      return;
    }

    seen.add(namespace);
    candidates.push(namespace);
  };

  appendCandidate(rawId);
  appendCandidate(normalizedId);
  appendCandidate(compactId);

  return candidates;
}

function resolveModModule(moduleId) {
  for (const namespace of buildModCandidates(moduleId)) {
    const sourcePath = join(bundledModsRoot, `${namespace}.json`);

    if (existsSync(sourcePath) && statSync(sourcePath).isFile()) {
      return {
        ok: true,
        moduleId,
        namespace,
        sourcePath,
      };
    }
  }

  return {
    ok: false,
    moduleId,
  };
}

function copyExtensionFiles(moduleIds, textsDir) {
  const copiedFiles = [];
  const ignoredModules = [];

  mkdirSync(textsDir, { recursive: true });

  for (const moduleId of moduleIds) {
    const resolvedFile = resolveExtensionFile(moduleId);

    if (!resolvedFile.ok) {
      ignoredModules.push(moduleId);
      continue;
    }

    const targetPath = join(textsDir, resolvedFile.filename);

    writeFileSync(targetPath, readFileSync(resolvedFile.sourcePath));
    copiedFiles.push(resolvedFile.filename);
  }

  return {
    copiedFiles,
    ignoredModules,
  };
}

function copyModFiles(moduleIds, tempDir) {
  const copiedModules = [];

  for (const moduleId of moduleIds) {
    const resolvedModule = resolveModModule(moduleId);

    if (!resolvedModule.ok) {
      return resolvedModule;
    }

    let moduleContent;

    try {
      moduleContent = readJsonFile(resolvedModule.sourcePath);
    } catch {
      return {
        ok: false,
        moduleId,
        invalid: true,
      };
    }

    const targetPath = join(tempDir, "assets", resolvedModule.namespace, "lang", "zh_cn.json");

    mkdirSync(join(tempDir, "assets", resolvedModule.namespace, "lang"), { recursive: true });
    writeFileSync(targetPath, JSON.stringify(moduleContent, null, 2));
    copiedModules.push({
      moduleId,
      namespace: resolvedModule.namespace,
      path: targetPath,
      entries: Object.keys(moduleContent).length,
    });
  }

  return {
    ok: true,
    copiedModules,
  };
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

function createBuildWorkspace(buildRequest) {
  if (!existsSync(bundledBaseRoot) || !statSync(bundledBaseRoot).isDirectory()) {
    return {
      ok: false,
      error: errorResponse(500, "BUILD_ASSETS_MISSING", "Bundled base assets are missing."),
    };
  }

  const mcmetaTemplate = resolveMcmetaTemplate(buildRequest.type, buildRequest.version);

  if (!mcmetaTemplate.ok) {
    return {
      ok: false,
      error: errorResponse(
        422,
        "MCMETA_TEMPLATE_NOT_FOUND",
        "No mcmeta template matches the requested type and version.",
        {
          type: buildRequest.type,
          version: buildRequest.version,
          availableTemplates: mcmetaTemplate.availableTemplates,
        },
      ),
    };
  }

  const originalModules = mergeOriginalModules(buildRequest.original);

  if (!originalModules.ok) {
    if (originalModules.invalid) {
      return {
        ok: false,
        error: errorResponse(
          500,
          "ORIGINAL_MODULE_INVALID",
          "One or more original modules contain invalid JSON.",
          {
            moduleId: originalModules.moduleId,
          },
        ),
      };
    }

    return {
      ok: false,
      error: errorResponse(
        422,
        "ORIGINAL_MODULE_NOT_FOUND",
        "One or more original modules could not be found.",
        {
          moduleId: originalModules.moduleId,
        },
      ),
    };
  }

  const tempDir = join("/tmp", `build-${crypto.randomUUID()}`);
  const zhCnPath = join(tempDir, "assets", "minecraft", "lang", "zh_cn.json");
  const textsDir = join(tempDir, "assets", "minecraft", "texts");

  mkdirSync(tempDir, { recursive: true });
  copyDirectoryRecursive(bundledBaseRoot, tempDir);
  writeFileSync(join(tempDir, "pack.mcmeta"), readFileSync(mcmetaTemplate.sourcePath));
  mkdirSync(join(tempDir, "assets", "minecraft", "lang"), { recursive: true });
  writeFileSync(zhCnPath, JSON.stringify(originalModules.merged, null, 2));
  const differModule = mergeDifferModule(buildRequest.version, zhCnPath);
  const extensionFiles = copyExtensionFiles(buildRequest.extension, textsDir);
  const modFiles = copyModFiles(buildRequest.mod, tempDir);

  if (!differModule.ok) {
    return {
      ok: false,
      error: errorResponse(
        500,
        "DIFFER_MODULE_INVALID",
        "The version-specific differ module contains invalid JSON.",
        {
          moduleId: differModule.moduleId,
        },
      ),
    };
  }

  if (!modFiles.ok) {
    if (modFiles.invalid) {
      return {
        ok: false,
        error: errorResponse(
          500,
          "MOD_MODULE_INVALID",
          "One or more mod modules contain invalid JSON.",
          {
            moduleId: modFiles.moduleId,
          },
        ),
      };
    }

    return {
      ok: false,
      error: errorResponse(422, "MOD_MODULE_NOT_FOUND", "One or more mod modules could not be found.", {
        moduleId: modFiles.moduleId,
      }),
    };
  }

  return {
    ok: true,
    tempDir,
    mcmetaTemplate: mcmetaTemplate.filename,
    rootEntries: readdirSync(tempDir).sort(),
    originalModules: originalModules.resolvedModules,
    zhCnPath,
    zhCnEntries: differModule.applied ? differModule.mergedEntries : Object.keys(originalModules.merged).length,
    extensionFiles: extensionFiles.copiedFiles,
    ignoredExtensionModules: extensionFiles.ignoredModules,
    modModules: modFiles.copiedModules.map((module) => module.moduleId),
    modNamespaces: modFiles.copiedModules.map((module) => module.namespace),
    modLangFiles: modFiles.copiedModules.map((module) => ({
      moduleId: module.moduleId,
      namespace: module.namespace,
      path: module.path,
      entries: module.entries,
    })),
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

async function storeBuildArchive(request, archive) {
  const downloadPathname = `/download/${archive.downloadId}`;
  const downloadUrl = new URL(downloadPathname, request.url);
  const response = new Response(archive.content, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.filename}"`,
      "Content-Length": String(archive.content.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });

  await caches.default.put(downloadUrl.toString(), response.clone());

  return {
    pathname: downloadPathname,
    filename: archive.filename,
    size: archive.content.byteLength,
  };
}

async function handleGeneratedDownload(request) {
  const cachedResponse = await caches.default.match(request.url);

  if (!cachedResponse) {
    return errorResponse(404, "DOWNLOAD_NOT_FOUND", "Download link not found or expired.");
  }

  return cachedResponse;
}

async function handleBuild(request) {
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

  const archive = await createBuildArchive(workspace, validation.data.version);
  const download = await storeBuildArchive(request, archive);

  rmSync(workspace.tempDir, { recursive: true, force: true });

  return jsonResponse(
    {
      ok: true,
      code: "BUILD_ARCHIVE_READY",
      message: "Build archive created and ready to download.",
      data: validation.data,
      workspace: {
        tempDir: workspace.tempDir,
        mcmetaTemplate: workspace.mcmetaTemplate,
        rootEntries: workspace.rootEntries,
        originalModules: workspace.originalModules,
        zhCnPath: workspace.zhCnPath,
        zhCnEntries: workspace.zhCnEntries,
        extensionFiles: workspace.extensionFiles,
        ignoredExtensionModules: workspace.ignoredExtensionModules,
        modModules: workspace.modModules,
        modNamespaces: workspace.modNamespaces,
        modLangFiles: workspace.modLangFiles,
      },
      download,
    },
    201,
  );
}

function handleOptions(pathname) {
  if (
    pathname !== "/config.json" &&
    pathname !== "/build" &&
    pathname !== legacyDirectDownload.pathname &&
    !pathname.startsWith("/download/")
  ) {
    return errorResponse(404, "NOT_FOUND", "Route not found.");
  }

  return jsonResponse(
    {
      ok: true,
      code: "OK",
      message: "Preflight request accepted.",
    },
    200,
  );
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

      return handleBuild(request);
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

      return handleGeneratedDownload(request);
    }

    return errorResponse(404, "NOT_FOUND", "Route not found.");
  },
};
