# local-run-gitlab-ci

Run `.gitlab-ci.yml` locally. `local-run-ci init` scaffolds a ready-to-run `local-build/` directory.

---

## Quick Start / 快速开始

```bash
# Generate local-build in current project
npx local-run-ci init

# Overwrite existing local-build (if any)
local-run-ci init --force

# Run locally (same as: node ./local-build)
local-run-ci --list
local-run-ci --only-stages test
local-run-ci run --dry-run
```

> 模板位于仓库内 `resources/local-build/`，`init` 会复制到当前工作目录。

---

## Features / 功能

- One-shot run via `node ./local-build` (entry: `local-build/index.js`).
- Parse `.gitlab-ci.yml` and execute `script` in `stages` order.
- Colorful stdout/stderr logging.
- Skip controls: `--skip`, `--skip-re`, and `local-build/.ci-ignore`.
- `init` 默认生成 `local-build/.ci-ignore`（可按需编辑）。
- Plugin hooks via `local-build/plugins/`（详见 `local-build/plugins/README.md`）。
- 依赖：`shelljs@^0.8.5`、`yaml@^2.3.4`。`local-run-ci init` 默认自动安装；如使用 `--skip-install` 请自行安装。

---

## Commands / 命令

- `local-run-ci init [-f|--force] [--skip-install]`  
  生成/覆盖 `local-build/`，可选择跳过依赖安装。
- `local-run-ci run ...args`  
  显式运行 `local-build`，参数透传给 runner。
- `local-run-ci ...args`  
  无子命令时透传参数给 `local-build` 运行器，例如 `--list`、`--dry-run`、`--only-stages`、`--only-jobs`、`--skip`、`--skip-re`。

---

## Plugins / 插件

在 `local-build/plugins/` 增加插件并在 `local-build/index.js` 启用。可用 Hook 详见 `local-build/plugins/README.md`。

内置示例：
- `pre-env.js`：设置 `CI` 环境变量。
- `post-summary.js`：统计运行/跳过/失败命令并总结输出。

---

## Example / 示例

`example/` 提供完整示例：

```bash
cd example
node ./local-build --list        # 查看执行/跳过的命令
node ./local-build --dry-run     # 仅打印不执行
```
