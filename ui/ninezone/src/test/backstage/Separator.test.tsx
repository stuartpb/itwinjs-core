/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { BackstageSeparator } from "../../ui-ninezone";

describe("<BackstageSeparator />", () => {
  it("should render", () => {
    mount(<BackstageSeparator />);
  });

  it("renders correctly", () => {
    shallow(<BackstageSeparator />).should.matchSnapshot();
  });
});
