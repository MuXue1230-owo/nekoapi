# API 重构指南 - 前端适配文档

> 本文档面向前端开发者，说明构建 API 的重构内容、新的请求格式以及 Config 配置的变化。

---

## 📋 目录

- [快速开始](#快速开始)
- [POST 请求格式](#post-请求格式)
- [响应格式](#响应格式)
- [Config 配置改动](#config-配置改动)
- [迁移指南](#迁移指南)
- [常见问题](#常见问题)

---

## 快速开始

### 新的请求示例

```javascript
// 构建语言包请求
const response = await fetch('/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'java',
    version: 'java-1-21',
    categories: {
      vanilla: ['vanilla-core', 'vanilla-enchantments'],
      mods: ['modmenu', 'sodium'],
      expansion: ['expansion-kaomoji']
    },
    new_lang: false,
    random: false
  })
});

const data = await response.json();
// data.download.pathname → 下载链接
```

---

## POST 请求格式

### 端点

```
POST /build
Content-Type: application/json
```

### 请求体结构

```typescript
interface BuildRequest {
  // 平台类型
  type: 'java' | 'bedrock';

  // 游戏版本（从 config 的 version 类别获取）
  version: string;

  // 选择的模块（按类别组织）
  categories: {
    // 原版内容
    vanilla?: string[];

    // Mod 内容
    mods?: string[];

    // 扩展内容
    expansion?: string[];

    // 未完成内容
    unfinished?: string[];
  };

  // 是否添加新语言（保留字段）
  new_lang?: boolean;

  // 是否打乱文本（保留字段）
  random?: boolean;
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 平台类型：`java` 或 `bedrock` |
| `version` | string | ✅ | 游戏版本 ID，如 `java-1-21` |
| `categories` | object | ✅ | 按类别组织的模块 ID 列表 |
| `categories.vanilla` | string[] | ❌ | 原版内容模块 ID 列表 |
| `categories.mods` | string[] | ❌ | Mod 内容模块 ID 列表 |
| `categories.expansion` | string[] | ❌ | 扩展内容模块 ID 列表 |
| `categories.unfinished` | string[] | ❌ | 未完成内容模块 ID 列表 |
| `new_lang` | boolean | ❌ | 保留字段，默认 `false` |
| `random` | boolean | ❌ | 保留字段，默认 `false` |

### 请求示例

#### 示例 1：标准包（Java 1.21）

```json
{
  "type": "java",
  "version": "java-1-21",
  "categories": {
    "vanilla": ["vanilla-core", "vanilla-enchantments"],
    "mods": ["modmenu", "sodium", "languagereload"],
    "expansion": ["expansion-kaomoji"]
  },
  "new_lang": false,
  "random": false
}
```

#### 示例 2：轻量包（Java 1.20）

```json
{
  "type": "java",
  "version": "java-1-20",
  "categories": {
    "vanilla": ["vanilla-core"],
    "mods": ["sodium", "nochatreports"]
  },
  "new_lang": false,
  "random": false
}
```

#### 示例 3：完整包（带差分支持）

```json
{
  "type": "java",
  "version": "java-1-14",
  "categories": {
    "vanilla": ["vanilla-core", "vanilla-enchantments"],
    "mods": ["modmenu", "ae2", "create"],
    "expansion": ["expansion-end-poem"]
  },
  "new_lang": false,
  "random": false
}
```

---

## 响应格式

### 成功响应（201 Created）

```typescript
interface BuildSuccessResponse {
  ok: true;
  code: 'BUILD_ARCHIVE_READY' | 'DIRECT_DOWNLOAD_REQUIRED';
  message: string;
  data: BuildRequest;
  workspace: WorkspaceInfo;
  download: DownloadInfo;
}

interface WorkspaceInfo {
  tempDir: string;
  mcmetaTemplate: string;
  categories: string[];
  modules: Record<string, CategoryModules>;
  zhCnPath?: string;
  zhCnEntries?: number;
  zhCnModules?: string[];
}

interface CategoryModules {
  moduleIds: string[];
  files: MergedFile[];
  namespaces?: ModNamespace[];
}

interface MergedFile {
  targetPath: string;
  content?: object;
  sourcePath?: string;
  files: FileInfo[];
  merged: boolean;
  mergedFrom?: string[];
}

interface DownloadInfo {
  pathname: string;
  filename: string;
  size: number;
}
```

### 响应字段说明

| 字段 | 说明 |
|------|------|
| `ok` | 请求是否成功 |
| `code` | 响应代码：`BUILD_ARCHIVE_READY` 或 `DIRECT_DOWNLOAD_REQUIRED` |
| `message` | 人类可读的消息 |
| `data` | 原始请求数据 |
| `workspace` | 工作区信息 |
| `workspace.categories` | 处理的类别列表 |
| `workspace.modules` | 每个类别的模块详情 |
| `workspace.zhCnEntries` | 合并后的翻译条目数 |
| `workspace.zhCnModules` | 贡献到主语言文件的模块列表 |
| `download` | 下载信息 |
| `download.pathname` | 下载链接路径 |
| `download.filename` | 建议的文件名 |
| `download.size` | 文件大小（字节） |

### 成功响应示例

```json
{
  "ok": true,
  "code": "BUILD_ARCHIVE_READY",
  "message": "Build archive created and ready to download.",
  "data": {
    "type": "java",
    "version": "java-1-21",
    "categories": {
      "vanilla": ["vanilla-core"],
      "mods": ["modmenu"]
    },
    "new_lang": false,
    "random": false
  },
  "workspace": {
    "tempDir": "/tmp/build-abc123",
    "mcmetaTemplate": "java-1.21.mcmeta",
    "categories": ["vanilla", "mods"],
    "modules": {
      "vanilla": {
        "moduleIds": ["vanilla-core"],
        "files": [
          {
            "targetPath": "assets/minecraft/lang/zh_cn.json",
            "content": { "...": "..." },
            "files": [{"name": "vanilla-core.json", "path": "..."}],
            "merged": false
          }
        ]
      },
      "mods": {
        "moduleIds": ["modmenu"],
        "files": [...],
        "namespaces": [
          {
            "namespace": "modmenu",
            "entries": 42,
            "modules": ["modmenu"]
          }
        ]
      }
    },
    "zhCnPath": "/tmp/build-abc123/assets/minecraft/lang/zh_cn.json",
    "zhCnEntries": 1234,
    "zhCnModules": ["vanilla-core"]
  },
  "download": {
    "pathname": "/download/uuid-here",
    "filename": "NekoLanguagePack-BuildVer-java-1-21.zip",
    "size": 524288
  }
}
```

### 错误响应

#### 400 Bad Request

```json
{
  "ok": false,
  "code": "INVALID_JSON",
  "message": "Request body must be valid JSON."
}
```

#### 422 Unprocessable Entity

```json
{
  "ok": false,
  "code": "INVALID_BUILD_REQUEST",
  "message": "Build request validation failed.",
  "issues": [
    {
      "field": "type",
      "message": "type must be \"java\" or \"bedrock\"."
    }
  ]
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "code": "BUILD_ASSETS_MISSING",
  "message": "Bundled base assets are missing."
}
```

---

## Config 配置改动

### 主要变化

#### 1. 模块结构标准化

**旧格式：**
```json
{
  "id": "vanilla-core",
  "label": { "zh-CN": "原版基础内容" },
  "defaultSelected": true
}
```

**新格式：**
```json
{
  "id": "vanilla-core",
  "label": { "zh-CN": "原版基础内容" },
  "defaultSelected": true,
  "files": [
    {
      "name": "vanilla-core.json",
      "path": "assets/minecraft/lang/zh_cn.json"
    }
  ],
  "differ": {
    "java-1-14": {
      "files": [
        {
          "name": "vanilla-core-1.14.json",
          "path": "assets/minecraft/lang/zh_cn.json",
          "type": "merge"
        }
      ]
    }
  },
  "version_only": ["java-1-14", "java-1-13"]
}
```

#### 2. 新增字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `files` | Array | **必需**。模块包含的文件列表 |
| `files[].name` | string | 源文件名（在 `rs/<category>/` 目录下） |
| `files[].path` | string | 目标路径（在资源包中的路径） |
| `differ` | Object | 可选。版本特定差分配置 |
| `differ.<version>` | Object | 特定版本的差分配置 |
| `differ.<version>.files` | Array | 差分文件列表 |
| `differ.<version>.files[].type` | string | 差分类型：`merge` \| `override` \| `delete` \| `add` |
| `version_only` | Array | 可选。限制模块只在指定版本可用 |

#### 3. 差分类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `merge` | 合并覆盖（默认） | 添加或修改部分文本 |
| `override` | 完全替换 | 整个文件内容变更 |
| `delete` | 删除键 | 移除废弃的翻译键 |
| `add` | 添加新键 | 添加新功能的翻译 |

#### 4. Expansion 类别改动

**旧格式：**
```json
{
  "id": "credits",
  "filelist": [
    {
      "file_name": "credits.json",
      "where": "assets/minecraft/texts/credits.json"
    }
  ]
}
```

**新格式：**
```json
{
  "id": "credits",
  "files": [
    {
      "name": "credits.json",
      "path": "assets/minecraft/texts/credits.json"
    }
  ]
}
```

### 完整的模块配置示例

#### Vanilla 模块

```json
{
  "id": "vanilla-core",
  "label": { "zh-CN": "原版基础内容" },
  "files": [
    {
      "name": "vanilla-core.json",
      "path": "assets/minecraft/lang/zh_cn.json"
    }
  ],
  "differ": {
    "java-1-14": {
      "files": [
        {
          "name": "vanilla-core-1.14.json",
          "path": "assets/minecraft/lang/zh_cn.json",
          "type": "merge"
        }
      ]
    }
  }
}
```

#### Mod 子模块

```json
{
  "id": "modmenu",
  "label": { "zh-CN": "模组菜单" },
  "files": [
    {
      "name": "modmenu.json",
      "path": "assets/modmenu/lang/zh_cn.json"
    }
  ]
}
```

#### Expansion 子模块

```json
{
  "id": "credits",
  "label": { "zh-CN": "credits" },
  "files": [
    {
      "name": "credits.json",
      "path": "assets/minecraft/texts/credits.json"
    }
  ]
}
```

---

## 迁移指南

### 前端代码迁移

#### 旧代码

```javascript
// ❌ 旧格式
const payload = {
  type: 'java',
  version: 'java-1-21',
  original: ['vanilla-core'],
  mod: ['modmenu', 'sodium'],
  unfinished: [],
  extension: [...],
  new_lang: false,
  random: false
};
```

#### 新代码

```javascript
// ✅ 新格式
const payload = {
  type: 'java',
  version: 'java-1-21',
  categories: {
    vanilla: ['vanilla-core'],
    mods: ['modmenu', 'sodium'],
    expansion: ['expansion-kaomoji'],
    unfinished: []
  },
  new_lang: false,
  random: false
};
```

### Config 数据获取

前端可以通过 `/config.json` 端点获取完整配置：

```javascript
const config = await fetch('/config.json').then(r => r.json());

// 获取所有可用的版本
const versions = config.platforms
  .find(p => p.id === 'java')
  .categories.find(c => c.id === 'version')
  .items.map(item => ({
    id: item.id,
    label: item.label['zh-CN'],
    defaultSelected: item.defaultSelected
  }));

// 获取某个类别的所有模块
const getModules = (categoryId) => {
  return config.platforms
    .find(p => p.id === 'java')
    .categories.find(c => c.id === categoryId)
    .items.map(item => ({
      id: item.id,
      label: item.label['zh-CN'],
      files: item.files,
      children: item.children?.map(child => ({
        id: child.id,
        label: child.label['zh-CN'],
        files: child.files
      }))
    }));
};
```

---

## 常见问题

### Q1: 如何知道哪些模块有差分支持？

检查模块配置中的 `differ` 字段：

```javascript
const hasDiffer = (moduleId) => {
  const module = findModule(moduleId);
  return module && module.differ && Object.keys(module.differ).length > 0;
};
```

### Q2: 如何处理版本限制？

检查模块的 `version_only` 字段：

```javascript
const isModuleAvailable = (moduleId, version) => {
  const module = findModule(moduleId);
  if (!module.version_only) return true;
  return module.version_only.includes(version);
};
```

### Q3: 多个模块合并到同一个文件怎么办？

系统会自动合并相同 `path` 的 JSON 文件：

```javascript
// 以下两个模块都会合并到 assets/minecraft/lang/zh_cn.json
{
  "vanilla": ["vanilla-core", "vanilla-enchantments"]
}
// 结果：两个 JSON 文件的内容会被合并
```

### Q4: 如何获取构建进度？

当前 API 是同步的，响应中包含完整的工作区信息：

```javascript
const response = await fetch('/build', {...});
const data = await response.json();

// 从 workspace 中获取详细信息
console.log(`翻译条目数：${data.workspace.zhCnEntries}`);
console.log(`贡献模块：${data.workspace.zhCnModules.join(', ')}`);
```

### Q5: 旧格式还能用吗？

**不能**。旧格式已被完全移除，请使用新的 `categories` 格式。

---

## 总结

### 关键变化

1. ✅ **请求格式**：`original`/`mod`/`unfinished` → `categories.{vanilla,mods,expansion,unfinished}`
2. ✅ **Config 结构**：所有模块添加 `files` 字段
3. ✅ **差分系统**：支持 `merge`/`override`/`delete`/`add` 四种类型
4. ✅ **文件合并**：相同 `path` 的 JSON 文件自动合并

### 迁移检查清单

- [ ] 更新 POST 请求体格式
- [ ] 更新 Config 数据解析逻辑
- [ ] 处理新的响应结构
- [ ] 测试不同版本的差分功能
- [ ] 验证文件合并逻辑

---

**最后更新**: 2026 年 3 月 27 日
**API 版本**: v2.0.0
