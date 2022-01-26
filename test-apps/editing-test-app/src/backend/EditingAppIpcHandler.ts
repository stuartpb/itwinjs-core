/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, IpcHandler, ModelSelector, PhysicalModel, SpatialCategory, SpatialViewDefinition, StandaloneDb } from "@itwin/core-backend";
import { BentleyStatus, Id64Array, Id64String } from "@itwin/core-bentley";
import { ColorByName, ColorDef, IModel, RenderMode, SubCategoryAppearance, ViewFlags } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";

import { editingAppChannel, EditingAppIpcInterface } from "../common/EditingAppIpcInterface";

export class EditingAppIpcHandler extends IpcHandler implements EditingAppIpcInterface {
  public override get channelName() {
    return editingAppChannel;
  }

  public async createEmptyModel(filePath: string): Promise<BentleyStatus> {
    const iModelDb = StandaloneDb.createEmpty(filePath, {
      rootSubject: {
        name: "Empty Model",
        description: "Empty Model Root Subject ",
      },
      allowEdit: `{ "txns": true }`,
      projectExtents: new Range3d(-500, -500, -100, 500, 500, 100),
    });

    const physicalModelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "Physical Model");
    const definitionModelId = DefinitionModel.insert(iModelDb, IModel.rootSubjectId, "Definition Model");

    const appearance = new SubCategoryAppearance({
      color: ColorByName.black,
      fill: ColorByName.blue,
    });
    const defaultSpatialCategoryId = SpatialCategory.insert(iModelDb, definitionModelId, "Spatial Category", appearance);

    const defaultView3dId = insert3dView(iModelDb, definitionModelId, [physicalModelId], [defaultSpatialCategoryId]);
    iModelDb.views.setDefaultViewId(defaultView3dId);

    iModelDb.saveChanges("Empty iModel initialized");
    iModelDb.close();

    return BentleyStatus.SUCCESS;
  }
}

function insert3dView(iModelDb: IModelDb, definitionModelId: Id64String, modelIds: Id64Array, categoryIds: Id64Array) {
  const modelSelectorId = ModelSelector.insert(iModelDb, definitionModelId, "Model Selector", modelIds);
  const categorySelectorId = CategorySelector.insert(iModelDb, definitionModelId, "Category Selector", categoryIds);
  const displayStyleId = DisplayStyle3d.insert(iModelDb, definitionModelId, "Display Style 3D", {
    viewFlags: new ViewFlags({
      grid: true,
      renderMode: RenderMode.SmoothShade,
      acsTriad: true,
      visibleEdges: true,
      lighting: true,
    }),
    backgroundColor: ColorDef.fromTbgr(ColorByName.lightGray),
  });

  const viewRange = new Range3d(-1000, -1000, -50, 1000, 1000, 500);
  const spatialView = SpatialViewDefinition.createWithCamera(iModelDb, definitionModelId, "Spatial View Definition", modelSelectorId, categorySelectorId, displayStyleId, viewRange);
  return spatialView.insert();
}
