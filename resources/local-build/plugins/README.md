# Plugins 说明

在 `local-build/plugins/` 下放置插件文件，并在 `local-build/index.js` 中引入启用。每个插件需导出对象：

```js
module.exports = {
  name: 'your-plugin-name',
  hooks: {
    beforeAll(ctx) { /* ... */ },
    // 其他 hook...
  },
};
```

## 可用 Hook

- `beforeAll(ctx)`：所有流程开始前调用。
- `afterAll(ctx)`：全部 stage 完成后调用。
- `beforeStage(ctx)` / `afterStage(ctx)`：每个 stage 前/后。
- `beforeJob(ctx)` / `afterJob(ctx)`：每个 job 前/后。
- `beforeCmd(ctx)` / `afterCmd(ctx)`：每条命令执行前/后。
- `onSkip(ctx)`：命令被跳过时触发（skip 参数或 ignore 规则）。
- `onError(ctx)`：命令执行失败时触发。

## ctx 内容

通用字段：

- `plugin`：当前插件名。
- `Log`：日志工具（带彩色输出）。
- `args`：CLI 解析结果。
- `ciObj`：解析后的 `.gitlab-ci.yml` 对象。
- `shell`：`shelljs` 实例。
- `ignoreRules`：忽略命令的正则数组。

`ctx` 在各个 Hook 间共享，可在 `beforeAll` 等阶段挂载自定义状态（如统计信息）。

在特定 Hook 中会额外包含：

- `stage`：当前 stage 名称。
- `jobName` / `job`：当前 job 名称与内容。
- `cmd`：当前命令字符串。
- `result`：命令执行结果 `{ code, dry }`。

`beforeCmd` 支持返回字符串作为新命令（返回空值则不改动）。

示例插件请参考同目录下的 `pre-env.js`、`post-summary.js`。
