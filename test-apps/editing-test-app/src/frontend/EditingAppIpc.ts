/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IpcApp } from "@itwin/core-frontend";
import { editingAppChannel, EditingAppIpcInterface } from "../common/EditingAppIpcInterface";

function makeIpc<T>(channelName: string) {
  return new Proxy(class IpcBackend { }, {
    get(target, name, _receiver) {
      if (name === "prototype")
        return target[name];

      if (typeof name !== "string")
        return;

      return async (...args: any[]) => {
        return IpcApp.callIpcChannel(channelName, name, ...args);
      };
    },
  }) as unknown as T;
}

export const editingAppIpc = makeIpc<EditingAppIpcInterface>(editingAppChannel);
