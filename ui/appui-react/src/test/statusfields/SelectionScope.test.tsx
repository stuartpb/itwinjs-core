/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { IModelApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { WidgetState } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, PresentationSelectionScope, SelectionScopeField, SessionStateActionId, StatusBar,
  StatusBarWidgetControl, StatusBarWidgetControlArgs, UiFramework, WidgetDef,
} from "../../appui-react";
import TestUtils, { handleError, selectChangeValueByIndex, stubScrollIntoView } from "../TestUtils";

class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <>
        <SelectionScopeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
      </>
    );
  }
}

describe("SelectionScopeField", () => {

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("SelectionScopeField with default data", () => {
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
    expect(selectElement).not.to.be.null;
    expect(UiFramework.getActiveSelectionScope()).to.be.equal("element");
  });

  it("SelectionScopeField with multiple scopes", async () => {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
      { id: "element", label: "Element" } as PresentationSelectionScope,
      { id: "assembly", label: "Assembly" } as PresentationSelectionScope,
      { id: "top-assembly", label: "Top Assembly" } as PresentationSelectionScope,
    ]);

    UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

    // UiFramework.frameworkState!.sessionState.availableSelectionScopes = 1;
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
    expect(selectElement).not.to.be.null;
    expect(UiFramework.getActiveSelectionScope()).to.be.equal("top-assembly");
    // expect(selectElement.selectedIndex).to.be.equal(2);
  });
});

// before we can test setting scope to a valid scope id we must make sure Presentation Manager is initialized.
describe("Test that requires Presentation", () => {

  let widgetControl: StatusBarWidgetControl | undefined;

  const shutdownIModelApp = async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  };

  before(async () => {
    await shutdownIModelApp();
    Presentation.terminate();

    await initializePresentationTesting();
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await terminatePresentationTesting();
  });

  stubScrollIntoView();

  it("SelectionScopeField with specific scopes", async () => {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
      { id: "element", label: "Element" } as PresentationSelectionScope,
      { id: "assembly", label: "Assembly" } as PresentationSelectionScope,
      { id: "top-assembly", label: "Top Assembly" } as PresentationSelectionScope,
    ]);

    UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

    // UiFramework.frameworkState!.sessionState.availableSelectionScopes = 1;
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
    expect(selectElement).not.to.be.null;
    selectChangeValueByIndex(selectElement, 1, handleError); // use index now that labels are localized in frontend
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.getActiveSelectionScope()).to.be.equal("assembly");
    // expect(selectElement.selectedIndex).to.be.equal(1);
  });
});
