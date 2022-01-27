/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as dotenv from "dotenv";
import * as expand from "dotenv-expand";
import * as fs from "fs";
import * as path from "path";
import { IModelHostConfiguration } from "@itwin/core-backend";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { IModelReadRpcInterface, IModelTileRpcInterface } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { EditCommandAdmin } from "@itwin/editor-backend";
import * as editorCommands from "@itwin/editor-backend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { Presentation, PresentationManagerMode } from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";

import { EditingAppIpcHandler } from "./EditingAppIpcHandler";

const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  PresentationRpcInterface,
];

const ipcHandlers = [
  EditingAppIpcHandler,
];

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.config();
    expand(envConfig);
  }
}

async function initializeElectron() {
  const authorizationClient = await ElectronMainAuthorization.create({
    clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
    redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
    scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
  });
  const iModelHost = new IModelHostConfiguration();
  iModelHost.hubAccess = new BackendIModelsAccess(new IModelsClient({
    api: {
      baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`
    },
  }));
  iModelHost.authorizationClient = authorizationClient;

  await ElectronHost.startup({
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "..", "build"),
      developmentServer: process.env.NODE_ENV === "development",
      rpcInterfaces,
      ipcHandlers,
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

function initializeEditCommands() {
  EditCommandAdmin.registerModule(editorCommands);
}

(async function () {
  loadEnv();
  initializeLogging();
  initializePresentation();
  await initializeElectron();
  initializeEditCommands();
})();
