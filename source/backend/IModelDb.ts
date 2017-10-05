/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ClassRegistry } from "../ClassRegistry";
import { Code } from "../Code";
import { Element, ElementLoadParams, ElementProps } from "../Element";
import { ElementAspect, ElementAspectProps, ElementMultiAspect, ElementUniqueAspect } from "../ElementAspect";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { Model, ModelProps } from "../Model";
import { BriefcaseManager, BriefcaseToken, KeepBriefcase } from "./BriefcaseManager";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelError, IModelStatus } from "../IModelError";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BindingValue } from "./BindingUtility";
import { CodeSpecs } from "./CodeSpecs";

class CachedECSqlStatement {
  public statement: ECSqlStatement;
  public useCount: number;
}

class ECSqlStatementCache {
  private statements: Map<string, CachedECSqlStatement> = new Map<string, CachedECSqlStatement>();

  public add(str: string, stmt: ECSqlStatement): void {

    assert(!stmt.isShared(), "when you add a statement to the cache, the cache takes ownership of it. You can't add a statement that is already being shared in some other way");
    assert(stmt.isPrepared(), "you must cache only cached statements.");

    const existing = this.statements.get(str);
    if (existing !== undefined) {
      assert(existing.useCount > 0, "you should only add a statement if all existing copies of it are in use.");
    }
    const cs = new CachedECSqlStatement();
    cs.statement = stmt;
    cs.statement.setIsShared(true);
    cs.useCount = 1;
    this.statements.set(str, cs);
  }

  public getCount(): number {
    return this.statements.size;
  }

  public find(str: string): CachedECSqlStatement | undefined {
    return this.statements.get(str);
  }

  public release(stmt: ECSqlStatement): void {
    for (const cs of this.statements) {
      const css = cs[1];
      if (css.statement === stmt) {
        if (css.useCount > 0) {
          css.useCount--;
          if (css.useCount === 0) {
            css.statement.reset();
            css.statement.clearBindings();
          }
        } else {
          assert(false, "double-release of cached statement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        // *** TODO: we should remove it if it is a duplicate of another unused statement in the cache. The trouble is that we don't have the ecsql for the statement,
        //           so we can't check for other equivalent statements.
        break;
      }
    }
  }

  public removeUnusedStatements(targetCount: number) {
    const keysToRemove = [];
    for (const cs of this.statements) {
      const css = cs[1];
      assert(css.statement.isShared());
      assert(css.statement.isPrepared());
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= targetCount)
          break;
      }
    }
    for (const k of keysToRemove) {
      this.statements.delete(k);
    }
  }

  public clearOnClose() {
    for (const cs of this.statements) {
      assert(cs[1].useCount === 0, "statement was never released: " + cs[0]);
      assert(cs[1].statement.isShared());
      assert(cs[1].statement.isPrepared());
      const stmt = cs[1].statement;
      if (stmt !== undefined) {
        stmt.setIsShared(false);
        stmt.dispose();
      }
    }
    this.statements.clear();
  }
}

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  public models: IModelDbModels;
  public elements: IModelDbElements;
  private statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _maxStatementCacheCount = 20;
  private static _openDbMap: Map<string, IModelDb> = new Map<string, IModelDb>();
  private _codeSpecs: CodeSpecs;

  private constructor() {
    super();
    this.models = new IModelDbModels(this);
    this.elements = new IModelDbElements(this);
  }

  /** Open the iModel from a local file
   * @param fileName The file name of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static async openStandalone(fileName: string, openMode: OpenMode = OpenMode.ReadWrite): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.openStandalone(fileName, openMode);
    IModelDb._openDbMap.set(iModel._briefcaseKey.pathname, iModel);
    return iModel;
  }

  /**
   * Prepare an ECSql statement.
   * @param ecsql The ECSql statement to prepare
   */
  public prepareECSqlStatement(ecsql: string): ECSqlStatement {
    if (!this.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);
    return BriefcaseManager.prepareECSqlStatement(this.briefcaseKey!, ecsql);
  }

  /**
   * Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   */
  public getPreparedECSqlStatement(ecsql: string): ECSqlStatement {
    const cs = this.statementCache.find(ecsql);
    if (cs !== undefined && cs.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cs.statement.isShared());
      assert(cs.statement.isPrepared());
      cs.useCount++;
      return cs.statement;
    }

    if (this.statementCache.getCount() > this._maxStatementCacheCount) {
      this.statementCache.removeUnusedStatements(this._maxStatementCacheCount);
    }

    const stmt = this.prepareECSqlStatement(ecsql);
    this.statementCache.add(ecsql, stmt);
    return stmt;
  }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param ecsql The ECSql statement to execute
   * @param cb the callback to invoke on the prepared statement
   * @return the value returned by cb
   */
  public withPreparedECSqlStatement<T>(ecsql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedECSqlStatement(ecsql);
    try {
      const val: T = cb(stmt);
      this.releasePreparedECSqlStatement(stmt);
      return val;
    } catch (err) {
      this.releasePreparedECSqlStatement(stmt);
      throw err;
    }
  }

  /** Execute a query against this iModel (overridden to improve performance)
   * @param sql The ECSql statement to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns all rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public async executeQuery(sql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): Promise<any[]> {
    return this.withPreparedECSqlStatement(sql, (stmt: ECSqlStatement) => {
      if (bindings !== undefined)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
      }
      return rows;
    });
  }

  /**
   * Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   */
  public releasePreparedECSqlStatement(stmt: ECSqlStatement): void {
    this.statementCache.release(stmt);
  }

  public clearStatementCacheOnClose(): void {
    this.statementCache.clearOnClose();
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone() {
    this.clearStatementCacheOnClose();
    if (!this.briefcaseKey)
      return;

    BriefcaseManager.closeStandalone(this.briefcaseKey);
    IModelDb._openDbMap.delete(this.briefcaseKey.pathname);
  }

  /** Commit pending changes to this iModel */
  public saveChanges() {
    if (!this.briefcaseKey)
      throw new IModelError(DbResult.BE_SQLITE_ERROR);
    BriefcaseManager.saveChanges(this.briefcaseKey);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    IModelDb._openDbMap.set(iModel._briefcaseKey.pathname, iModel);
    return iModel;
  }

  /** Close this iModel, if it is currently open. */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    this.clearStatementCacheOnClose();
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
    IModelDb._openDbMap.delete(this.briefcaseKey.pathname);
  }

  /** Find an already open IModelDb from its token. Used by the remoting logic.
   * @hidden
   */
  public static find(token: BriefcaseToken): IModelDb {
    const iModel: IModelDb | undefined = IModelDb._openDbMap.get(token.pathname);
    if (!iModel)
      throw new IModelError(IModelStatus.NotFound);

    return iModel;
  }

  /** Get access to the CodeSpecs in this IModel */
  public get codeSpecs(): CodeSpecs {
    if (this._codeSpecs === undefined)
      this._codeSpecs = new CodeSpecs(this);
    return this._codeSpecs;
  }

}

/** The collection of models in an [[IModelDb]]. */
export class IModelDbModels {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Model>;

  /** @hidden */
  public constructor(iModel: IModelDb, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public async getModel(modelId: Id64): Promise<Model> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    // Must go get the model from the iModel. Start by requesting the model's data.
    const json: string = await BriefcaseManager.getModel(this._iModel.briefcaseKey, JSON.stringify({ id: modelId }));
    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
    assert(entity instanceof Model);
    const model = entity as Model;

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(model.id.toString(), model);
    return model;
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public async getSubModel(modeledElementId: Id64 | Guid | Code): Promise<Model> {
    const modeledElement: Element = await this._iModel.elements.getElement(modeledElementId);
    if (modeledElement.id.equals(this._iModel.elements.rootSubjectId))
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    return this.getModel(modeledElement.id);
  }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }
}

/** The collection of elements in an [[IModelDb]]. */
export class IModelDbElements {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  /** @hidden */
  public constructor(iModel: IModelDb, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElement */
  private async _doGetElement(opts: ElementLoadParams): Promise<Element> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const json = await BriefcaseManager.getElement(this._iModel.briefcaseKey, JSON.stringify(opts));
    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
    const el = entity as Element;
    assert(el instanceof Element);

    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(el.id.toString(), el);
    return el;
  }

  /** Get an element by Id, FederationGuid, or Code
   * @throws [[IModelError]] if the element is not found.
   */
  public getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this._doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this._doGetElement({ federationGuid: elementId.toString() });
    if (elementId instanceof Code) return this._doGetElement({ code: elementId });
    assert(false);
    return Promise.reject(new IModelError(IModelStatus.BadArg));
  }

  /** Create a new element in memory.
   * @param elementProps The properties to use when creating the element.
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public async createElement(elementProps: ElementProps): Promise<Element> {
    const element: Element = await ClassRegistry.createInstance(elementProps) as Element;
    assert(element instanceof Element);
    return element;
  }

  /** Create a new element in memory.
   * @param elementProps The properties to use when creating the element.
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public createElementSync(elementProps: ElementProps): Element {
    const element: Element = ClassRegistry.createInstanceSync(elementProps) as Element;
    assert(element instanceof Element);
    return element;
  }

  /** Insert a new element.
   * @param el The data for the new element.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public insertElement(el: Element): Id64 {
    if (!this._iModel.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return new Id64();
    }
    const json: string = BriefcaseManager.insertElement(this._iModel.briefcaseKey, JSON.stringify(el));
    return new Id64(JSON.parse(json).id);
  }

  /** Update an existing element.
   * @param el An editable copy of the element, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the element.
   */
  public async updateElement(el: Element): Promise<void> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return;
    }
    await BriefcaseManager.updateElement(this._iModel.briefcaseKey, JSON.stringify(el));

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(el.id.toString());
  }

  /** Delete an existing element.
   * @param el The element to be deleted
   * @throws [[IModelError]]
   */
  public async deleteElement(el: Element): Promise<void> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    await BriefcaseManager.deleteElement(this._iModel.briefcaseKey, el.id.toString());

    // Discard from the cache
    this._loaded.delete(el.id.toString());
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public async queryChildren(elementId: Id64): Promise<Id64[]> {
    const rows: any[] = await this._iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=?", [elementId]);
    const childIds: Id64[] = [];
    for (const row of rows) {
      childIds.push(new Id64(row.id));
    }
    return Promise.resolve(childIds);
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public getRootSubject(): Promise<Element> { return this.getElement(this.rootSubjectId); }

  /** Query for aspects rows (by aspect class name) associated with this element.
   * @throws [[IModelError]]
   */
  private async _queryAspects(elementId: Id64, aspectClassName: string): Promise<ElementAspect[]> {
    const name = aspectClassName.split(":");
    const rows: any[] = await this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=?", [elementId]);
    if (rows.length === 0)
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    const aspects: ElementAspect[] = [];
    for (const row of rows) {
      const aspectProps: ElementAspectProps = row; // start with everything that SELECT * returned
      aspectProps.classFullName = aspectClassName; // add in property required by EntityProps
      aspectProps.iModel = this._iModel; // add in property required by EntityProps
      aspectProps.element = elementId; // add in property required by ElementAspectProps
      aspectProps.classId = undefined; // clear property from SELECT * that we don't want in the final instance

      const entity = await ClassRegistry.createInstance(aspectProps);
      assert(entity instanceof ElementAspect);
      const aspect = entity as ElementAspect;
      aspect.setPersistent();
      aspects.push(aspect);
    }

    return aspects;
  }

  /** Get an ElementUniqueAspect instance (by class name) that is related to the specified element.
   * @throws [[IModelError]]
   */
  public async getUniqueAspect(elementId: Id64, aspectClassName: string): Promise<ElementUniqueAspect> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    assert(aspects[0] instanceof ElementUniqueAspect);
    return aspects[0];
  }

  /** Get the ElementMultiAspect instances (by class name) that are related to the specified element.
   * @throws [[IModelError]]
   */
  public async getMultiAspects(elementId: Id64, aspectClassName: string): Promise<ElementMultiAspect[]> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    return aspects;
  }
}
