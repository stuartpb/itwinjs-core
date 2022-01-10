/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Viewport } from "@itwin/core-frontend";
import { ClipVector } from "@itwin/core-geometry";
import { ComboBox, ComboBoxEntry, createButton, createComboBox, createNumericInput, createSlider, Slider } from "@itwin/frontend-devtools";
import { convertImageDataToProps, ECImageQuality, ImageData, ImageDecorator } from "./ImageDecorator";
import { ToolBarDropDown } from "./ToolBar";

export class EarthCamDebugPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _slider: Slider;
  private readonly _qualitySelector: ComboBox;
  private _index: number = 0;
  private _clearBuffer = true;
  public intervalID: number = 0;

  public get decorator() { return ImageDecorator.getOrCreate(this._vp); }

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    const startingScaling = 1;
    const fetchPromise = EarthCamClient.fetch();

    ImageDecorator.setClipVector(ClipVector.createEmpty());

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    parent.appendChild(this._element);

    createButton({
      id: "earthcam-timeline-play-btn",
      parent: this._element,
      value: "Play",
      handler: (btn) => {
        if (btn.value === "Play") {
          this.playTimeline();
          btn.value = "Pause";
        } else {
          this.stopTimeline();
          btn.value = "Play";
        }
      },
      // inline?: boolean;
      // tooltip?: string;
    });
    const options: ComboBoxEntry[] = ["large", "medium", "small"].map((str) => ({value: str, name: str}));
    this._qualitySelector = createComboBox({
      name: "Quality Selector",
      id: "earthcam-quality-selector",
      entries: options,
      parent: this._element,
      handler: (_select) => {
        this.setIndex(this._index);
      },
      value: "large",
    });
    createButton({
      id: "earthcam-buffer-btn",
      parent: this._element,
      value: "Use Buffer",
      handler: (btn) => {
        if (btn.value === "Use Buffer") {
          this._clearBuffer = false;
          btn.value = "Clear Buffer";
          const props = EarthCamClient.imageProps.map((data) => convertImageDataToProps(data));
          this.decorator.bufferImages(props).catch(() => {});
        } else {
          this._clearBuffer = true;
          btn.value = "Use Buffer";
        }
      },
      // inline?: boolean;
      // tooltip?: string;
    });
    this._slider = createSlider({
      name: "timeline",
      id: "earthcam-timeline",
      parent: this._element,
      min: "0",
      max: (EarthCamClient.imageProps.length - 1).toString(),
      step: "1",
      value: this._index.toString(),
      handler: (slider: HTMLInputElement) => {
        const i = Number.parseInt(slider.value, 10);
        this.setIndex(i);
      },
    });
    this._slider.div.style.margin = "5px";
    const scaleSpan = document.createElement("span");
    scaleSpan.style.display = "flex";
    this._element.appendChild(scaleSpan);

    const label = document.createElement("label");
    // label.style.display = "inline";
    label.title = "Scale Image";
    scaleSpan.appendChild(label);

    createNumericInput({
      handler: (value) => this.setScaling(value),
      id: "earthcam-scaling",
      parent: scaleSpan,
      value: startingScaling,
      display: "inline",
      min: 0.01,
      parseAsFloat: true,
    }).style.flexGrow = "true";

    this.setScaling(startingScaling);

    fetchPromise.finally(() => {
      this._slider.slider.max = EarthCamClient.imageProps.length.toString();
      this.setIndex(0);
      this.open();
    });
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }

  public getSelectedQuality(): ECImageQuality | undefined {
    let rtn: ECImageQuality | undefined;
    const value = this._qualitySelector.select.value;
    switch(value) {
      case "small":
      case "medium":
      case "large":
        rtn = value;
        break;
      default:
        rtn = undefined;
    }
    return rtn;
  }

  public setIndex(i: number) {
    this._index = i;
    this._slider.slider.value = this._index.toString();
    const newData = EarthCamClient.imageProps[i];
    const props = convertImageDataToProps(newData);
    props.quality = this.getSelectedQuality();
    this.decorator.setImage(props, this._clearBuffer).then((didDisplay: boolean) => {
      if (!didDisplay) console.error("Failed to create texture from image props.");
    }).catch((err) => {
      console.error("Error During 'SetImage': ", err);
    }).finally(() => this._vp.invalidateDecorations());
  }

  public setScaling(scale: number) {
    ImageDecorator.scaling = scale;
    this._vp.invalidateDecorations();
  }

  private _timelineIntervalFunc = () => {
    if (this.intervalID !== 0) {
      if (this._index === EarthCamClient.imageProps.length - 1) {
        this.setIndex(0);
      } else {
        this.setIndex(this._index+1);
      }
    }
  };

  public playTimeline() {
    if (!this.intervalID)
      this.intervalID = window.setInterval(this._timelineIntervalFunc, 900);
  }

  public stopTimeline() {
    clearInterval(this.intervalID);
    this.intervalID = 0;
  }
}

interface EarthCamEndPoints { endpoints: ImageData[] }

class EarthCamClient {
  public static readonly imageProps: ImageData[] = [];
  public static async fetch() {
    const response = await fetch("EarthCamEndPoints.json");
    const data = await response.json() as EarthCamEndPoints;
    data.endpoints.forEach((prop) =>
      EarthCamClient.imageProps.push(prop)
    );
  }
}
