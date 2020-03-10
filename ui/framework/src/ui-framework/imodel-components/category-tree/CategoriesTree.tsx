/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { useDisposable } from "@bentley/ui-core";
import { IModelConnection, IModelApp, ViewManager, Viewport, SpatialViewState } from "@bentley/imodeljs-frontend";
import { ControlledTree, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { Ruleset } from "@bentley/presentation-common";
import { CategoryVisibilityHandler, Category, useCategories, loadCategoriesFromViewport } from "./CategoryVisibilityHandler";
import { connectIModelConnection } from "../../redux/connectIModel";
import { useVisibilityTreeRenderer, useVisibilityTreeFiltering } from "../VisibilityTreeRenderer";
import { VisibilityTreeEventHandler, VisibilityTreeFilterInfo } from "../VisibilityTreeEventHandler";

import "./CategoriesTree.scss";

const PAGING_SIZE = 20;

/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_CATEGORIES: Ruleset = require("./Categories.json"); // tslint:disable-line: no-var-requires

/**
 * Properties for the [[CategoryTree]] component
 * @public
 */
export interface CategoryTreeProps {
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView?: Viewport;
  /**
   * An IModel to pull data from
   */
  iModel: IModelConnection;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Information for tree filtering.
   * @alpha
   */
  filterInfo?: VisibilityTreeFilterInfo;
  /**
   * Callback invoked when tree is filtered.
   */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
  /**
   * Custom category visibility handler to use for testing
   * @internal
   */
  categoryVisibilityHandler?: CategoryVisibilityHandler;
  /**
   * Custom view manager to use for testing
   * @internal
   */
  viewManager?: ViewManager;
}

/**
 * Tree which displays and manages categories contained in an iModel.
 * @public
 */
export function CategoryTree(props: CategoryTreeProps) {
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    dataProvider: props.dataProvider,
    ruleset: RULESET_CATEGORIES,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
  });

  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  const viewManager = props.viewManager ?? IModelApp.viewManager;
  const { activeView, allViewports, categoryVisibilityHandler } = props;
  const currentActiveView = activeView ?? viewManager.getFirstOpenView();
  const categories = useCategories(viewManager, props.iModel, currentActiveView);
  const visibilityHandler = useCategoryVisibilityHandler(viewManager, props.iModel, categories, currentActiveView, allViewports, categoryVisibilityHandler);

  React.useEffect(() => {
    setViewType(currentActiveView); // tslint:disable-line: no-floating-promises
  }, [currentActiveView]);

  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
  }), [filteredNodeLoader, visibilityHandler]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);

  const treeRenderer = useVisibilityTreeRenderer(false, true);
  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  return (
    <div className="ui-fw-categories-tree">
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        descriptionsEnabled={true}
        nodeHighlightingProps={nodeHighlightingProps}
      />
      {overlay}
    </div>
  );
}

/**
 * CategoryTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedCategoryTree = connectIModelConnection(null, null)(CategoryTree); // tslint:disable-line:variable-name

function useCategoryVisibilityHandler(viewManager: ViewManager, imodel: IModelConnection, categories: Category[], activeView?: Viewport, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  return useDisposable(React.useCallback(
    () => visibilityHandler ?? new CategoryVisibilityHandler({ viewManager, imodel, categories, activeView, allViewports }),
    [viewManager, imodel, categories, activeView, allViewports, visibilityHandler]),
  );
}

async function setViewType(activeView?: Viewport) {
  if (!activeView)
    return;

  const view = activeView.view as SpatialViewState;
  const viewType = view.is3d() ? "3d" : "2d";
  await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", viewType);
}

/**
 * Toggles visibility of categories to show or hide.
 * @alpha
 */
export async function toggleAllCategories(viewManager: ViewManager, imodel: IModelConnection, display: boolean, viewport?: Viewport, forAllViewports?: boolean, filteredProvider?: IPresentationTreeDataProvider) {
  const activeView = viewport ?? viewManager.getFirstOpenView();
  const ids = await getCategories(imodel, activeView, filteredProvider);

  // istanbul ignore else
  if (ids.length > 0) {
    CategoryVisibilityHandler.enableCategory(viewManager, imodel, ids, display, forAllViewports ?? false);
  }
}

/**
 * Gets ids of all categories or categories from filtered data provider.
 * @alpha
 */
export async function getCategories(imodel: IModelConnection, viewport?: Viewport, filteredProvider?: IPresentationTreeDataProvider) {
  if (filteredProvider) {
    const nodes = await filteredProvider.getNodes();
    return nodes.map((node) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
  }

  const categories = await loadCategoriesFromViewport(imodel, viewport);
  return categories.map((category) => category.key);
}
