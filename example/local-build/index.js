#!/usr/bin/env node
'use strict';

const path = require('path');

// 确保从项目根目录执行（local-build 的上一级）
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

// 在这里配置启用哪些插件
const plugins = [
  require('./plugins/pre-env'),
  require('./plugins/post-summary'),
  require('./plugins/replace-build'),
];

// 运行 runner（注入插件 + 固定 ignore 文件路径）
const run = require('./run-gitlab-ci');

run({
  ciFile: '.gitlab-ci.yml',
  ignoreFile: path.join('local-build', '.ci-ignore'),
  plugins,
}).catch((e) => {
  // run 内部一般已经处理并 exit，这里兜底
  // eslint-disable-next-line no-console
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
