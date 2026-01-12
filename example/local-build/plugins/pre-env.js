'use strict';

module.exports = {
  name: 'pre-env',
  hooks: {
    beforeAll(ctx) {
      // 标记本地执行环境（可按需增删）
      process.env.CI = process.env.CI || 'true';
      ctx.Log.out(ctx.Log.c(ctx.Log.color.cyan, `ℹ [pre-env] CI=${process.env.CI}`));
    },
  },
};
