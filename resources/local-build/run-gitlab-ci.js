#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
// eslint-disable-next-line global-require
const shell = require('shelljs');
// eslint-disable-next-line global-require
const yamlLib = require('yaml');

// =====================
// Log（stdout/stderr + ANSI）
// =====================
const Log = {
  color: {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  },
  c(clr, msg) {
    return `${clr}${msg}${Log.color.reset}`;
  },
  out(msg = '') {
    process.stdout.write(msg + '\n');
  },
  err(msg = '') {
    process.stderr.write(msg + '\n');
  },
  banner(title) {
    Log.out(Log.c(Log.color.blue, '=============================='));
    Log.out(Log.c(Log.color.blue, title));
    Log.out(Log.c(Log.color.blue, '=============================='));
  },
};

// =====================
// CLI
// =====================
const CLI = {
  parse(argv) {
    const args = {
      onlyStages: null,
      onlyJobs: null,
      skip: [],
      skipRe: [],
      list: false,
      dryRun: false,
      file: '.gitlab-ci.yml',
      ignoreFile: path.join('local-build', '.ci-ignore'),
    };

    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--only-stages') args.onlyStages = new Set(String(argv[++i] || '').split(',').filter(Boolean));
      else if (a === '--only-jobs') args.onlyJobs = new Set(String(argv[++i] || '').split(',').filter(Boolean));
      else if (a === '--skip') args.skip.push(String(argv[++i] || ''));
      else if (a === '--skip-re') args.skipRe.push(new RegExp(String(argv[++i] || '')));
      else if (a === '--list') args.list = true;
      else if (a === '--dry-run') args.dryRun = true;
      else if (a === '--file') args.file = String(argv[++i] || '.gitlab-ci.yml');
      else if (a === '--ignore-file') args.ignoreFile = String(argv[++i] || path.join('local-build', '.ci-ignore'));
      else if (a === '--help' || a === '-h') args.help = true;
    }

    // 默认跳过安装类命令（本地通常不需要重新装）
    if (args.skipRe.length === 0 && args.skip.length === 0) {
      args.skipRe.push(/^npm (i|ci)(\s|$)/);
      args.skipRe.push(/^yarn( install)?(\s|$)/);
      args.skipRe.push(/^pnpm i(\s|$)/);
    }

    return args;
  },

  help() {
    Log.out(
      [
        Log.c(Log.color.cyan, 'local-build') + ' - 本地按 stages 执行 .gitlab-ci.yml 的 script（shelljs）',
        '',
        '用法：',
        '  node ./local-build [options]',
        '',
        '选项：',
        '  --file <path>              指定 yml 文件（默认 .gitlab-ci.yml）',
        '  --ignore-file <path>       指定忽略规则文件（默认 local-build/.ci-ignore）',
        '  --only-stages a,b,c        只执行指定 stages',
        '  --only-jobs j1,j2          只执行指定 jobs',
        '  --skip "<substring>"       跳过包含子串的命令（可重复）',
        '  --skip-re "<regex>"        跳过匹配正则的命令（可重复，JS RegExp 源字符串，不含 / /）',
        '  --list                     只列出将执行/跳过的命令，不执行',
        '  --dry-run                  打印但不执行',
        '  -h, --help                 帮助',
        '',
        'local-build/.ci-ignore：一行一个正则（支持 # 注释、空行）',
      ].join('\n')
    );
  },
};

// =====================
// Ignore：加载 local-build/.ci-ignore
// =====================
const Ignore = {
  load(ignoreFilePath) {
    const abs = path.isAbsolute(ignoreFilePath) ? ignoreFilePath : path.join(process.cwd(), ignoreFilePath);
    if (!fs.existsSync(abs)) return [];

    const rules = [];
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      try {
        rules.push(new RegExp(line));
      } catch (e) {
        Log.err(Log.c(Log.color.red, `❌ 忽略规则正则无效：${line}`));
        Log.err(String(e));
        process.exit(1);
      }
    }
    if (rules.length > 0) {
      Log.out(Log.c(Log.color.cyan, `ℹ 已加载忽略规则：${ignoreFilePath}（${rules.length} 条）`));
    }
    return rules;
  },

  match(cmd, rules) {
    for (const re of rules) if (re.test(cmd)) return true;
    return false;
  },
};

// =====================
// Plugins：hook 执行器
// =====================
const Plugins = {
  normalize(plugins) {
    const list = Array.isArray(plugins) ? plugins : [];
    return list
      .filter(Boolean)
      .map((p) => ({
        name: p.name || 'anonymous-plugin',
        hooks: p.hooks || {},
      }));
  },

  async call(allPlugins, hookName, ctx) {
    for (const p of allPlugins) {
      const fn = p.hooks && p.hooks[hookName];
      if (typeof fn !== 'function') continue;

      try {
        const prevPlugin = ctx.plugin;
        ctx.plugin = p.name;
        await fn(ctx);
        if (prevPlugin === undefined) delete ctx.plugin;
        else ctx.plugin = prevPlugin;
      } catch (e) {
        Log.err(Log.c(Log.color.red, `❌ 插件失败 [${p.name}] hook=${hookName}`));
        Log.err(String(e && e.stack ? e.stack : e));
        process.exit(1);
      }
    }
  },
};

// =====================
// CI runner core
// =====================
const CI = {
  RESERVED_KEYS: new Set([
    'stages',
    'variables',
    'image',
    'services',
    'before_script',
    'after_script',
    'default',
    'include',
    'workflow',
  ]),

  loadYaml(file, yamlLib) {
    if (!fs.existsSync(file)) {
      Log.err(Log.c(Log.color.red, `❌ 未找到 ${file}`));
      process.exit(1);
    }
    try {
      return yamlLib.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      Log.err(Log.c(Log.color.red, '❌ 解析 yml 失败'));
      Log.err(String(e));
      process.exit(1);
    }
  },

  getJobsInOrder(ciObj) {
    const jobs = [];
    for (const [jobName, job] of Object.entries(ciObj)) {
      if (CI.RESERVED_KEYS.has(jobName)) continue;
      if (!job || !job.script) continue;
      jobs.push([jobName, job]);
    }
    return jobs;
  },

  shouldSkipCmd(cmd, args, ignoreRules) {
    if (!cmd || typeof cmd !== 'string') return false;

    if (ignoreRules.length > 0 && Ignore.match(cmd, ignoreRules)) return true;

    for (const s of args.skip) if (s && cmd.includes(s)) return true;
    for (const re of args.skipRe) if (re && re.test(cmd)) return true;

    return false;
  },

  runCommand(shell, cmd, args) {
    Log.out(Log.c(Log.color.dim, '$ ') + cmd);

    if (args.list || args.dryRun) return { code: 0, dry: true };

    const res = shell.exec(cmd, { silent: false });
    return { code: res.code || 0 };
  },
};

// =====================
// Exported runner entry
// =====================
async function run(options = {}) {
  const args = CLI.parse(process.argv.slice(2));
  if (args.help) {
    CLI.help();
    process.exit(0);
  }

  // index.js 传入的默认值优先
  if (options.ciFile) args.file = options.ciFile;
  if (options.ignoreFile) args.ignoreFile = options.ignoreFile;

  const allPlugins = Plugins.normalize(options.plugins);

  // ignore
  const ignoreRules = Ignore.load(args.ignoreFile);

  // load CI
  const ciObj = CI.loadYaml(args.file, yamlLib);
  if (!ciObj || !Array.isArray(ciObj.stages)) {
    Log.err(Log.c(Log.color.red, '❌ yml 未定义 stages（或不是数组）'));
    process.exit(1);
  }

  const ctxBase = {
    Log,
    args,
    ciObj,
    shell,
    ignoreRules,
  };

  await Plugins.call(allPlugins, 'beforeAll', ctxBase);

  Log.out(Log.c(Log.color.green, '✅ 成功加载 ') + Log.c(Log.color.cyan, args.file));

  const jobsAll = CI.getJobsInOrder(ciObj);

  // stage -> jobs（按 yml job 出现顺序）
  const jobsByStage = new Map();
  for (const [jobName, job] of jobsAll) {
    const stage = job.stage || 'test';
    if (!jobsByStage.has(stage)) jobsByStage.set(stage, []);
    jobsByStage.get(stage).push([jobName, job]);
  }

  for (const stage of ciObj.stages) {
    if (args.onlyStages && !args.onlyStages.has(stage)) {
      Log.out(Log.c(Log.color.dim, `\n⏭ 跳过 stage: ${stage}（不在 --only-stages）`));
      continue;
    }

    Log.out('');
    Log.banner(`🚩 Stage: ${stage}`);
    await Plugins.call(allPlugins, 'beforeStage', { ...ctxBase, stage });

    const jobs = jobsByStage.get(stage) || [];
    if (jobs.length === 0) {
      Log.out(Log.c(Log.color.dim, `（stage ${stage} 下没有 job）`));
      await Plugins.call(allPlugins, 'afterStage', { ...ctxBase, stage });
      continue;
    }

    for (const [jobName, job] of jobs) {
      if (args.onlyJobs && !args.onlyJobs.has(jobName)) {
        Log.out(Log.c(Log.color.dim, `\n⏭ 跳过 job: ${jobName}（不在 --only-jobs）`));
        continue;
      }

      Log.out('\n' + Log.c(Log.color.magenta, `▶ Job: ${jobName}`));
      await Plugins.call(allPlugins, 'beforeJob', { ...ctxBase, stage, jobName, job });

      const scripts = (Array.isArray(job.script) ? job.script : [job.script]).filter(Boolean);

      for (const cmd of scripts) {
        if (CI.shouldSkipCmd(cmd, args, ignoreRules)) {
          Log.out(Log.c(Log.color.yellow, '⏭ SKIP ') + Log.c(Log.color.dim, cmd));
          await Plugins.call(allPlugins, 'onSkip', { ...ctxBase, stage, jobName, job, cmd });
          continue;
        }

        await Plugins.call(allPlugins, 'beforeCmd', { ...ctxBase, stage, jobName, job, cmd });

        const r = CI.runCommand(shell, cmd, args);

        await Plugins.call(allPlugins, 'afterCmd', { ...ctxBase, stage, jobName, job, cmd, result: r });

        if (r.code !== 0) {
          await Plugins.call(allPlugins, 'onError', { ...ctxBase, stage, jobName, job, cmd, result: r });
          Log.err(Log.c(Log.color.red, `\n❌ 执行失败: ${stage}/${jobName}`));
          Log.err(Log.c(Log.color.red, `命令: ${cmd}`));
          process.exit(r.code || 1);
        }
      }

      await Plugins.call(allPlugins, 'afterJob', { ...ctxBase, stage, jobName, job });
      Log.out(Log.c(Log.color.green, `✅ Job ${jobName} 完成`));
    }

    await Plugins.call(allPlugins, 'afterStage', { ...ctxBase, stage });
  }

  await Plugins.call(allPlugins, 'afterAll', ctxBase);

  if (args.list) Log.out('\n' + Log.c(Log.color.cyan, '（--list 模式：仅列出命令，不执行）'));
  else if (args.dryRun) Log.out('\n' + Log.c(Log.color.cyan, '（--dry-run 模式：打印但不执行）'));
  else Log.out('\n' + Log.c(Log.color.green, '🎉 所有 stages 执行完成'));
}

module.exports = run;

// 允许直接 node local-build/run-gitlab-ci.js 运行（可选）
if (require.main === module) {
  run({ plugins: [] }).catch((e) => {
    Log.err(Log.c(Log.color.red, String(e && e.stack ? e.stack : e)));
    process.exit(1);
  });
}
