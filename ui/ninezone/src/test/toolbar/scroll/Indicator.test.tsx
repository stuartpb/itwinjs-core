/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Indicator } from "../../../ui-ninezone";
import { Direction } from "../../../ui-ninezone";

describe("<Indicator />", () => {
  it("should render", () => {
    mount(<Indicator direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Indicator direction={Direction.Left} />).should.matchSnapshot();
  });
});
