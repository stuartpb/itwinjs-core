/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Slider
 */

import "./Slider.scss";
import classnames from "classnames";
import * as React from "react";
import { Slider as ItwinSlider } from "@itwin/itwinui-react";
import { CommonProps } from "../utils/Props";
import { BodyText } from "../text/BodyText";

// cspell:ignore pushable

/** Properties for [[Slider]] component
  * @public
  */
export interface SliderProps extends CommonProps {
  /** Values to set Slider to initially */
  values: number[];
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Format the min display value */
  formatMin?: (value: number) => string;
  /** Format the max display value */
  formatMax?: (value: number) => string;

  /** Step value. Default is 0.1. */
  step?: number;
  /** The interaction mode. Default is 1. Possible values:
    * 1 - allows handles to cross each other.
    * 2 - keeps the sliders from crossing and separated by a step.
    */
  mode?: number | (() => number);
  /** Indicates whether the display of the Slider values is reversed. */
  reversed?: boolean;
  /** Indicates whether the Slider is disabled. */
  disabled?: boolean;
  /** Indicates whether to compensate for the tick marks when determining the width. */
  includeTicksInWidth?: boolean;

  /** Indicates whether to show tooltip with the value. The tooltip will be positioned above the Slider, by default. */
  showTooltip?: boolean;
  /** Indicates whether the tooltip should show below the Slider instead of above. */
  tooltipBelow?: boolean;
  /** Format a value for the tooltip */
  formatTooltip?: (value: number) => string;

  /** Indicates whether to show min & max values to the left & right of the Slider. */
  showMinMax?: boolean;
  /** Image to show for min. */
  minImage?: React.ReactNode;
  /** Image to show for max. */
  maxImage?: React.ReactNode;

  /** Indicates whether to show tick marks under the Slider. */
  showTicks?: boolean;
  /** Indicates whether to show tick labels under the tick marks. */
  showTickLabels?: boolean;
  /** Format a tick mark value */
  formatTick?: (tick: number) => string;
  /** Function to get the tick count. The default tick count is 10. */
  getTickCount?: () => number;
  /** Function to get the tick values. This overrides the tick count from getTickCount.
    * Use this prop if you want to specify your own tick values instead of ticks generated by the slider.
    * The numbers should be valid numbers in the domain and correspond to the step value.
    * Invalid values will be coerced to the closet matching value in the domain.
    */
  getTickValues?: () => number[];

  /** Listens for value changes.
    * Triggered when the value of the slider has changed. This will receive changes at
    * the end of a slide as well as changes from clicks on rails and tracks.
    */
  onChange?: (values: ReadonlyArray<number>) => void;
  /** Listens for value updates.
    *  Called with the values at each update (caution: high-volume updates when dragging).
    */
  onUpdate?: (values: ReadonlyArray<number>) => void;
  /** No longer available use onUpdate. */
  onSlideStart?: (values: ReadonlyArray<number>) => void;
  /** No longer available use onChange. */
  onSlideEnd?: (values: ReadonlyArray<number>) => void;
}

/**
  * Slider React component displays a range slider.
  * @public
  * @deprecated Use Slider in itwinui-react instead
  */
export function Slider(props: SliderProps) {
  const { className, style, min, max, values, step, mode,
    formatMin, formatMax,
    onChange, onUpdate,
    showTicks, showTickLabels, formatTick, getTickCount, getTickValues, includeTicksInWidth,
    reversed, disabled,
    showMinMax, minImage, maxImage,
    showTooltip, tooltipBelow, formatTooltip,
  } = props;

  const containerClassNames = classnames(
    "core-slider-container",
    className,
    disabled && "core-disabled",
    showTickLabels && "core-slider-tickLabels",
    includeTicksInWidth && "core-slider-includeTicksInWidth",
  );
  const sliderClassNames = classnames(
    "core-slider",
    showMinMax && "core-slider-minMax",
  );

  const internalFormatTooltip = React.useCallback((value: number) => {
    if (formatTooltip)
      return formatTooltip(value);

    const actualStep = Math.abs(step ?? 1);

    if (Number.isInteger(actualStep))
      return value.toFixed(0);

    const stepString = actualStep.toString();
    const decimalIndex = stepString.indexOf(".");
    const numDecimals = actualStep.toString().length - (decimalIndex + 1);
    return value.toFixed(numDecimals);
  }, [formatTooltip, step]);

  const tooltipProps = React.useCallback((_index: number, val: number) => {
    const content = internalFormatTooltip(val);
    if (!showTooltip)
      return { visible: false };
    return { placement: tooltipBelow ? "bottom" : "top", content };
  }, [internalFormatTooltip, showTooltip, tooltipBelow]);

  const tickLabels = React.useMemo(() => {
    let ticks: string[] | undefined;

    if (showTicks) {
      const count = getTickCount ? getTickCount() : 0;
      if (count) {
        ticks = [];
        const increment = (max - min) / count;
        for (let i = 0; i <= count; i++) {
          const value = (i * increment) + min;
          if (showTickLabels) {
            const label = formatTick ? formatTick(value) : internalFormatTooltip(value);
            ticks.push(label);
          } else {
            ticks.push("");
          }
        }
      } else /* istanbul ignore else */ if (getTickValues) {
        return getTickValues().map((val: number) => formatTick ? formatTick(val) : internalFormatTooltip(val));
      }
    }
    return ticks;
  }, [formatTick, getTickCount, getTickValues, internalFormatTooltip, max, min, showTickLabels, showTicks]);

  const thumbMode = React.useMemo(() => {
    let inMode = 1;
    if (typeof mode === "function")
      inMode = mode();

    return 1 === inMode ? "allow-crossing" : "inhibit-crossing";
  }, [mode]);

  return (
    <div className={containerClassNames} style={style}>
      {showMinMax &&
        <MinMax value={min} testId="core-slider-min" image={minImage} format={formatMin} />
      }
      <ItwinSlider
        className={sliderClassNames}
        values={values}
        min={min}
        max={max}
        step={step}
        thumbMode={thumbMode}
        trackDisplayMode={!reversed ? "auto" : "odd-segments"
        }
        disabled={disabled}
        minLabel=""
        maxLabel=""
        tooltipProps={tooltipProps}
        tickLabels={tickLabels}
        onChange={onChange}
        onUpdate={onUpdate}
      />
      {showMinMax &&
        <MinMax value={max} testId="core-slider-max" image={maxImage} format={formatMax} />
      }
    </div>
  );
}

/** Properties for [[MinMax]] component */
interface MinMaxProps {
  value: number;
  testId: string;
  image?: React.ReactNode;
  format?: (value: number) => string;
}

/** MinMax component for Slider */
function MinMax(props: MinMaxProps) {
  const { value, testId, image, format } = props;
  let element: React.ReactElement<any>;
  const displayValue = format !== undefined ? format(value) : value;

  if (image)
    element = <>{image}</>;
  else
    element = <BodyText className="core-slider-minmax" data-testid={testId}>{displayValue}</BodyText>;

  return element;
}
