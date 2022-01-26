/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import {
  BackstageAppButton,
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup, CoreTools, Frontstage, FrontstageManager, FrontstageProvider,
} from "@itwin/appui-react";
import { IModelGrid } from "@itwin/imodel-browser-react";
import { useRequiredAccessToken } from "../Authorization";
import { ProjectFrontstage, useApiOverrides, useSelectedProject } from "./ProjectFrontstage";

function ModelPage() {
  const accessToken = useRequiredAccessToken();
  const apiOverrides = useApiOverrides();
  const selectedProject = useSelectedProject();
  if (!accessToken || !selectedProject)
    return <>Loading...</>;
  return (
    <>
      <div style={{
        position: "absolute",
        padding: "0.75em",
      }}>
        <BackstageAppButton
          icon="icon-progress-backward"
          execute={() => {
            void FrontstageManager.setActiveFrontstage(ProjectFrontstage.stageId);
          }}
        />
      </div>
      <div style={{
        height: "100%",
        overflow: "auto",
      }}>
        <IModelGrid
          accessToken={accessToken}
          apiOverrides={apiOverrides}
          projectId={selectedProject.id}
          onThumbnailClick={(iModel) => {
            console.log(iModel);
          }}
        />
      </div>
    </>
  );
}

class ModelControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <ModelPage />;
  }
}

export class ModelFrontstage extends FrontstageProvider {
  public static readonly stageId = "editing-test-app:ModelFrontstage";

  public override get id() {
    return ModelFrontstage.stageId;
  }

  public override get frontstage() {
    const contentGroup = new ContentGroup({
      id: "ModelContentGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "ModelContent",
          classId: ModelControl,
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
