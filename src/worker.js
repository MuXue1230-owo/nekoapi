const config = {
  "meta": {
    "qqGroupUrl": "https://qm.qq.com/q/AntBtGj33i",
    "pendingBuildNote": {
      "zh-CN": "这里先完成样式、交互和配置结构，真正的下载与打包逻辑后面再接 AI 或脚本。",
      "zh-Neko": "这里先把样式、交互和配置结构都搭好喵，真正的下载和打包逻辑后面再接 AI 或脚本喵。"
    }
  },
  "platforms": [
    {
      "id": "java",
      "icon": "java",
      "label": {
        "zh-CN": "Java",
        "zh-Neko": "Java 喵"
      },
      "categories": [
        {
          "id": "version",
          "icon": "version",
          "label": {
            "zh-CN": "游戏版本",
            "zh-Neko": "游戏版本喵"
          },
          "description": {
            "zh-CN": "用区间来选版本。1.12 及以下暂时只给整包，不展开其他模块。",
            "zh-Neko": "这里按区间来选版本喵。1.12 及以下暂时只给整包，不展开别的模块喵。"
          },
          "helper": {
            "zh-CN": "后续可按这里的区间生成 mcmeta 版本号。",
            "zh-Neko": "后面可以根据这里的区间生成 mcmeta 版本号喵。"
          },
          "selection": "single",
          "visibleInSimple": true,
          "items": [
            {
              "id": "java-1-21",
              "label": {
                "zh-CN": "1.21.11",
                "zh-Neko": "1.21.11 喵"
              },
              "summary": {
                "zh-CN": "1.21.11",
                "zh-Neko": "1.21.11 喵"
              },
              "description": {
                "zh-CN": "适合当前主线包体。后续可以继续细分到 1.21.1、1.21.4 等版本号格式。",
                "zh-Neko": "适合当前主线包体喵。后面还能再细分成 1.21.1、1.21.4 之类的版本号喵。"
              },
              "defaultSelected": true
            },
            {
              "id": "java-1-20",
              "label": {
                "zh-CN": "1.20.6",
                "zh-Neko": "1.20.6 喵"
              },
              "summary": {
                "zh-CN": "1.20.6",
                "zh-Neko": "1.20.6 喵"
              },
              "description": {
                "zh-CN": "保留给 1.20.x 系列使用，后续可在构建时分拆到精确版本。",
                "zh-Neko": "给 1.20.x 系列预留喵，后面构建时可以再拆到精确版本喵。"
              }
            },
            {
              "id": "java-1-19",
              "label": {
                "zh-CN": "1.19.4",
                "zh-Neko": "1.19.4 喵"
              },
              "summary": {
                "zh-CN": "1.19.4",
                "zh-Neko": "1.19.4 喵"
              },
              "description": {
                "zh-CN": "保留给 1.19.x 的兼容格式，占位用。",
                "zh-Neko": "给 1.19.x 的兼容格式占位喵。"
              }
            },
            {
              "id": "java-1-15-1-18",
              "label": {
                "zh-CN": "1.15 - 1.18",
                "zh-Neko": "1.15 - 1.18 喵"
              },
              "summary": {
                "zh-CN": "1.15-1.18",
                "zh-Neko": "1.15-1.18 喵"
              },
              "description": {
                "zh-CN": "给旧一点但仍计划支持的版本区间留入口。",
                "zh-Neko": "给稍旧但还想支持的版本区间留个入口喵。"
              }
            },
            {
              "id": "java-legacy",
              "label": {
                "zh-CN": "1.12 及以下",
                "zh-Neko": "1.12 及以下喵"
              },
              "summary": {
                "zh-CN": "1.12-",
                "zh-Neko": "1.12- 喵"
              },
              "description": {
                "zh-CN": "暂时只提供整包，选择后会先把其他栏位锁起来，后续再单独做低版本分支。",
                "zh-Neko": "现在只先给整包喵，选中后其他栏位会先锁起来，后面再做低版本分支喵。"
              },
              "legacyOnlyPackage": true
            }
          ]
        },
        {
          "id": "preset",
          "icon": "preset",
          "label": {
            "zh-CN": "预设",
            "zh-Neko": "预设喵"
          },
          "description": {
            "zh-CN": "先放几个占位预设，后面可以让预设直接批量点选模块。",
            "zh-Neko": "先放几个占位预设喵，后面可以让预设一键点好多模块喵。"
          },
          "selection": "single",
          "visibleInSimple": false,
          "disabledInLegacy": true,
          "items": [
            {
              "id": "preset-standard",
              "label": {
                "zh-CN": "标准包",
                "zh-Neko": "标准包喵"
              },
              "summary": {
                "zh-CN": "标准",
                "zh-Neko": "标准喵"
              },
              "description": {
                "zh-CN": "走主线内容，适合大多数使用场景。",
                "zh-Neko": "走主线内容喵，适合大多数使用场景喵。"
              },
              "presetSelection": {
                "categories": {
                  "version": {
                    "selected": ["java-1-21"]
                  },
                  "vanilla": {
                    "selected": ["vanilla-core", "vanilla-enchantments"],
                    "children": {
                      "vanilla-core": ["vanilla-core-nitrate"]
                    }
                  },
                  "mods": {
                    "selected": ["mods-base-pack"]
                  },
                  "expansion": {
                    "selected": ["expansion-kaomoji"]
                  },
                  "unfinished": {
                    "selected": []
                  }
                },
                "toggles": {
                  "add-language": false,
                  "shuffle-text": false
                }
              },
              "defaultSelected": true
            },
            {
              "id": "preset-lite",
              "label": {
                "zh-CN": "轻量包",
                "zh-Neko": "轻量包喵"
              },
              "summary": {
                "zh-CN": "轻量",
                "zh-Neko": "轻量喵"
              },
              "description": {
                "zh-CN": "少一点花活，偏保守。",
                "zh-Neko": "少一点花活喵，偏保守一点喵。"
              },
              "presetSelection": {
                "categories": {
                  "version": {
                    "selected": ["java-1-21"]
                  },
                  "vanilla": {
                    "selected": ["vanilla-core"],
                    "children": {
                      "vanilla-core": ["vanilla-core-nitrate"]
                    }
                  },
                  "mods": {
                    "selected": []
                  },
                  "expansion": {
                    "selected": []
                  },
                  "unfinished": {
                    "selected": []
                  }
                },
                "toggles": {
                  "add-language": false,
                  "shuffle-text": false
                }
              }
            },
            {
              "id": "preset-chaos",
              "label": {
                "zh-CN": "整活包",
                "zh-Neko": "整活包喵"
              },
              "summary": {
                "zh-CN": "整活",
                "zh-Neko": "整活喵"
              },
              "description": {
                "zh-CN": "更多替换内容和额外模块，适合先做效果展示。",
                "zh-Neko": "会带上更多替换内容和额外模块喵，适合先做效果展示喵。"
              },
              "presetSelection": {
                "categories": {
                  "version": {
                    "selected": ["java-1-21"]
                  },
                  "vanilla": {
                    "selected": ["vanilla-core", "vanilla-craftmine", "vanilla-enchantments"],
                    "children": {
                      "vanilla-core": [
                        "vanilla-core-nitrate",
                        "vanilla-core-names",
                        "vanilla-core-sounds"
                      ]
                    }
                  },
                  "mods": {
                    "selected": ["mods-base-pack", "mods-experimental"]
                  },
                  "expansion": {
                    "selected": [
                      "expansion-kaomoji",
                      "expansion-transform",
                      "expansion-cleanup",
                      "expansion-end-poem"
                    ],
                    "children": {
                      "expansion-transform": [
                        "expansion-transform-main",
                        "expansion-transform-a",
                        "expansion-transform-b",
                        "expansion-transform-c"
                      ],
                      "expansion-end-poem": [
                        "expansion-end-poem-credits",
                        "expansion-end-poem-lines",
                        "expansion-end-poem-bgm"
                      ]
                    }
                  },
                  "unfinished": {
                    "selected": ["unfinished-review", "unfinished-progress"]
                  }
                },
                "toggles": {
                  "add-language": true,
                  "shuffle-text": true
                }
              }
            }
          ]
        },
        {
          "id": "vanilla",
          "icon": "vanilla",
          "label": {
            "zh-CN": "原版内容",
            "zh-Neko": "原版内容喵"
          },
          "description": {
            "zh-CN": "原版向的替换和补充内容，支持带子选项的模块。",
            "zh-Neko": "原版向的替换和补充内容喵，支持带子选项的模块喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "disabledInLegacy": true,
          "items": [
            {
              "id": "vanilla-core",
              "label": {
                "zh-CN": "原版基础内容",
                "zh-Neko": "原版基础内容喵"
              },
              "summary": {
                "zh-CN": "原版基础",
                "zh-Neko": "原版基础喵"
              },
              "description": {
                "zh-CN": "把“硝酸拆出来那一堆”先挂到这里，后面继续细分到更多基础内容。",
                "zh-Neko": "先把“硝酸拆出来那一堆”都挂在这里喵，后面还能继续细分喵。"
              },
              "children": [
                {
                  "id": "vanilla-core-nitrate",
                  "label": {
                    "zh-CN": "硝酸拆分内容",
                    "zh-Neko": "硝酸拆分内容喵"
                  },
                  "description": {
                    "zh-CN": "占位子项，后续再按真实拆分结果替换。",
                    "zh-Neko": "这是占位子项喵，后面再按真实拆分结果替换喵。"
                  },
                  "defaultSelected": true
                },
                {
                  "id": "vanilla-core-names",
                  "label": {
                    "zh-CN": "命名与提示文本",
                    "zh-Neko": "命名和提示文本喵"
                  },
                  "description": {
                    "zh-CN": "保留字幕、提示和部分 UI 字样的替换。",
                    "zh-Neko": "保留字幕、提示和部分 UI 字样替换喵。"
                  }
                },
                {
                  "id": "vanilla-core-sounds",
                  "label": {
                    "zh-CN": "音效类文本",
                    "zh-Neko": "音效类文本喵"
                  },
                  "description": {
                    "zh-CN": "为音效、环境反馈等内容留入口。",
                    "zh-Neko": "给音效和环境反馈之类的内容留入口喵。"
                  }
                }
              ],
              "childSelection": "multiple",
              "defaultSelected": true
            },
            {
              "id": "vanilla-craftmine",
              "label": {
                "zh-CN": "25w14craftmine",
                "zh-Neko": "25w14craftmine 喵"
              },
              "summary": {
                "zh-CN": "craftmine",
                "zh-Neko": "craftmine 喵"
              },
              "description": {
                "zh-CN": "把 25w14craftmine 相关内容单独挂出来，方便按版本开关。",
                "zh-Neko": "把 25w14craftmine 相关内容单独挂出来喵，方便按版本开关喵。"
              }
            },
            {
              "id": "vanilla-enchantments",
              "label": {
                "zh-CN": "附魔名称",
                "zh-Neko": "附魔名称喵"
              },
              "summary": {
                "zh-CN": "附魔名",
                "zh-Neko": "附魔名喵"
              },
              "description": {
                "zh-CN": "独立控制附魔名称文本，后续可以再挂到对应版本判断上。",
                "zh-Neko": "可以单独控制附魔名称文本喵，后面还能再挂上版本判断喵。"
              }
            }
          ]
        },
        {
          "id": "mods",
          "icon": "mods",
          "label": {
            "zh-CN": "mod 内容",
            "zh-Neko": "mod 内容喵"
          },
          "description": {
            "zh-CN": "给基础 mod 包和其他玩意儿预留分类。",
            "zh-Neko": "给基础 mod 包和别的东西预留分类喵。"
          },
          "selection": "multiple",
          "visibleInSimple": false,
          "disabledInLegacy": true,
          "items": [
            {
              "id": "mods-base-pack",
              "label": {
                "zh-CN": "基础 mod 包",
                "zh-Neko": "基础 mod 包喵"
              },
              "summary": {
                "zh-CN": "基础 mod",
                "zh-Neko": "基础 mod 喵"
              },
              "description": {
                "zh-CN": "基础 mod 的统一入口，后续可以继续拆包。",
                "zh-Neko": "基础 mod 的统一入口喵，后面还能继续拆包喵。"
              },
              "defaultSelected": true
            },
            {
              "id": "mods-experimental",
              "label": {
                "zh-CN": "其他玩意儿",
                "zh-Neko": "其他玩意儿喵"
              },
              "summary": {
                "zh-CN": "其他",
                "zh-Neko": "其他喵"
              },
              "description": {
                "zh-CN": "先做占位，后续把其他 mod 相关模块补进来。",
                "zh-Neko": "先当占位喵，后面再把别的 mod 相关模块补进来喵。"
              }
            }
          ]
        },
        {
          "id": "expansion",
          "icon": "expansion",
          "label": {
            "zh-CN": "扩展内容",
            "zh-Neko": "扩展内容喵"
          },
          "description": {
            "zh-CN": "把颜文字包、皮肤替换和额外整活内容放到这里。",
            "zh-Neko": "把颜文字包、皮肤替换和额外整活内容都放到这里喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "disabledInLegacy": true,
          "items": [
            {
              "id": "expansion-kaomoji",
              "label": {
                "zh-CN": "颜文字包",
                "zh-Neko": "颜文字包喵"
              },
              "summary": {
                "zh-CN": "颜文字",
                "zh-Neko": "颜文字喵"
              },
              "description": {
                "zh-CN": "额外补充颜文字相关文本替换。",
                "zh-Neko": "额外补充颜文字相关的文本替换喵。"
              },
              "defaultSelected": true
            },
            {
              "id": "expansion-steve-skin",
              "label": {
                "zh-CN": "史蒂夫皮肤替换包",
                "zh-Neko": "史蒂夫皮肤替换包喵"
              },
              "summary": {
                "zh-CN": "皮肤替换",
                "zh-Neko": "皮肤替换喵"
              },
              "description": {
                "zh-CN": "先占位，等找到允许公开使用的皮肤后接入。",
                "zh-Neko": "先占个位喵，等找到允许公开用的皮肤之后再接进来喵。"
              }
            },
            {
              "id": "expansion-transform",
              "label": {
                "zh-CN": "给我变与三个变体",
                "zh-Neko": "给我变和三个变体喵"
              },
              "summary": {
                "zh-CN": "给我变",
                "zh-Neko": "给我变喵"
              },
              "description": {
                "zh-CN": "主模块加三个变体，后续可以直接扩展成多套皮肤文本。",
                "zh-Neko": "主模块加三个变体喵，后面可以继续扩成多套皮肤文本喵。"
              },
              "children": [
                {
                  "id": "expansion-transform-main",
                  "label": {
                    "zh-CN": "主版本",
                    "zh-Neko": "主版本喵"
                  },
                  "description": {
                    "zh-CN": "默认版本。",
                    "zh-Neko": "默认版本喵。"
                  },
                  "defaultSelected": true
                },
                {
                  "id": "expansion-transform-a",
                  "label": {
                    "zh-CN": "变体 A",
                    "zh-Neko": "变体 A 喵"
                  },
                  "description": {
                    "zh-CN": "占位变体 A。",
                    "zh-Neko": "占位变体 A 喵。"
                  }
                },
                {
                  "id": "expansion-transform-b",
                  "label": {
                    "zh-CN": "变体 B",
                    "zh-Neko": "变体 B 喵"
                  },
                  "description": {
                    "zh-CN": "占位变体 B。",
                    "zh-Neko": "占位变体 B 喵。"
                  }
                },
                {
                  "id": "expansion-transform-c",
                  "label": {
                    "zh-CN": "变体 C",
                    "zh-Neko": "变体 C 喵"
                  },
                  "description": {
                    "zh-CN": "占位变体 C。",
                    "zh-Neko": "占位变体 C 喵。"
                  }
                }
              ],
              "childSelection": "multiple"
            },
            {
              "id": "expansion-cleanup",
              "label": {
                "zh-CN": "删去黄段子的补丁",
                "zh-Neko": "删去黄段子的补丁喵"
              },
              "summary": {
                "zh-CN": "净化补丁",
                "zh-Neko": "净化补丁喵"
              },
              "description": {
                "zh-CN": "作为独立开关，方便随时关掉。",
                "zh-Neko": "单独做成一个开关喵，想关就能关喵。"
              }
            },
            {
              "id": "expansion-end-poem",
              "label": {
                "zh-CN": "终末之诗",
                "zh-Neko": "终末之诗喵"
              },
              "summary": {
                "zh-CN": "终末之诗",
                "zh-Neko": "终末之诗喵"
              },
              "description": {
                "zh-CN": "支持分别点选 credits、诗和 BGM。",
                "zh-Neko": "可以分别点 credits、诗和 BGM 喵。"
              },
              "children": [
                {
                  "id": "expansion-end-poem-credits",
                  "label": {
                    "zh-CN": "credits",
                    "zh-Neko": "credits 喵"
                  },
                  "description": {
                    "zh-CN": "结尾署名与演职信息。",
                    "zh-Neko": "结尾署名和演职信息喵。"
                  },
                  "defaultSelected": true
                },
                {
                  "id": "expansion-end-poem-lines",
                  "label": {
                    "zh-CN": "诗",
                    "zh-Neko": "诗喵"
                  },
                  "description": {
                    "zh-CN": "终末之诗正文。",
                    "zh-Neko": "终末之诗正文喵。"
                  },
                  "defaultSelected": true
                },
                {
                  "id": "expansion-end-poem-bgm",
                  "label": {
                    "zh-CN": "bgm",
                    "zh-Neko": "bgm 喵"
                  },
                  "description": {
                    "zh-CN": "关联的背景音乐与元数据占位。",
                    "zh-Neko": "关联的背景音乐和元数据占位喵。"
                  }
                }
              ],
              "childSelection": "multiple"
            }
          ]
        },
        {
          "id": "unfinished",
          "icon": "unfinished",
          "label": {
            "zh-CN": "未完成内容",
            "zh-Neko": "未完成内容喵"
          },
          "description": {
            "zh-CN": "把没检查、没做完和弃置的内容都独立标出来。",
            "zh-Neko": "把没检查、没做完和弃置的内容都单独标出来喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "disabledInLegacy": true,
          "items": [
            {
              "id": "unfinished-review",
              "label": {
                "zh-CN": "未检查",
                "zh-Neko": "未检查喵"
              },
              "summary": {
                "zh-CN": "未检查",
                "zh-Neko": "未检查喵"
              },
              "description": {
                "zh-CN": "内容已挂上，但还没逐项检查。",
                "zh-Neko": "内容已经挂上去了喵，但还没逐项检查喵。"
              }
            },
            {
              "id": "unfinished-progress",
              "label": {
                "zh-CN": "未完成",
                "zh-Neko": "未完成喵"
              },
              "summary": {
                "zh-CN": "未完成",
                "zh-Neko": "未完成喵"
              },
              "description": {
                "zh-CN": "内容方向明确，但还没做完。",
                "zh-Neko": "内容方向已经明确了喵，但还没有做完喵。"
              }
            },
            {
              "id": "unfinished-abandoned",
              "label": {
                "zh-CN": "弃置",
                "zh-Neko": "弃置喵"
              },
              "summary": {
                "zh-CN": "弃置",
                "zh-Neko": "弃置喵"
              },
              "description": {
                "zh-CN": "先标出来，后面再决定是否彻底删除。",
                "zh-Neko": "先标出来喵，后面再决定要不要彻底删掉喵。"
              }
            }
          ]
        }
      ],
      "toggles": [
        {
          "id": "add-language",
          "icon": "language",
          "label": {
            "zh-CN": "添加新语言",
            "zh-Neko": "添加新语言喵"
          },
          "description": {
            "zh-CN": "先做成开关占位，后面可接语言文件或额外资源。",
            "zh-Neko": "先做成开关占位喵，后面可以接语言文件或额外资源喵。"
          },
          "visibleInSimple": false
        },
        {
          "id": "shuffle-text",
          "icon": "shuffle",
          "label": {
            "zh-CN": "打乱所有文本",
            "zh-Neko": "打乱所有文本喵"
          },
          "description": {
            "zh-CN": "简单模式也保留这个开关。",
            "zh-Neko": "简单模式里也保留这个开关喵。"
          },
          "visibleInSimple": true
        }
      ]
    },
    {
      "id": "bedrock",
      "icon": "bedrock",
      "label": {
        "zh-CN": "基岩版",
        "zh-Neko": "基岩版喵"
      },
      "categories": [
        {
          "id": "version",
          "icon": "version",
          "label": {
            "zh-CN": "游戏版本",
            "zh-Neko": "游戏版本喵"
          },
          "description": {
            "zh-CN": "给基岩版预留版本区间。",
            "zh-Neko": "给基岩版预留版本区间喵。"
          },
          "selection": "single",
          "visibleInSimple": true,
          "items": [
            {
              "id": "bedrock-1-21",
              "label": {
                "zh-CN": "1.21.0",
                "zh-Neko": "1.21.0 喵"
              },
              "summary": {
                "zh-CN": "1.21.0",
                "zh-Neko": "1.21.0 喵"
              },
              "description": {
                "zh-CN": "基岩版当前主线占位。",
                "zh-Neko": "基岩版当前主线占位喵。"
              },
              "defaultSelected": true
            },
            {
              "id": "bedrock-preview",
              "label": {
                "zh-CN": "预览版",
                "zh-Neko": "预览版喵"
              },
              "summary": {
                "zh-CN": "预览",
                "zh-Neko": "预览喵"
              },
              "description": {
                "zh-CN": "给后续测试包预留。",
                "zh-Neko": "给后续测试包预留喵。"
              }
            }
          ]
        },
        {
          "id": "preset",
          "icon": "preset",
          "label": {
            "zh-CN": "预设",
            "zh-Neko": "预设喵"
          },
          "description": {
            "zh-CN": "先放一个基础预设占位。",
            "zh-Neko": "先放一个基础预设占位喵。"
          },
          "selection": "single",
          "visibleInSimple": false,
          "items": [
            {
              "id": "bedrock-standard",
              "label": {
                "zh-CN": "基础包",
                "zh-Neko": "基础包喵"
              },
              "summary": {
                "zh-CN": "基础",
                "zh-Neko": "基础喵"
              },
              "description": {
                "zh-CN": "仅作占位。",
                "zh-Neko": "只是占位喵。"
              },
              "presetSelection": {
                "categories": {
                  "version": {
                    "selected": ["bedrock-1-21"]
                  },
                  "vanilla": {
                    "selected": ["bedrock-ui"]
                  },
                  "mods": {
                    "selected": []
                  },
                  "expansion": {
                    "selected": []
                  },
                  "unfinished": {
                    "selected": []
                  }
                },
                "toggles": {
                  "add-language": false,
                  "shuffle-text": false
                }
              },
              "defaultSelected": true
            }
          ]
        },
        {
          "id": "vanilla",
          "icon": "vanilla",
          "label": {
            "zh-CN": "原版内容",
            "zh-Neko": "原版内容喵"
          },
          "description": {
            "zh-CN": "基岩版原版内容占位。",
            "zh-Neko": "基岩版原版内容占位喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "items": [
            {
              "id": "bedrock-ui",
              "label": {
                "zh-CN": "界面文本",
                "zh-Neko": "界面文本喵"
              },
              "summary": {
                "zh-CN": "界面",
                "zh-Neko": "界面喵"
              },
              "description": {
                "zh-CN": "给基岩版 UI 文本占位。",
                "zh-Neko": "给基岩版 UI 文本占位喵。"
              },
              "defaultSelected": true
            }
          ]
        },
        {
          "id": "mods",
          "icon": "mods",
          "label": {
            "zh-CN": "mod 内容",
            "zh-Neko": "mod 内容喵"
          },
          "description": {
            "zh-CN": "这里可接 Modrinth 或其他包体来源。",
            "zh-Neko": "这里后面可以接 Modrinth 或别的包体来源喵。"
          },
          "selection": "multiple",
          "visibleInSimple": false,
          "items": [
            {
              "id": "bedrock-addon",
              "label": {
                "zh-CN": "附加包占位",
                "zh-Neko": "附加包占位喵"
              },
              "summary": {
                "zh-CN": "附加包",
                "zh-Neko": "附加包喵"
              },
              "description": {
                "zh-CN": "后续按实际来源替换。",
                "zh-Neko": "后面再按实际来源替换喵。"
              }
            }
          ]
        },
        {
          "id": "expansion",
          "icon": "expansion",
          "label": {
            "zh-CN": "扩展内容",
            "zh-Neko": "扩展内容喵"
          },
          "description": {
            "zh-CN": "给额外皮肤、文本包等内容占位。",
            "zh-Neko": "给额外皮肤、文本包之类的内容占位喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "items": [
            {
              "id": "bedrock-extra-text",
              "label": {
                "zh-CN": "额外文本包",
                "zh-Neko": "额外文本包喵"
              },
              "summary": {
                "zh-CN": "额外文本",
                "zh-Neko": "额外文本喵"
              },
              "description": {
                "zh-CN": "后续补真实内容。",
                "zh-Neko": "后续再补真实内容喵。"
              }
            }
          ]
        },
        {
          "id": "unfinished",
          "icon": "unfinished",
          "label": {
            "zh-CN": "未完成内容",
            "zh-Neko": "未完成内容喵"
          },
          "description": {
            "zh-CN": "与 Java 版保持同样的状态分类。",
            "zh-Neko": "和 Java 版保持一样的状态分类喵。"
          },
          "selection": "multiple",
          "visibleInSimple": true,
          "items": [
            {
              "id": "bedrock-review",
              "label": {
                "zh-CN": "未检查",
                "zh-Neko": "未检查喵"
              },
              "summary": {
                "zh-CN": "未检查",
                "zh-Neko": "未检查喵"
              },
              "description": {
                "zh-CN": "占位状态。",
                "zh-Neko": "占位状态喵。"
              }
            },
            {
              "id": "bedrock-progress",
              "label": {
                "zh-CN": "未完成",
                "zh-Neko": "未完成喵"
              },
              "summary": {
                "zh-CN": "未完成",
                "zh-Neko": "未完成喵"
              },
              "description": {
                "zh-CN": "占位状态。",
                "zh-Neko": "占位状态喵。"
              }
            },
            {
              "id": "bedrock-abandoned",
              "label": {
                "zh-CN": "弃置",
                "zh-Neko": "弃置喵"
              },
              "summary": {
                "zh-CN": "弃置",
                "zh-Neko": "弃置喵"
              },
              "description": {
                "zh-CN": "占位状态。",
                "zh-Neko": "占位状态喵。"
              }
            }
          ]
        }
      ],
      "toggles": [
        {
          "id": "add-language",
          "icon": "language",
          "label": {
            "zh-CN": "添加新语言",
            "zh-Neko": "添加新语言喵"
          },
          "description": {
            "zh-CN": "占位开关。",
            "zh-Neko": "占位开关喵。"
          },
          "visibleInSimple": false
        },
        {
          "id": "shuffle-text",
          "icon": "shuffle",
          "label": {
            "zh-CN": "打乱所有文本",
            "zh-Neko": "打乱所有文本喵"
          },
          "description": {
            "zh-CN": "简单模式也显示。",
            "zh-Neko": "简单模式也显示喵。"
          },
          "visibleInSimple": true
        }
      ]
    }
  ]
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    return Response.json(config, {
      headers: corsHeaders,
    });
  },
};