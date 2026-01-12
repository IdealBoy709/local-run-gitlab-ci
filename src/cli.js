const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Command } = require('commander');
const pkg = require('../package.json');

function resolveLocalBuildEntry(cwd) {
  const dir = path.join(cwd, 'local-build');
  const entry = path.join(dir, 'index.js');
  if (fs.existsSync(entry)) return entry;
  if (fs.existsSync(dir)) return dir;
  return null;
}

function runLocalBuild(rawArgs = []) {
  const entry = resolveLocalBuildEntry(process.cwd());
  if (!entry) {
    // eslint-disable-next-line no-console
    console.error('未找到 local-build/，请先执行：local-run-ci init');
    process.exit(1);
  }

  const r = spawnSync(process.execPath, [entry, ...rawArgs], { stdio: 'inherit' });
  if (r.error) {
    // eslint-disable-next-line no-console
    console.error(`执行失败：${r.error.message || r.error}`);
    process.exit(1);
  }
  if (r.signal) process.exit(1);
  process.exit(r.status || 0);
}

async function run(argv = process.argv) {
  const program = new Command();
  let handled = false;
  const firstArg = argv[2];
  const reservedFlags = new Set(['-h', '--help', '-V', '--version']);

  program
    .name('local-run-ci')
    .description('Run GitLab CI locally')
    .version(pkg.version || '0.0.0', '-V, --version', '显示版本号')
    .helpOption('-h, --help', '显示帮助信息');

  program.allowUnknownOption(true);

  program
    .command('init')
    .description('在当前项目生成 local-build 目录')
    .option('-f, --force', '覆盖已存在的 local-build 目录')
    .option('--skip-install', '跳过依赖安装（shelljs、yaml 等自行安装）', false)
    .action((opts) => {
      handled = true;
      const { generate } = require('./generate');
      generate({ force: opts.force, skipInstall: opts.skipInstall });
    });

  program
    .command('run')
    .description('运行 local-build 执行 .gitlab-ci.yml')
    .allowUnknownOption(true)
    .action(() => {
      handled = true;
      const rawArgs = argv.slice(2);
      if (rawArgs[0] === 'run') rawArgs.shift();
      runLocalBuild(rawArgs);
    });

  if (firstArg && firstArg.startsWith('-') && !reservedFlags.has(firstArg)) {
    runLocalBuild(argv.slice(2));
    return;
  }

  program.parse(argv);

  if (!handled && argv.length > 2) {
    runLocalBuild(argv.slice(2));
  }

  if (argv.length <= 2) {
    program.outputHelp();
  }
}

module.exports = {
  run,
};
