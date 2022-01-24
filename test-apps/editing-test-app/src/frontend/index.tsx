/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";

function App() {
  return <div>Hello Editing Test App!</div>
}

(async function () {
  const container = document.getElementById("root");
  ReactDOM.render(<App />, container);
})();
