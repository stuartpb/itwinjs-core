/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageItem, BackstageItemUtilities
} from "@itwin/appui-abstract";
import {
  FrontstageManager,
  UiFramework,
} from "@itwin/appui-react";
import { HomeFrontstage } from "./frontstages/HomeFrontstage";

async function closeConnection() {
  const iModelConnection = UiFramework.getIModelConnection();
  if (!iModelConnection)
    return;

  await iModelConnection.close();
  await FrontstageManager.setActiveFrontstage(HomeFrontstage.stageId);
  UiFramework.setIModelConnection(undefined);
}

export default function useBackstageItems() {
  const items = React.useMemo<BackstageItem[]>(() => [
    BackstageItemUtilities.createStageLauncher(HomeFrontstage.stageId, 200, 10, "Home", undefined, "icon-home"),
    BackstageItemUtilities.createActionItem("editing-test-app:Close", 200, 10, closeConnection, "Close", undefined, "icon-close"),
  ], []);
  return items;
}
