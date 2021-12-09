/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Viewport } from "@itwin/core-frontend";
import { createSlider } from "@itwin/frontend-devtools";
import { ImageDecorator, ImageProps } from "./ImageDecorator";
import { ToolBarDropDown } from "./ToolBar";

export class EarthCamDebugPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private _index: number = 0;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._element = document.createElement("div");
    parent.appendChild(this._element);
    this.open();
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }

  public addTimeline() {
    createSlider({
      name: "timeline",
      id: "earthcam-timeline",
      parent: this._element,
      min: "0",
      max: EarthCamClient.imageProps.length.toString(),
      step: "1",
      value: this._index.toString(),
      handler: (slider: HTMLInputElement) => {
        const i = Number.parseInt(slider.value, 10);
        this._index = i;
        const newProps = EarthCamClient.imageProps[i];
        ImageDecorator.getOrCreate(this._vp).setImage(newProps).catch((err) => {
          console.error("Error During 'SetImage'", err);
        });
      },
    });
  }
}

class EarthCamClient {
  public static readonly imageProps: ImageProps[] = [ ];
}
