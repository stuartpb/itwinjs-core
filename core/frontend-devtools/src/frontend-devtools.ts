/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export * from "./ClipboardUtilities";
export * from "./FrontEndDevTools";

export * from "./tools/ChangeUnitsTool";
export * from "./tools/ChangeViewFlagsTool";
export * from "./tools/EmphasizeElementsTool";
export * from "./tools/FrustumDecoration";
export * from "./tools/InspectElementTool";
export * from "./tools/MeasureTileLoadTime";
export * from "./tools/parseToggle";
export * from "./tools/ProjectExtents";
export * from "./tools/RealityTransitionTool";
export * from "./tools/RenderSystemTools";
export * from "./tools/RenderTargetTools";
export * from "./tools/ReportWebGLCompatibilityTool";
export * from "./tools/SavedViews";
export * from "./tools/SelectionTools";
export * from "./tools/TileRequestDecoration";
export * from "./tools/ViewportTools";

export * from "./ui/Button";
export * from "./ui/CheckBox";
export * from "./ui/ColorInput";
export * from "./ui/ComboBox";
export * from "./ui/DataList";
export * from "./ui/NestedMenu";
export * from "./ui/NumericInput";
export * from "./ui/RadioBox";
export * from "./ui/Slider";
export * from "./ui/TextBox";

export * from "./widgets/DiagnosticsPanel";
export * from "./widgets/FpsTracker";
export * from "./widgets/GpuProfiler";
export * from "./widgets/KeyinField";
export * from "./widgets/MemoryTracker";
export * from "./widgets/TileStatisticsTracker";
export * from "./widgets/ToolSettingsTracker";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("frontend-devtools", BUILD_SEMVER);
}

/** @docs-package-description
 * The frontend-devtools package contains various tools and widgets for monitoring and debugging the front-end state of an iModel.js application.
 */

/**
 * @docs-group-description Widgets
 * Widgets that wrap some of the package's functionality into embeddable HTML controls.
 */

/**
 * @docs-group-description Tools
 * Interactive- and immediate-mode [tools]($docs/learning/frontend/Tools.md), most of which can be executed via key-in. All key-ins are documented in the package's README.
 */

/**
 * @docs-group-description Controls
 * Rudimentary HTML components used to build the widgets.
 */

/**
 * @docs-group-description Utilities
 * Utility functions used throughout the package.
 */
