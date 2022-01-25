/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Provider } from "react-redux";
import {
  BackstageItem
} from "@itwin/appui-abstract";
import {
  BackstageComposer,
  ConfigurableUiContent,
  FrontstageManager,
  StateManager,
} from "@itwin/appui-react";
import { HomeFrontstage } from "./frontstages/HomeFrontstage";

export default function AppUi() {
  const items = React.useMemo<BackstageItem[]>(() => [], []);
  React.useEffect(() => {
    void FrontstageManager.setActiveFrontstage(HomeFrontstage.stageId);
  }, []);
  return (
    <Provider store={StateManager.store}>
      <ConfigurableUiContent
        appBackstage={<BackstageComposer
          items={items}
        />}
      />
    </Provider>
  );
}
