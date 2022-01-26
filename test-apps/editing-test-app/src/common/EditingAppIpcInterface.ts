/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus } from "@itwin/core-bentley";

export const editingAppChannel = "editing-test-app";

export interface EditingAppIpcInterface {
  createEmptyModel(filePath: string): Promise<BentleyStatus>;
}
