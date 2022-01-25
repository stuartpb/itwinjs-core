/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BasicNavigationWidget, BasicToolWidget, ContentGroup, CoreTools, Frontstage, FrontstageProvider, IModelViewportControl,
  Widget, Zone,
} from "@itwin/appui-react";
import { StandardContentLayouts } from "@itwin/appui-abstract";

export class MainFrontstage extends FrontstageProvider {
  public static readonly stageId = "editing-test-app:MainFrontstage";

  public override get id() {
    return MainFrontstage.stageId;
  }

  public override get frontstage() {
    const contentGroup = new ContentGroup({
      id: "MainContentGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "MainContent",
          classId: IModelViewportControl,
          applicationData: {
          },
        },
      ],
    });

    return (
      <Frontstage
        id={this.id}
        version={1}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget
                key={`${this.id}-toolWidget`}
                element={<BasicToolWidget />}
              />,
            ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={[
              <Widget
                key={`${this.id}-navigationWidget`}
                element={<BasicNavigationWidget />}
              />,
            ]}
          />
        }
      />
    );
  }
}
