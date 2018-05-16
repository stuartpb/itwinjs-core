/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import { memoize, MemoizedFunction } from "lodash";
import { assert } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import ContentDataProvider, { CacheInvalidationProps } from "../common/ContentDataProvider";
import ContentBuilder, { PropertyDescription } from "../common/ContentBuilder";
import * as content from "@bentley/ecpresentation-common/lib/content";
import { InstanceKey, KeySet, PageOptions } from "@bentley/ecpresentation-common";

// wip: workaround for TS4029 and TS6133
export type MemoizedFunction = MemoizedFunction;

// note: I expect the below types to be defined somewhere outside ecpresentation repository

export enum SortDirection {
  Ascending,
  Descending,
}

export interface ColumnDescription {
  key: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  description?: PropertyDescription;
}

export interface CellItem {
  key: string;
  value: any;
  displayValue: any;
  isDisabled: boolean;
  isBold: boolean;
  isItalic: boolean;
}

export interface RowItem {
  key: InstanceKey;
  cells: CellItem[];
}

interface PagePosition {
  index: number;
  start: number;
  end: number;
}

class Page {
  private readonly _position: PagePosition;
  private readonly _content: Promise<content.Content>;
  private _rows: Array<Readonly<RowItem>> | undefined;

  constructor(position: PagePosition, contentPromise: Promise<content.Content>) {
    this._position = position;
    this._content = contentPromise;
  }

  public get position(): Readonly<PagePosition> { return this._position; }

  public get rows(): Array<Readonly<RowItem>> | undefined { return this._rows; }

  public getRows = memoize(async (): Promise<Array<Readonly<RowItem>>> => {
    const c = await this._content;
    this._rows = this.createRows(c);
    return this._rows;
  });

  private createRows(c: content.Content): RowItem[] {
    const pageSize = this._position.end - this._position.start;
    const rows = new Array<RowItem>();
    for (let i = 0; i < c.contentSet.length && i < pageSize; ++i) {
      const row = Page.createRowItemFromContentRecord(c.descriptor, c.contentSet[i]);
      rows.push(row);
    }
    return rows;
  }

  private static createRowItemFromContentRecord(descriptor: content.Descriptor, record: content.Item): RowItem {
    // note: for table view we expect the record to always have only 1 primary key
    assert(1 === record.primaryKeys.length);

    const row: RowItem = {
      key: record.primaryKeys[0],
      cells: new Array<CellItem>(),
    };

    for (const cellKey in record.values) {
      if (!record.values.hasOwnProperty(cellKey))
        continue;

      const field = getFieldByName(descriptor, cellKey);
      if (!field) {
        assert(false, "Record contains property '" + cellKey + "' which is not defined in ContentDescriptor");
        continue;
      }

      const cell: CellItem = {
        key: cellKey,
        value: ContentBuilder.createPropertyRecord(field, record),
        displayValue: record.displayValues[cellKey],
        isDisabled: false,
        isBold: false,
        isItalic: false,
      };

      row.cells.push(cell);
    }

    return row;
  }
}

class PageContainer {
  private _pageSize: number;
  private _maxPages: number;
  private _pages: Page[] = [];

  constructor(pageSize: number, maxPages: number) {
    this._pageSize = pageSize;
    this._maxPages = maxPages;
  }

  public get pageSize() { return this._pageSize; }
  public set pageSize(value: number) {
    this._pageSize = value;
    this.invalidatePages();
  }

  public invalidatePages(): void { this._pages = []; }

  public getPage(index: number): Readonly<Page> | undefined {
    for (const page of this._pages) {
      if (page.position.start <= index && index < page.position.end)
        return page;
    }
    return undefined;
  }

  public getRow(index: number): Readonly<RowItem> | undefined {
    const page = this.getPage(index);
    if (!page || !page.rows)
      return undefined;
    return page.rows[index - page.position.start];
  }

  public getIndex(item: RowItem): number {
    for (const page of this._pages) {
      if (!page.rows)
        continue;
      for (let i = 0; i < page.rows.length; ++i) {
        const row = page.rows[i];
        if (row === item)
          return page.position.start + i;
      }
    }
    return -1;
  }

  public reservePage(index: number): PagePosition {
    // find the place for the new page to insert
    let pageIndex: number = 0;
    for (const page of this._pages) {
      if (page.position.start > index)
        break;
      pageIndex++;
    }
    const pageBefore = (pageIndex > 0) ? this._pages[pageIndex - 1] : undefined;
    const pageAfter = (pageIndex < this._pages.length) ? this._pages[pageIndex] : undefined;

    // determine the start of the page for the specified index
    let pageStartIndex = index;
    let pageSize = this.pageSize;
    if (undefined !== pageAfter && pageStartIndex > pageAfter.position.start - this.pageSize) {
      pageStartIndex = pageAfter.position.start - this.pageSize;
    }
    if (undefined !== pageBefore && pageBefore.position.end > pageStartIndex) {
      pageStartIndex = pageBefore.position.end;
      pageSize = pageAfter!.position.start - pageBefore.position.end;
    }
    if (pageStartIndex < 0)
      pageStartIndex = 0;
    if (pageSize < 0) {
      assert(false, "Invalid page size");
      pageSize = 1;
    }

    return {
      index: pageIndex,
      start: pageStartIndex,
      end: pageStartIndex + pageSize,
    };
  }

  public createPage(position: PagePosition, contentPromise: Promise<content.Content>): Page {
    // create the new page
    const newPage = new Page(position, contentPromise);
    this._pages.splice(position.index, 0, newPage);

    // dispose old pages, if necessary
    if (this._pages.length > this._maxPages) {
      // we drop the page that's furthest from the newly created one
      const distanceToFront = position.index;
      const distanceToBack = this._pages.length - position.index - 1;
      if (distanceToBack > distanceToFront)
        this._pages.pop();
      else
        this._pages.splice(0, 1);
    }

    return newPage;
  }
}

const getFieldByName = (descriptor: content.Descriptor, name: string): content.Field | undefined => {
  for (const field of descriptor.fields) {
    if (field.name === name)
      return field;
  }
  return undefined;
};

export default class GridDataProvider extends ContentDataProvider {
  private _sortColumnKey: string | undefined;
  private _sortDirection: SortDirection = SortDirection.Ascending;
  private _filterExpression: string | undefined;
  private _pages: PageContainer;
  private _keys: Readonly<KeySet>;

  /** Constructor. */
  constructor(imodelToken: IModelToken, rulesetId: string, pageSize: number = 20, cachedPagesCount: number = 5) {
    super(imodelToken, rulesetId, content.DefaultContentDisplayTypes.GRID);
    this._pages = new PageContainer(pageSize, cachedPagesCount);
    this._keys = new KeySet();
  }

  protected invalidateCache(props: CacheInvalidationProps): void {
    if (props.descriptor) {
      this._filterExpression = undefined;
      this._sortColumnKey = undefined;
      this._sortDirection = SortDirection.Ascending;
      if (this.getColumns)
        this.getColumns.cache.clear();
    }

    if (props.size && this.getRowsCount)
      this.getRowsCount.cache.clear();

    if (props.content && this.getRow)
      this.getRow.cache.clear();

    if ((props.size || props.content) && this._pages)
      this._pages.invalidatePages();

    super.invalidateCache(props);
  }

  /** Handles filtering and sorting. */
  protected configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    const configured = super.configureContentDescriptor(descriptor);
    if (this._sortColumnKey) {
      const sortingField = getFieldByName(descriptor, this._sortColumnKey);
      if (sortingField) {
        configured.sortingField = sortingField;
        configured.sortDirection = this._sortDirection;
      }
    }
    configured.filterExpression = this._filterExpression;
    return configured;
  }

  /** Sorts the data in this data provider.
   * @param columnIndex Index of the column to sort on.
   * @param sortDirection Sorting direction.
   */
  public async sort(columnIndex: number, sortDirection: SortDirection): Promise<void> {
    const columns = await this.getColumns();
    const sortingColumn = columns[columnIndex];
    if (!sortingColumn)
      throw new Error("Invalid column index");
    this._sortColumnKey = sortingColumn.key;
    this._sortDirection = sortDirection;
    this.invalidateCache({ content: true });
  }

  public get keys() { return this._keys; }
  public set keys(keys: Readonly<KeySet>) {
    this._keys = keys;
    this.invalidateCache({ descriptor: true, size: true, content: true });
  }

  /** Returns column definitions for the content. */
  public getColumns = memoize(async (): Promise<Array<Readonly<ColumnDescription>>> => {
    const descriptor = await this.getContentDescriptor(this.keys);
    const sortedFields = descriptor.fields.slice();
    sortedFields.sort((a: content.Field, b: content.Field): number => {
      if (a.priority > b.priority)
        return -1;
      if (a.priority < b.priority)
        return 1;
      return 0;
    });
    const cols = new Array<ColumnDescription>();
    for (const field of sortedFields) {
      const propertyDescription = ContentBuilder.createPropertyDescription(field);
      const columnDescription: ColumnDescription = {
        key: field.name,
        label: field.label,
        description: propertyDescription,
        sortable: true,
        editable: !field.isReadonly,
        filterable: (field.type.valueFormat === content.PropertyValueFormat.Primitive),
      };
      cols.push(columnDescription);
    }
    return cols;
  });

  /** Get the total number of rows in the content. */
  public getRowsCount = memoize(async (): Promise<number> => {
    return await this.getContentSetSize(this.keys);
  });

  /** Get a single row.
   * @param rowIndex Index of the row to return.
   */
  public getRow = memoize(async (rowIndex: number): Promise<Readonly<RowItem>> => {
    let page = this._pages.getPage(rowIndex);
    if (!page) {
      const position = this._pages.reservePage(rowIndex);
      page = this._pages.createPage(position, this.getContent(this.keys, undefined,
        { pageStart: position.start, pageSize: position.end - position.start } as PageOptions));
    }
    const rows = await page.getRows();
    return rows[rowIndex - page.position.start];
  });

  /** Try to get the loaded row. Returns undefined if the row is not currently cached.
   * @param rowIndex Index of the row to return.
   */
  public getLoadedRow(rowIndex: number): Readonly<RowItem> | undefined {
    return this._pages.getRow(rowIndex);
  }
}
