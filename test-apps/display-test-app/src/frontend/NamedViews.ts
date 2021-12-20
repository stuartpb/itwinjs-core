/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { compareStrings, SortedArray } from "@itwin/core-bentley";
import { GltfDecorationProps } from "@itwin/frontend-devtools";

// cspell:ignore vsps nvsp

export interface NamedView {
  _name: string;
  _viewStatePropsString: string;
  _selectedElements?: string;
  _overrideElements?: string;
  gltfDecoration?: GltfDecorationProps;
}

export class NamedViewList extends SortedArray<NamedView> {
  private constructor() {
    super((lhs, rhs) => compareStrings(lhs._name, rhs._name));
  }

  public static create(views?: NamedView[]): NamedViewList {
    const viewList = new NamedViewList();
    viewList.populate(views);
    return viewList;
  }

  public override clear(): void {
    super.clear();
  }

  public populate(views?: NamedView[]): void {
    this.clear();
    if (views)
      for (const view of views)
        this.insert(view);
  }

  public findName(name: string): number {
    return this._array.findIndex((x) => x._name === name);
  }

  public removeName(name: string): void {
    const view = this._array.find((x) => x._name === name);
    if (view)
      this.remove(view);
  }

  public getPrintString(): string {
    // We don't really want all of the other stuff from the SortedArray class in here, just the actual name/propertyString pairs.
    return JSON.stringify(this._array, null, "  ");
  }

  public loadFromString(esvString: string): void {
    this.clear();
    if (!esvString)
      return;

    const views = JSON.parse(esvString) as NamedView[];
    this.populate(views);
  }
}
