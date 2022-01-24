/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { IModelHostConfiguration } from "@itwin/core-backend";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";

async function initializeElectron() {
  const iModelHost = new IModelHostConfiguration();
  iModelHost.hubAccess = new BackendIModelsAccess();

  await ElectronHost.startup({
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "build"),
      developmentServer: process.env.NODE_ENV === "development",
      rpcInterfaces: [],
    },
    iModelHost,
  });

  await ElectronHost.openMainWindow({
    show: true,
    title: "Editing Test App",
  });
}

function initializeLogging() {
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Error);
}

(async function () {
  initializeLogging();
  await initializeElectron();
})();
