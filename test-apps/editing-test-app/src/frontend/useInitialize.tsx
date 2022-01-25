/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { FrontstageManager, UiFramework } from "@itwin/appui-react";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp } from "@itwin/core-frontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { Presentation } from "@itwin/presentation-frontend";

import { MainFrontstage } from "./frontstages/MainFrontstage";

function provideFrontstages() {
  FrontstageManager.addFrontstageProvider(new MainFrontstage());
}

export default function useInitialize() {
  const [initialized, setInitialized] = React.useState(false);
  React.useEffect(() => {
    (async function () {
      const authorizationClient = new ElectronRendererAuthorization();
      await ElectronApp.startup({
        iModelApp: {
          authorizationClient,
        },
      });

      await UiFramework.initialize(undefined);

      const activeLocale = IModelApp.localization.getLanguageList()[0];
      await Presentation.initialize({
        presentation: {
          activeLocale,
        },
      });

      provideFrontstages();

      setInitialized(true);
    })();
  }, []);
  return initialized;
}
