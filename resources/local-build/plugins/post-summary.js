'use strict';

module.exports = {
  name: 'post-summary',
  hooks: {
    beforeAll(ctx) {
      ctx._stats = { ran: 0, skipped: 0, failed: 0 };
    },
    onSkip(ctx) {
      ctx._stats.skipped += 1;
    },
    afterCmd(ctx) {
      // list / dry-run 不计入 ran
      if (!ctx.args.list && !ctx.args.dryRun) ctx._stats.ran += 1;
    },
    onError(ctx) {
      ctx._stats.failed += 1;
    },
    afterAll(ctx) {
      const s = ctx._stats || { ran: 0, skipped: 0, failed: 0 };
      ctx.Log.out(ctx.Log.c(ctx.Log.color.cyan, `ℹ [post-summary] ran=${s.ran}, skipped=${s.skipped}, failed=${s.failed}`));
    },
  },
};
