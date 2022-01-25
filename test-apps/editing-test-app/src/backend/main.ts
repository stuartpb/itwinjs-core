/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { IModelHostConfiguration } from "@itwin/core-backend";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { IModelReadRpcInterface, IModelTileRpcInterface } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { Presentation, PresentationManagerMode } from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";

const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  PresentationRpcInterface,
];

async function initializeElectron() {
  const iModelHost = new IModelHostConfiguration();
  iModelHost.hubAccess = new BackendIModelsAccess();

  await ElectronHost.startup({
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "build"),
      developmentServer: process.env.NODE_ENV === "development",
      rpcInterfaces,
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

function initializePresentation() {
  Presentation.initialize({
    mode: PresentationManagerMode.ReadWrite,
    updatesPollInterval: 20,
  });
}

(async function () {
  initializeLogging();
  initializePresentation();
  await initializeElectron();
})();
