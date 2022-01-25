/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup, CoreTools, Frontstage, FrontstageManager, FrontstageProvider, UiFramework,
} from "@itwin/appui-react";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { Button } from "@itwin/itwinui-react";
import { OpenDialogOptions } from "electron";
import { BriefcaseConnection, IModelConnection, ViewCreator3d } from "@itwin/core-frontend";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { MainFrontstage } from "./MainFrontstage";

async function getViewState(iModel: IModelConnection) {
  const viewCreator = new ViewCreator3d(iModel);
  return viewCreator.createDefaultView();
}

function HomePage() {
  const onClick = async () => {
    const options: OpenDialogOptions = {
      properties: ["openFile"],
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
    };

    const val = await ElectronApp.callDialog("showOpenDialog", options);
    const fileName = val.canceled ? undefined : val.filePaths[0];
    if (!fileName)
      return;

    const iModelConnection = await BriefcaseConnection.openFile({ fileName });
    UiFramework.setIModelConnection(iModelConnection);

    const viewState = await getViewState(iModelConnection);
    UiFramework.setDefaultViewState(viewState);

    void FrontstageManager.setActiveFrontstage(MainFrontstage.stageId);
  };

  return (
    <div style={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Button onClick={onClick}>
        Open Model
      </Button>
    </div>
  );
}

class HomeControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <HomePage />;
  }
}

export class HomeFrontstage extends FrontstageProvider {
  public static readonly stageId = "editing-test-app:HomeFrontstage";

  public override get id() {
    return HomeFrontstage.stageId;
  }

  public override get frontstage() {
    const contentGroup = new ContentGroup({
      id: "HomeContentGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "HomeContent",
          classId: HomeControl,
        },
      ],
    });

    return (
      <Frontstage
        id={this.id}
        version={1}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
      />
    );
  }
}
