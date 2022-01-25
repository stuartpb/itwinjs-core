/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { AppNotificationManager, FrameworkUiAdmin, FrontstageManager, UiFramework } from "@itwin/appui-react";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp } from "@itwin/core-frontend";
import { EditTools } from "@itwin/editor-frontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { Presentation } from "@itwin/presentation-frontend";

import { MainFrontstage } from "./frontstages/MainFrontstage";
import { HomeFrontstage } from "./frontstages/HomeFrontstage";

function provideFrontstages() {
  FrontstageManager.addFrontstageProvider(new HomeFrontstage());
  FrontstageManager.addFrontstageProvider(new MainFrontstage());
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

      provideFrontstages();

      setInitialized(true);
    })();
  }, []);
  return initialized;
}
