/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const glob = require("glob");
const paths = require("../../config/paths");

class BanImportsPlugin {
  constructor(bundleName, bannedName, bannedDir, bannedRegex) {
    this.bundleName = bundleName;
    this.bannedName = bannedName;
    this.bannedDir = bannedDir;
    this.bannedRegex = bannedRegex;
  }

  apply(resolver) {
    resolver.hooks.file.tapAsync(this.constructor.name, (request, contextResolver, callback) => {
      if (!request.context.issuer || !request.__innerRequest_request)
        return callback();

      if (this.bannedRegex.test(request.path) || request.path.startsWith(this.bannedDir)) {
        const actualRequest = request.__innerRequest_request.replace(/^\.[\/\\]/, ""); // not sure why __innerRequest_request always starts with ./
        const errorMessage = chalk.red("You are importing ") + chalk.yellow(actualRequest) + chalk.red(".  ")
        + chalk.red.bold(this.bannedName) + chalk.red(" code should not be included in the ") 
        + chalk.red.bold(this.bundleName) + chalk.red(" bundle.");
        return callback(new Error(errorMessage), request);
      }
      
      return callback();
    });
  }
}

function pathToPackageName(p) {
  const parts = p.replace(/^.*node_modules[\\\/]/, "").split(/[\\\/]/);
  return (parts[0].startsWith("@")) ? parts[0] + "/" + parts[1] : parts[0];
}

class CopyNativeAddonsPlugin {
  constructor(options) {}

  apply(compiler) {
    compiler.hooks.environment.tap("CopyNativeAddonsPlugin", () => {
      const packageLock = require(paths.appPackageLockJson);
      const dir = path.resolve(paths.appNodeModules, "**/*.node");
      const matches = glob.sync(dir)
      
      // Also copy any modules excluded from the bundle via the "externals" webpack config option
      const externals = compiler.options.externals;
      if (typeof(externals) === "object") {
        if (Array.isArray(externals))
          matches.push(...externals.filter((ext) => typeof(ext) === "string"));
        else
          matches.push(...Object.keys(externals));
      }

      for (const match of matches) {
        const nativeDependency = pathToPackageName(match);

        if (packageLock.dependencies[nativeDependency] && !packageLock.dependencies[nativeDependency].dev)
          fs.copySync(path.resolve(paths.appNodeModules, nativeDependency), path.resolve(paths.appLib, "node_modules", nativeDependency), { dereference: true });
      }
    });
  }
}

class CopyAssetsPlugin {
  apply(compiler) {
    compiler.hooks.environment.tap("CopyAssetsPlugin", () => {
      if (fs.existsSync(paths.appAssets))
        fs.copySync(paths.appAssets, path.resolve(paths.appLib, "assets"));
    });
  }
}

// Merges the contents of the @bentley packages we depend on with the public folder.
function isDirectory (directoryName) {
  return (fs.statSync(path.resolve (this.bentleyDir, directoryName)).isDirectory());
}
class CopyBentleyDependencyPublicFoldersPlugin {

  apply(compiler) {
    compiler.hooks.environment.tap("CopyBentleyDependencyPublicFoldersPlugin", () => {
      const bentleyDir = paths.appBentleyNodeModules;
      // go through all node_modules/@bentley directories. If there's a "public" folder, copy its contents
      const subDirectoryNames = fs.readdirSync(bentleyDir).filter(isDirectory, { bentleyDir: paths.appBentleyNodeModules });
      for (const thisSubDir of subDirectoryNames) {
        const fullDirName = path.resolve (bentleyDir, thisSubDir );
        const testDir = path.resolve (fullDirName, "public");
        try {
          if (fs.statSync(testDir).isDirectory()) {
            fs.copySync (testDir, paths.appLibPublic, { dereference: true, preserveTimestamps: true, overwrite: false, errorOnExist: true});
    
          }
        } catch (_err) {
          // do nothing.
        }
      }
    });
  }
}

class BanFrontendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("BACKEND", "FRONTEND", paths.appSrcFrontend, /imodeljs-frontend/);
  }
}

class BanBackendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("FRONTEND", "BACKEND", paths.appSrcBackend, /imodeljs-backend/);
  }
}

module.exports = {
  BanFrontendImportsPlugin,
  BanBackendImportsPlugin,
  CopyNativeAddonsPlugin,
  CopyAssetsPlugin,
  CopyBentleyDependencyPublicFoldersPlugin
};
