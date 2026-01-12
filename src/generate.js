'use strict';

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const { spawnSync } = require('child_process');

const TEMPLATE_DIR = path.join(__dirname, '..', 'resources', 'local-build');
const DEST_DIR = path.join(process.cwd(), 'local-build');

// 需要确保存在的依赖（供 local-build 使用）
const Dependencies = {
  shelljs: '^0.8.5',
  yaml: '^1.10.2',
};

function hasPkg(cwd, name) {
  try {
    require.resolve(name, { paths: [cwd] });
    return true;
  } catch (e) {
    return false;
  }
}

function ensurePackageJson(cwd) {
  const pj = path.join(cwd, 'package.json');
  if (fs.existsSync(pj)) return;
  console.log(chalk.yellow('未找到 package.json，正在运行 npm init -y'));
  const r = spawnSync('npm', ['init', '-y'], { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(chalk.red('npm init 失败'));
    process.exit(r.status || 1);
  }
}

function ensureLocalBuildScript(cwd) {
  const pj = path.join(cwd, 'package.json');
  if (!fs.existsSync(pj)) return;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(pj, 'utf8'));
  } catch (e) {
    console.error(chalk.red('读取 package.json 失败，无法写入 scripts'));
    process.exit(1);
  }

  const scripts = data.scripts || {};
  if (scripts['local:build']) return;

  scripts['local:build'] = 'node ./local-build';
  data.scripts = scripts;

  fs.writeFileSync(pj, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(chalk.green('已写入 scripts: local:build'));
}

// 给当前项目安装依赖
const installDependencies = function (cwd = process.cwd(), extraDeps = {}) {
  const mergedDeps = { ...Dependencies, ...extraDeps };
  const missing = Object.keys(mergedDeps).filter((name) => !hasPkg(cwd, name));
  if (missing.length === 0) {
    console.log(chalk.green('依赖已就绪，无需安装'));
    return;
  }

  ensurePackageJson(cwd);
  const toInstall = missing.map((name) => `${name}@${mergedDeps[name]}`);

  console.log(chalk.cyan(`安装缺失依赖: ${toInstall.join(', ')}`));
  const r = spawnSync('npm', ['install', '--no-fund', '--no-audit', ...toInstall], { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(chalk.red('依赖安装失败'));
    process.exit(r.status || 1);
  }
  console.log(chalk.green('依赖安装完成'));
};

// 复制文件到项目根目录
const generate = function ({ force = false, skipInstall = false } = {}) {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(chalk.red('未找到模板目录 resources/local-build'));
    process.exit(1);
  }

  if (fs.existsSync(DEST_DIR) && !force) {
    console.error(chalk.red('检测到已有 local-build/，如需覆盖请使用 --force'));
    process.exit(1);
  }

  if (fs.existsSync(DEST_DIR) && force) {
    fse.removeSync(DEST_DIR);
  }

  fse.copySync(TEMPLATE_DIR, DEST_DIR, { overwrite: true, recursive: true, errorOnExist: false });

  // 确保入口文件可执行
  ['index.js', 'run-gitlab-ci.js'].forEach((file) => {
    const p = path.join(DEST_DIR, file);
    if (fs.existsSync(p)) fs.chmodSync(p, 0o755);
  });

  console.log(chalk.green('local-build 目录生成完成'));
  ensureLocalBuildScript(process.cwd());

  console.log(
    chalk.cyan(
      [
        '接下来你可以：',
        '  node ./local-build --list',
        '  node ./local-build --dry-run',
        '  node ./local-build --only-stages test',
        '  npm run local:build',
      ].join('\n')
    )
  );

  if (!skipInstall) {
    installDependencies(process.cwd());
  } else {
    console.log(chalk.yellow('已跳过依赖安装，请手动安装 shelljs/yaml'));
  }
};

module.exports = {
  generate,
  installDependencies,
};
