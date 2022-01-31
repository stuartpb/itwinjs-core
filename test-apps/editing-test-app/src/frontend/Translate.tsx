/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";

export const localizationNamespace = "EditingApp";

export function translate(key: string) {
  return IModelApp.localization.getLocalizedStringWithNamespace(localizationNamespace, key);
}

export function useTranslated(key: string) {
  const [translated] = React.useState(() => translate(key));
  return translated;
}
