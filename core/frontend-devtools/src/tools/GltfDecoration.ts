/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import {
  BeButton, BeButtonEvent, DecorateContext, Decorator, EventHandled, GraphicBranch, GraphicType, HitDetail, IModelApp, readGltfGraphics, RenderGraphicOwner, Tool,
} from "@itwin/core-frontend";

export class GltfDecoration implements Decorator {
  public readonly useCachedDecorations = true;
  private readonly _graphic: RenderGraphicOwner;
  private readonly _tooltip: string;
  private readonly _pickableId?: string;

  public constructor(graphic: RenderGraphicOwner, tooltip: string, pickableId?: string) {
    this._graphic = graphic;
    this._tooltip = tooltip;
    this._pickableId = pickableId;
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
    return undefined !== this._pickableId && id === this._pickableId;
  }

  public async getDecorationToolTip() {
    return this._tooltip;
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
      const branch = new GraphicBranch();
      branch.add(graphic);
      const transform = Transform.createTranslation(iModel.projectExtents.center);
      graphic = IModelApp.renderSystem.createGraphicBranch(branch, transform);

      // Take ownership of the graphic so it is not disposed of until we're finished with it.
      const graphicOwner = IModelApp.renderSystem.createGraphicOwner(graphic);

      // Install the decorator.
      const decorator = new GltfDecoration(graphicOwner, url, id);
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
