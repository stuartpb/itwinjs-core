/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Provider } from "react-redux";
import {
  BackstageComposer,
  ConfigurableUiContent,
  FrontstageManager,
  StateManager,
} from "@itwin/appui-react";
import { HomeFrontstage } from "./frontstages/HomeFrontstage";
import useActiveSettings from "./useActiveSettings";
import useBackstageItems from "./useBackstageItems";

export default function AppUi() {
  const items = useBackstageItems();
  React.useEffect(() => {
    void FrontstageManager.setActiveFrontstage(HomeFrontstage.stageId);
  }, []);
  useActiveSettings();
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
