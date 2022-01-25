/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, Viewport } from "@itwin/core-frontend"

function updateActiveSettingsFromView(viewport: Viewport) {
  const view = viewport.view;
  const activeSettings = IModelApp.toolAdmin.activeSettings;

  // Currently selecting first category/model.
  activeSettings.category = undefined;
  for (const catId of view.categorySelector.categories) {
    activeSettings.category = catId;
    break;
  }

  if (view.is2d()) {
    activeSettings.model = view.baseModelId;
  } else if (view.isSpatialView()) {
    activeSettings.model = undefined;
    for (const modId of view.modelSelector.models) {
      activeSettings.model = modId;
      break;
    }
  }
}

export default function useActiveSettings() {
  React.useEffect(() => {
    return IModelApp.viewManager.onSelectedViewportChanged.addListener((args) => {
      const viewport = args.current;
      viewport && updateActiveSettingsFromView(viewport);
    });
  }, []);
}
