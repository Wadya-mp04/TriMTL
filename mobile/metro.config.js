// Metro config. The rules engine in shared/ is a byte-identical copy of the server's (checked by hash),
// and the server's Node ESM imports say "./types.js" for a types.ts file. Metro doesn't map that, so
// retry relative ".js" imports without the extension before giving up.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // a real .js file: fall through to the default resolution
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
