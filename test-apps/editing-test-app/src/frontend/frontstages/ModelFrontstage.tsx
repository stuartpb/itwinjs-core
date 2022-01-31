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
import { SyncMode } from "@itwin/core-common";
import { NativeApp } from "@itwin/core-frontend";
import { IModelFull, IModelGrid } from "@itwin/imodel-browser-react";
import { Button, ProgressLinear } from "@itwin/itwinui-react";

import { openBriefcase } from "./HomeFrontstage";
import { ProjectFrontstage, useApiOverrides, useSelectedProject } from "./ProjectFrontstage";
import { useRequiredAccessToken } from "../Authorization";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";

type Status = "idle" | "downloading" | "error";
type Download = (iModel: IModelFull) => void;

async function selectBriefcaseFile() {
  const val = await ElectronApp.callDialog("showSaveDialog", {
    title: "Select Briefcase",
    filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
  });
  return val.filePath;
}

function useDownloadIModel(): [Status, string | undefined, Download] {
  const [status, setStatus] = React.useState<Status>("idle");
  const [fileName, setFileName] = React.useState<string>();
  const download = React.useCallback(async (iModel: IModelFull) => {
    const fileName = await selectBriefcaseFile();
    if (!fileName)
      return;

    setStatus("downloading");
    setFileName(undefined);
    try {
      const downloader = await NativeApp.requestDownloadBriefcase(iModel.projectId || "", iModel.id, {
        syncMode: SyncMode.PullAndPush,
        fileName,
      });
      await downloader.downloadPromise;
      setStatus("idle");
      setFileName(downloader.fileName);
    } catch (e) {
      setStatus("error");
      throw e;
    }
  }, [status]);
  return [status, fileName, download];
}

function getProjectPageUrl(projectId: string) {
  return `https://${process.env.IMJS_URL_PREFIX ?? ""}connect-imodelhubwebsite.bentley.com/Context/${projectId}`;
}

interface ManageModelsProps {
  projectId: string;
}

function ManageModels({ projectId }: ManageModelsProps) {
  const href = getProjectPageUrl(projectId);
  return (
    <div style={{
      padding: "0.75em",
      alignSelf: "end",
    }}>
      <Button
        startIcon={
          <svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' aria-hidden>
            <path d='m16 0v5.4l-1.9-2-8.4 8.4-1.5-1.5 8.3-8.4-1.9-1.9m5.4 16v-9h-1v8h-14v-14h8v-1h-9v16z' />
          </svg>
        }
        onClick={() => {
          window.open(href, '_blank');
        }}
      >
        Manage iModels
      </Button>
    </div>
  );
}

function ModelPage() {
  const accessToken = useRequiredAccessToken();
  const apiOverrides = useApiOverrides();
  const selectedProject = useSelectedProject();
  const [status, fileName, download] = useDownloadIModel();
  const [opening, setOpening] = React.useState(false);
  React.useEffect(() => {
    if (!fileName)
      return;
    (async function () {
      setOpening(true);
      openBriefcase(fileName);
    })();
  }, [fileName]);
  const showIndicator = status === "downloading" || opening;

  if (!accessToken || !selectedProject)
    return <>Loading...</>;
  return (
    <>
      {showIndicator && <DownloadingIndicator />}
      <div style={{
        position: "absolute",
        padding: "0.75em",
        top: 0,
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
        display: "flex",
        flexDirection: "column",
      }}>
        <ManageModels projectId={selectedProject.id} />
        <div style={{
          height: "100%",
          overflow: "auto",
        }}>
          <IModelGrid
            accessToken={accessToken}
            apiOverrides={apiOverrides}
            projectId={selectedProject.id}
            onThumbnailClick={download}
          />
        </div>
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

export function DownloadingIndicator() {
  return (
    <div style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: 1,
      padding: "0.75em 20%",
      boxSizing: "border-box",
    }}>
      <ProgressLinear
        indeterminate={true}
        labels={[
          "Downloading...",
        ]}
      />
    </div>
  );
}
