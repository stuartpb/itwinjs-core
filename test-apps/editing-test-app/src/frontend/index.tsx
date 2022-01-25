/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { FrontstageManager, UiFramework } from "@itwin/appui-react";
import { IModelConnection, ViewCreator3d } from "@itwin/core-frontend";
import { BriefcaseConnection } from "@itwin/core-frontend/lib/cjs/BriefcaseConnection";

import AppUi from "./AppUi";
import { MainFrontstage } from "./frontstages/MainFrontstage";
import useInitialize from "./useInitialize";

async function getViewState(iModel: IModelConnection) {
  const viewCreator = new ViewCreator3d(iModel);
  return viewCreator.createDefaultView();
}

function App() {
  const initialized = useInitialize();

  React.useEffect(() => {
    if (!initialized)
      return;

    (async function () {
      const iModelConnection = await BriefcaseConnection.openFile({ fileName: process.env.IMJS_SNAPSHOT_PATH! });
      UiFramework.setIModelConnection(iModelConnection);

      const viewState = await getViewState(iModelConnection);
      UiFramework.setDefaultViewState(viewState);

      await FrontstageManager.setActiveFrontstage(MainFrontstage.stageId);
    })();
  }, [initialized]);

  if (!initialized)
    return <>Initializing...</>;
  return <>
    <div>Hello Editing Test App!</div>
    <AppUi />
  </>
}

(async function () {
  const container = document.getElementById("root");
  ReactDOM.render(<App />, container);
})();
