/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { JsonUtils } from "@bentley/bentleyjs-common/lib/JsonUtils";
import { ColorDef } from "./Render";
import { Angle } from "../../geometry-core/lib/Geometry";

/** The type of a Light */
export enum LightType {
  Invalid = 0,
  Solar = 1,     // Sunlight
  Ambient = 2,   // ambient light
  Flash = 3,     // flash bulb at camera
  Portrait = 4,  // over the shoulder (left and right)
  Point = 5,     // non directional point light source
  Spot = 6,
  Area = 7,
  Distant = 8,
  SkyOpening = 9,
}

/** Parameters to create a Light */
export interface ILight {
  lightType?: LightType;  // the type of light from LightType enum
  intensity?: number;     // intensity of the light
  color?: ColorDef;       // color of the light. ColorDef as integer
  intensity2?: number;    // for portrait lights, intensity of the "over the left shoulder" light (intensity is the right shoulder light).
  color2?: ColorDef;      // for left portrait light
  kelvin?: number;        // color temperature, in kelvins. Note that color and kelvins are not independent. Useful for UI, I guess?
  shadows?: number;       // the number of shadow samples
  bulbs?: number;         // number of bulbs
  lumens?: number;
}

/** a light to illuminate the contents of a scene */
export class Light {
  public lightType: LightType;
  public intensity: number;
  public color: ColorDef;
  public intensity2?: number;
  public color2?: ColorDef;
  public kelvin: number;
  public shadows: number;
  public bulbs: number;
  public lumens: number;

  constructor(opts?: ILight) {
    opts = opts ? opts : {};
    this.lightType = JsonUtils.asInt(opts.lightType);
    this.intensity = JsonUtils.asDouble(opts.intensity);
    this.kelvin = JsonUtils.asDouble(opts.kelvin);
    this.shadows = JsonUtils.asDouble(opts.shadows);
    this.bulbs = JsonUtils.asInt(opts.bulbs);
    this.lumens = JsonUtils.asDouble(opts.lumens);
    this.color = ColorDef.fromJSON(opts.color);
    if (opts.intensity2)
      this.intensity2 = JsonUtils.asDouble(opts.intensity2);
    if (opts.color2)
      this.color2 = ColorDef.fromJSON(opts.color2);
  }

  public isValid(): boolean { return this.lightType !== LightType.Invalid; }
  public isVisible(): boolean { return this.isValid() && this.intensity > 0.0; }
}

/** Parameters to create a Spot light. */
export interface ISpot extends ILight {
  inner?: Angle;
  outer?: Angle;
}

/** a light from a single location  */
export class Spot extends Light {
  public inner: Angle;
  public outer: Angle;

  constructor(opts?: ISpot) {
    opts = opts ? opts : {};
    super(opts);
    this.lightType = LightType.Spot;
    this.inner = Angle.fromJSON(opts.inner);
    this.outer = Angle.fromJSON(opts.outer);
  }
}
