/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ActionButton, CommonToolbarItem, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsProvider } from "@itwin/appui-abstract";
import { IModelApp, ToolType } from "@itwin/core-frontend";
import { CreateArcTool, CreateBCurveTool, CreateCircleTool, CreateEllipseTool, CreateLineStringTool, CreateRectangleTool } from "@itwin/editor-frontend";
import { translate } from "./Translate";

const sketchTools = [
  CreateArcTool,
  CreateBCurveTool,
  CreateCircleTool,
  CreateEllipseTool,
  CreateLineStringTool,
  CreateRectangleTool,
];

function createToolActionButton(toolType: ToolType, overrides?: Partial<ActionButton>) {
  return ToolbarItemUtilities.createActionButton(
    toolType.toolId,
    0,
    toolType.iconSpec,
    toolType.flyover,
    async () => {
      await IModelApp.tools.run(toolType.toolId);
    },
    overrides,
  );
}

export class ToolsProvider implements UiItemsProvider {
  public static readonly id = "editing-test-app:ToolsProvider";
  public readonly id = ToolsProvider.id;

  public provideToolbarButtonItems(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation) {
    const items: CommonToolbarItem[] = [];

    switch (toolbarUsage) {
      case ToolbarUsage.ContentManipulation: {
        switch (toolbarOrientation) {
          case ToolbarOrientation.Horizontal: {
            const sketchLabel = translate("buttons.sketchTools");
            const sketchItems = sketchTools.map((tool) => createToolActionButton(tool));
            items.push(ToolbarItemUtilities.createGroupButton(`${this.id}:sketchTools`, 10, "icon-draw", sketchLabel, sketchItems, { groupPriority: 30 }));
            break;
          }
        }
        break;
      }
    }

    return items;
  }
}
