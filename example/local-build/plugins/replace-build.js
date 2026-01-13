'use strict';

module.exports = {
  name: 'replace-build',
  hooks: {
    beforeCmd(ctx) {
      if (ctx.cmd === 'npm build prod') return 'npm build test';
      return undefined;
    },
  },
};
