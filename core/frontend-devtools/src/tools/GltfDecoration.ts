/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import {
  BeButton, BeButtonEvent, DecorateContext, Decorator, EventHandled, GraphicBranch, GraphicType, HitDetail, IModelApp,
  readGltfGraphics, RenderGraphic, RenderGraphicOwner, Tool,
} from "@itwin/core-frontend";

export class GltfDecoration implements Decorator {
  public readonly useCachedDecorations = true;
  public readonly transform?: Transform;
  public readonly tooltip: string;
  public readonly pickableId?: string;
  protected readonly _graphic: RenderGraphicOwner;

  public constructor(graphic: RenderGraphic, tooltip: string, pickableId?: string, transform?: Transform) {
    this.tooltip = tooltip;
    this.pickableId = pickableId;
    this.transform = transform;

    if (transform) {
      // Transform the graphic to the center of the project extents.
      const branch = new GraphicBranch();
      branch.add(graphic);
      graphic = IModelApp.renderSystem.createGraphicBranch(branch, transform);
    }

    // Take ownership of the graphic so it is not disposed of until we're finished with it.
    this._graphic = IModelApp.renderSystem.createGraphicOwner(graphic);
  }

  public dispose(): void {
    this._graphic.disposeGraphic();
    IModelApp.viewManager.dropDecorator(this);
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport.view.isSpatialView())
      context.addDecoration(GraphicType.Scene, this._graphic);
  }

  public testDecorationHit(id: string): boolean {
    return id === this.pickableId;
  }

  public async getDecorationToolTip() {
    return this.tooltip;
  }

  public async onDecorationButtonEvent(_hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (BeButton.Data !== ev.button || !ev.isDoubleClick)
      return EventHandled.No;

    this.dispose();
    return EventHandled.Yes;
  }
}

export class GltfDecorationTool extends Tool {
  public static override toolId = "AddGltfDecoration";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public override async run(url?: string) {
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    if (!iModel || "string" !== typeof url)
      return false;

    // Allow the user to select a glTF file.
    try {
      const response = await fetch(new Request(url));
      if (!response.ok)
        return false;

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      // Convert the glTF into a RenderGraphic.
      const id = iModel.transientIds.next;
      let graphic = await readGltfGraphics({
        gltf: new Uint8Array(buffer),
        iModel,
        pickableOptions: {
          id,
          // The modelId must be different from the pickable Id for the decoration to be selectable and hilite-able.
          modelId: iModel.transientIds.next,
        },
      });

      if (!graphic)
        return false;

      // Transform the graphic to the center of the project extents.
      const transform = Transform.createTranslation(iModel.projectExtents.center);

      // Install the decorator.
      const decorator = new GltfDecoration(graphic, url, id, transform);
      IModelApp.viewManager.addDecorator(decorator);

      // Once the iModel is closed, dispose of the graphic and uninstall the decorator.
      iModel.onClose.addOnce(() => decorator.dispose());

      return true;
    } catch (_) {
      return false;
    }
  }

  public override parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}
