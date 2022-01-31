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
import { BeEvent } from "@itwin/core-bentley";
import { ApiOverrides, ProjectFull, ProjectGrid } from "@itwin/imodel-browser-react";

import { useRequiredAccessToken } from "../Authorization";
import { HomeFrontstage } from "./HomeFrontstage";
import { ModelsFrontstage } from "./ModelsFrontstage";
import { useTranslated } from "../Translate";

const selectedProject = (function () {
  let project: ProjectFull | undefined;
  let onChanged = new BeEvent<(newProject: ProjectFull | undefined) => void>();
  return {
    get: () => {
      return project;
    },
    set: (newProject: ProjectFull | undefined) => {
      project = newProject;
      onChanged.raiseEvent(newProject);
    },
    onChanged,
  };
})();

export function useSelectedProject() {
  const [project, setProject] = React.useState(selectedProject.get());
  React.useEffect(() => {
    return selectedProject.onChanged.addListener((newProject) => {
      setProject(newProject);
    });
  }, []);
  return project;
}

export function useApiOverrides() {
  const overrides = React.useMemo<ApiOverrides>(() => {
    let serverEnvironmentPrefix: ApiOverrides["serverEnvironmentPrefix"];
    if (process.env.IMJS_URL_PREFIX === "qa-")
      serverEnvironmentPrefix = "qa";
    return {
      serverEnvironmentPrefix,
    };
  }, []);
  return overrides;
}

function ProjectPage() {
  const accessToken = useRequiredAccessToken();
  const apiOverrides = useApiOverrides();
  const loadingLabel = useTranslated("loading");
  if (!accessToken)
    return <>{loadingLabel}</>;
  return (
    <>
      <div style={{
        position: "absolute",
        padding: "0.75em",
      }}>
        <BackButton onClick={() => {
          void FrontstageManager.setActiveFrontstage(HomeFrontstage.stageId);
        }} />
      </div>
      <div style={{
        height: "100%",
        overflow: "auto",
      }}>
        <ProjectGrid
          accessToken={accessToken}
          apiOverrides={apiOverrides}
          onThumbnailClick={(project) => {
            selectedProject.set(project);
            void FrontstageManager.setActiveFrontstage(ModelsFrontstage.stageId);
          }}
        />
      </div>
    </>
  );
}

class ProjectControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <ProjectPage />;
  }
}

export class ProjectsFrontstage extends FrontstageProvider {
  public static readonly stageId = "editing-test-app:ProjectFrontstage";

  public override get id() {
    return ProjectsFrontstage.stageId;
  }

  public override get frontstage() {
    const contentGroup = new ContentGroup({
      id: "ProjectContentGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "ProjectContent",
          classId: ProjectControl,
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

export interface BackButtonProps {
  onClick?(): void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <BackstageAppButton
      icon="icon-progress-backward"
      execute={onClick}
    />
  );
}
