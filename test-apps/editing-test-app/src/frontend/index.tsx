/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";

import AppUi from "./AppUi";
import useInitialize from "./useInitialize";

function App() {
  const initialized = useInitialize();

  if (!initialized)
    return <>Initializing...</>;
  return <AppUi />;
}

(async function () {
  const container = document.getElementById("root");
  ReactDOM.render(<App />, container);
})();
