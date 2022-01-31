/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OpenDialogOptions, SaveDialogOptions } from "electron";
import * as React from "react";
import { useSelector } from "react-redux";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import {
  BackstageAppButton,
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup, CoreTools, FrameworkRootState, FrameworkState, Frontstage, FrontstageManager, FrontstageProvider, UiFramework,
} from "@itwin/appui-react";
import { BentleyStatus, Id64 } from "@itwin/core-bentley";
import { BriefcaseConnection, IModelConnection, ViewCreator3d } from "@itwin/core-frontend";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { Button } from "@itwin/itwinui-react";

import { MainFrontstage } from "./MainFrontstage";
import { ProjectsFrontstage } from "./ProjectsFrontstage";
import { editingAppIpc } from "../EditingAppIpc";
import UserProfile from "../UserProfile";

async function getViewState(iModel: IModelConnection) {
  const defaultViewId = await iModel.views.queryDefaultViewId();
  if (defaultViewId && Id64.isValidId64(defaultViewId))
    return iModel.views.load(defaultViewId);

  const viewCreator = new ViewCreator3d(iModel);
  return viewCreator.createDefaultView();
}

export async function openBriefcase(fileName: string) {
  const iModelConnection = await BriefcaseConnection.openFile({ fileName });
  UiFramework.setIModelConnection(iModelConnection);

  const viewState = await getViewState(iModelConnection);
  UiFramework.setDefaultViewState(viewState);

  void FrontstageManager.setActiveFrontstage(MainFrontstage.stageId);
};

function HomePage() {
  const [opening, setOpening] = React.useState(false);
  const iModelConnection = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey] as FrameworkState;
    return frameworkState.sessionState.iModelConnection as IModelConnection | undefined;
  });

  const handleOpenModel = async () => {
    const options: OpenDialogOptions = {
      properties: ["openFile"],
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
    };

    const val = await ElectronApp.callDialog("showOpenDialog", options);
    const fileName = val.canceled ? undefined : val.filePaths[0];
    if (!fileName)
      return;

    setOpening(true);
    await openBriefcase(fileName);
  };

  const handleCreateModel = async () => {
    const options: SaveDialogOptions = {
      properties: ["showOverwriteConfirmation"],
      filters: [{ name: "iModel", extensions: ["bim"] }],
    };

    const val = await ElectronApp.callDialog("showSaveDialog", options);
    const filePath = val.filePath;
    if (!filePath)
      return;

    const status = await editingAppIpc.createEmptyModel(filePath);
    if (status === BentleyStatus.ERROR)
      return;

    setOpening(true);
    await openBriefcase(filePath);
  };

  const handleCloneModel = () => {
    void FrontstageManager.setActiveFrontstage(ProjectsFrontstage.stageId);
  };

  return (
    <>
      {iModelConnection && !opening ? <div style={{
        position: "absolute",
        padding: "0.75em"
      }}>
        <BackstageAppButton
          icon="icon-progress-backward"
          execute={() => {
            void FrontstageManager.setActiveFrontstage(MainFrontstage.stageId);
          }}
        />
      </div> : null}
      <UserProfile />
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Button onClick={handleOpenModel}>
          Open Model
        </Button>
        <br />
        <Button onClick={handleCreateModel}>
          Create Model
        </Button>
        <br />
        <Button onClick={handleCloneModel}>
          Clone Model
        </Button>
        <br />
      </div>
    </>
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
