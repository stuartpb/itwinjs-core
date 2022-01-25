/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  FooterModeField,
  MessageCenterField,
  SectionsStatusField,
  SelectionInfoField,
  SelectionScopeField,
  SnapModeField,
  StatusBarComposer, StatusBarItemUtilities, StatusBarWidgetControl, TileLoadingIndicator, ToolAssistanceField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { StatusBarSection } from "@itwin/appui-abstract";

const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
const SelectionScope = withStatusFieldProps(SelectionScopeField);
const FooterOnlyDisplay = withStatusFieldProps(FooterModeField);
const SnapMode = withStatusFieldProps(SnapModeField);
const SelectionInfo = withStatusFieldProps(SelectionInfoField);
const Sections = withStatusFieldProps(SectionsStatusField);

function Separator() {
  return (
    <FooterOnlyDisplay>
      <FooterSeparator />
    </FooterOnlyDisplay>
  );
};

function StatusBar() {
  const items = React.useMemo(() => [
    StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 10, <MessageCenter />),
    StatusBarItemUtilities.createStatusBarItem("PreToolAssistance", StatusBarSection.Left, 15, <Separator />),
    StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />),
    StatusBarItemUtilities.createStatusBarItem("PostToolAssistance", StatusBarSection.Left, 25, <Separator />),
    StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Left, 30, <Sections hideWhenUnused={true} />),
    StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />),
    StatusBarItemUtilities.createStatusBarItem("SnapModeField", StatusBarSection.Right, 20, <SnapMode />),
    StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 30, <SelectionScope />),
    StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 40, <SelectionInfo />),
  ], []);
  return (
    <StatusBarComposer items={items} />
  );
}

export default class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  public override getReactNode() {
    return (
      <StatusBar />
    );
  }
}
