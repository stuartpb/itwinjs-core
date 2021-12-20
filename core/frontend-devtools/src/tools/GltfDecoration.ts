/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Transform, TransformProps } from "@itwin/core-geometry";
import {
  BeButton, BeButtonEvent, DecorateContext, Decorator, EventHandled, GraphicBranch, GraphicType, HitDetail, IModelApp,
  IModelConnection, readGltfGraphics, RenderGraphic, RenderGraphicOwner, Tool,
} from "@itwin/core-frontend";

export interface GltfDecorationProps {
  url: string;
  transform?: TransformProps;
  pickableId?: Id64String;
}

export class GltfDecoration implements Decorator {
  public readonly useCachedDecorations = true;
  public readonly transform?: Transform;
  public readonly url: string;
  public readonly pickableId?: string;
  protected readonly _graphic: RenderGraphicOwner;

  public constructor(graphic: RenderGraphic, url: string, pickableId?: string, transform?: Transform) {
    this.url = url;
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
    return this.url;
  }

  public async onDecorationButtonEvent(_hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (BeButton.Data !== ev.button || !ev.isDoubleClick)
      return EventHandled.No;

    this.dispose();
    return EventHandled.Yes;
  }

  public static async fromJSON(props: GltfDecorationProps, iModel: IModelConnection): Promise<GltfDecoration | undefined> {
    try {
      const response = await fetch(new Request(props.url));
      if (!response.ok)
        return undefined;

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      // Convert the glTF into a RenderGraphic.
      const pickableOptions = undefined !== props.pickableId ? { id: props.pickableId, modelId: iModel.transientIds.next } : undefined;
      let graphic = await readGltfGraphics({
        gltf: new Uint8Array(buffer),
        iModel,
        pickableOptions,
      });

      if (!graphic)
        return undefined;

      // Install the decorator.
      const transform = props.transform ? Transform.fromJSON(props.transform) : undefined;
      const decorator = new GltfDecoration(graphic, props.url, props.pickableId, transform);
      IModelApp.viewManager.addDecorator(decorator);

      // Once the iModel is closed, dispose of the graphic and uninstall the decorator.
      iModel.onClose.addOnce(() => decorator.dispose());

      return decorator;
    } catch (_) {
      return undefined;
    }
  }

  public toJSON(): GltfDecorationProps {
    return {
      url: this.url,
      pickableId: this.pickableId,
      transform: this.transform?.toJSON(),
    };
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

    return undefined !== await GltfDecoration.fromJSON({
      url,
      pickableId: iModel.transientIds.next,
      transform: Transform.createTranslation(iModel.projectExtents.center).toJSON(),
    }, iModel);
  }

  public override parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}
