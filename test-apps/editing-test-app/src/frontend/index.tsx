/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { ProgressLinear } from "@itwin/itwinui-react";

import AppUi from "./AppUi";
import useInitialize from "./useInitialize";

function LoadingIndicator() {
  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      margin: "0 20%",
    }}>
      <ProgressLinear
        indeterminate={true}
        labels={[
          "Initializing...",
        ]}
      />
    </div>
  );
}

function App() {
  const initialized = useInitialize();

  if (!initialized)
    return <LoadingIndicator />;
  return <AppUi />;
}

(async function () {
  const container = document.getElementById("root");
  ReactDOM.render(<App />, container);
})();
