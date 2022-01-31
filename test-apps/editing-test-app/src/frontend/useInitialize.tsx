/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { UiItemsManager } from "@itwin/appui-abstract";
import { AppNotificationManager, FrameworkUiAdmin, FrontstageManager, UiFramework } from "@itwin/appui-react";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp } from "@itwin/core-frontend";
import { EditTools } from "@itwin/editor-frontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { Presentation } from "@itwin/presentation-frontend";

import { HomeFrontstage } from "./frontstages/HomeFrontstage";
import { MainFrontstage } from "./frontstages/MainFrontstage";
import { ModelsFrontstage } from "./frontstages/ModelsFrontstage";
import { ProjectsFrontstage } from "./frontstages/ProjectsFrontstage";
import { ToolsProvider } from "./Tools";

const uiProviders = [
  new ToolsProvider(),
];

const frontstageProviders = [
  new HomeFrontstage(),
  new MainFrontstage(),
  new ModelsFrontstage(),
  new ProjectsFrontstage(),
];

function registerProviders() {
  frontstageProviders.forEach((provider) => {
    FrontstageManager.addFrontstageProvider(provider);
  });
  uiProviders.forEach((provider) => {
    UiItemsManager.register(provider);
  });
}

export default function useInitialize() {
  const [initialized, setInitialized] = React.useState(false);
  React.useEffect(() => {
    (async function () {
      await ElectronApp.startup({
        iModelApp: {
          authorizationClient: new ElectronRendererAuthorization(),
          notifications: new AppNotificationManager(),
          uiAdmin: new FrameworkUiAdmin(),
        },
      });

      await IModelApp.localization.changeLanguage("en-PSEUDO");

      await UiFramework.initialize(undefined);

      const activeLocale = IModelApp.localization.getLanguageList()[0];
      await Presentation.initialize({
        presentation: {
          activeLocale,
        },
      });

      await EditTools.initialize({ registerAllTools: true });

      IModelApp.uiAdmin.updateFeatureFlags({ allowKeyinPalette: true });

      registerProviders();

      setInitialized(true);
    })();
  }, []);
  return initialized;
}
