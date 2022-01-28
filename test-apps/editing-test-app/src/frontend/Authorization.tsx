/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";

export function useAccessToken() {
  const [accessToken, setAccessToken] = React.useState<string>();
  React.useEffect(() => {
    (async function () {
      const authorizationClient = IModelApp.authorizationClient;
      try {
        const token = await authorizationClient?.getAccessToken();
        setAccessToken(token);
      } catch {
        setAccessToken("");
      }
    })();
  }, []);
  React.useEffect(() => {
    const authorizationClient = IModelApp.authorizationClient;
    if (!(authorizationClient instanceof ElectronRendererAuthorization))
      return;
    return authorizationClient.onAccessTokenChanged.addListener((token) => {
      setAccessToken(token);
    });
  }, []);
  return accessToken;
}

export function useRequiredAccessToken() {
  const accessToken = useAccessToken();
  React.useEffect(() => {
    const authorizationClient = IModelApp.authorizationClient;
    if (!(authorizationClient instanceof ElectronRendererAuthorization))
      return;
    if (authorizationClient.hasSignedIn)
      return;
    void authorizationClient.signIn();
  }, []);
  return accessToken;
}
