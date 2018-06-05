/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { EntityState } from "./EntityState";
import { Point2d } from "@bentley/geometry-core";
import { ModelProps, GeometricModel2dProps, AxisAlignedBox3d, RelatedElement, TileTreeProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTree } from "./tile/TileTree";

/** the state of a Model */
export class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public parentModel: Id64;
  public readonly jsonProperties: any;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelConnection) {
    super(props, iModel);
    this.modeledElement = RelatedElement.fromJSON(props.modeledElement)!;
    this.name = props.name ? props.name : "";
    this.parentModel = Id64.fromJSON(props.parentModel)!; // NB! Must always match the model of the modeledElement!
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    val.parentModel = this.parentModel;
    val.name = this.name;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK

  public get isGeometricModel(): boolean { return false; }
}

/** the state of a geometric model */
export abstract class GeometricModelState extends ModelState {
  private _tileTree?: TileTree;
  private _loadStatus: TileTree.LoadStatus = TileTree.LoadStatus.NotLoaded;

  public abstract get is3d(): boolean;
  public get is2d(): boolean { return !this.is3d; }
  public get tileTree(): TileTree | undefined { return this._tileTree; }
  public get isGeometricModel(): boolean { return true; }

  public loadTileTree(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded === this._loadStatus) {
      this._loadStatus = TileTree.LoadStatus.Loading;
      const ids = Id64.toIdSet(this.id);
      this.iModel.tiles.getTileTreeProps(ids).then((result: TileTreeProps[]) => {
        this.setTileTree(result[0]);
        IModelApp.viewManager.onNewTilesReady();
      }).catch((_err) => {
        this._loadStatus = TileTree.LoadStatus.NotFound;
      });
    }

    return this._loadStatus;
  }

  protected constructor(props: ModelProps, iModel: IModelConnection) { super(props, iModel); }

  private setTileTree(props: TileTreeProps) {
    this._tileTree = new TileTree(TileTree.Params.fromJSON(props, this));
    this._loadStatus = TileTree.LoadStatus.Loaded;
  }
}

/** the state of a 2d Geometric Model */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public get is3d(): boolean { return false; }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** the state of a 3d geometric model */
export class GeometricModel3dState extends GeometricModelState {
  public get is3d(): boolean { return true; }

  public constructor(props: ModelProps, iModel: IModelConnection) { super(props, iModel); }
}

export class SpatialModelState extends GeometricModel3dState { }
export class DrawingModelState extends GeometricModel2dState { }
export class SectionDrawingModelState extends DrawingModelState { }
export class SheetModelState extends GeometricModel2dState { }
export class WebMercatorModel extends SpatialModelState { }
