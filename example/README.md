# example：local-run-ci demo

该目录演示如何在一个项目里使用 `local-run-ci`：

```bash
cd example
# 已生成好的 local-build，可直接跑
node ./local-build --list
node ./local-build --only-stages test

# 或使用仓库根目录的 CLI 入口
node ../bin/local-run-ci.js --list
```

`.gitlab-ci.yml` 中的 `npm ci` 默认会被 `--skip-re` 规则跳过，其余命令会按 stages 顺序执行。
