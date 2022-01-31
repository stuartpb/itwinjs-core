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
import { IModelApp } from "@itwin/core-frontend";
import { openPushChangesDialog } from "./PushChangesDialog";
import { useTranslated } from "./Translate";

async function closeConnection() {
  const iModelConnection = UiFramework.getIModelConnection();
  if (!iModelConnection)
    return;

  await iModelConnection.close();
  await FrontstageManager.setActiveFrontstage(HomeFrontstage.stageId);
  UiFramework.setIModelConnection(undefined);
}

async function syncChanges() {
  const iModelConnection = UiFramework.getIModelConnection();
  if (!iModelConnection?.isBriefcaseConnection())
    return;

  const removeListener = iModelConnection.txns.onChangesPulled.addOnce((parentChangeset) => {
    if (parentChangeset.id === iModelConnection.changeset.id)
      return;
    IModelApp.viewManager.refreshForModifiedModels(undefined);
  });
  await iModelConnection.pullChanges();
  removeListener();

  const hasPendingTxns = await iModelConnection.hasPendingTxns();
  if (!hasPendingTxns)
    return;
  openPushChangesDialog((input) => {
    if (!input)
      return;
    void iModelConnection.pushChanges(input.description);
  });
}

export default function useBackstageItems() {
  const homeLabel = useTranslated("backstage.home");
  const syncLabel = useTranslated("backstage.sync");
  const closeLabel = useTranslated("backstage.close");
  const items = React.useMemo<BackstageItem[]>(() => [
    BackstageItemUtilities.createStageLauncher(HomeFrontstage.stageId, 100, 10, homeLabel, undefined, "icon-home"),
    BackstageItemUtilities.createActionItem("editing-test-app:Sync", 200, 10, syncChanges, syncLabel, undefined, "icon-imodel-hub-sync"),
    BackstageItemUtilities.createActionItem("editing-test-app:Close", 300, 10, closeConnection, closeLabel, undefined, "icon-close"),
  ], [homeLabel, syncLabel, closeLabel]);
  return items;
}
