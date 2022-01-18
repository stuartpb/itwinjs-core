/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import "./SquareButton.scss";
import classnames from "classnames";
import * as React from "react";
import { Omit } from "@itwin/core-react";
import { Button, ButtonProps } from "@itwin/itwinui-react";

/** @alpha */
export interface SquareButtonProps extends Omit<ButtonProps, "size" | "styleType"> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/** @alpha */
export class SquareButton extends React.PureComponent<SquareButtonProps> {
  public override render() {
    const { className, ...buttonProps } = this.props;

    const buttonClassNames = classnames(
      "uifw-square-button",
      className,
    );

    const thisButtonProps: ButtonProps<"button"> = {
      ...buttonProps,
      className: buttonClassNames,
      size: "small",
    };

    return (
      <Button as="button" {...thisButtonProps} />
    );
  }
}
