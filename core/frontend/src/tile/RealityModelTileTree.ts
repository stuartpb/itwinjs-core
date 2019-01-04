/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { IModelError, TileTreeProps, TileProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { BentleyStatus, assert, Guid, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d, Matrix3d } from "@bentley/geometry-core";
import { RealityDataServicesClient, AccessToken, getArrayBuffer, getJson } from "@bentley/imodeljs-clients";
import { TileTree, TileTreeState, Tile, TileLoader } from "./TileTree";
import { TileRequest } from "./TileRequest";
import { IModelApp } from "../IModelApp";

/** @hidden */
export class RealityModelTileUtils {
  public static rangeFromBoundingVolume(boundingVolume: any): Range3d | undefined {
    if (undefined === boundingVolume || !Array.isArray(boundingVolume.box))
      return undefined;
    const box: number[] = boundingVolume.box;
    const center = Point3d.create(box[0], box[1], box[2]);
    const ux = Vector3d.create(box[3], box[4], box[5]);
    const uy = Vector3d.create(box[6], box[7], box[8]);
    const uz = Vector3d.create(box[9], box[10], box[11]);
    const corners: Point3d[] = [];
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        for (let l = 0; l < 2; l++) {
          corners.push(center.plus3Scaled(ux, (j ? -1.0 : 1.0), uy, (k ? -1.0 : 1.0), uz, (l ? -1.0 : 1.0)));
        }
      }
    }
    return Range3d.createArray(corners);
  }
  public static maximumSizeFromGeometricTolerance(range: Range3d, geometricError: number): number {
    const minToleranceRatio = .5;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  public static transformFromJson(jTrans: number[] | undefined): Transform {
    return (jTrans === undefined) ? Transform.createIdentity() : Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), Matrix3d.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
  }
}

/** @hidden */
class RealityModelTileTreeProps implements TileTreeProps {
  public id: string = "";
  public rootTile: TileProps;
  public location: TransformProps;
  public tilesetJson: object;
  public yAxisUp: boolean = false;
  constructor(json: any, public client: RealityModelTileClient, tileToDb: Transform) {
    this.tilesetJson = json.root;
    this.rootTile = new RealityModelTileProps(json.root, "");
    this.location = tileToDb.toJSON();
    if (json.asset.gltfUpAxis === undefined || json.asset.gltfUpAxis === "y")
      this.yAxisUp = true;
  }
}

/** @hidden */
class RealityModelTileProps implements TileProps {
  public readonly contentId: string;
  public readonly range: Range3dProps;
  public readonly contentRange?: Range3dProps;
  public readonly maximumSize: number;
  public readonly isLeaf: boolean;
  public geometry?: string | ArrayBuffer;
  public hasContents: boolean;
  constructor(json: any, thisId: string) {
    this.contentId = thisId;
    this.range = RealityModelTileUtils.rangeFromBoundingVolume(json.boundingVolume)!;
    this.isLeaf = !Array.isArray(json.children) || 0 === json.children.length;
    this.hasContents = undefined !== json.content && undefined !== json.content.url;
    if (this.hasContents) {
      this.contentRange = json.content.boundingVolume && RealityModelTileUtils.rangeFromBoundingVolume(json.content.boundingVolume);
      this.maximumSize = RealityModelTileUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError);
    } else {
      this.maximumSize = 0.0;
    }
  }
}

/** @hidden */
class FindChildResult {
  constructor(public id: string, public json: any) { }
}

/** @hidden */
class RealityModelTileLoader extends TileLoader {
  constructor(private _tree: RealityModelTileTreeProps) { super(); }
  public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
  public get priority(): Tile.LoadPriority { return Tile.LoadPriority.Context; }
  public tileRequiresLoading(params: Tile.Params): boolean { return 0.0 !== params.maximumSize; }
  public async getChildrenProps(parent: Tile): Promise<TileProps[]> {
    const props: RealityModelTileProps[] = [];

    const thisId = parent.contentId;
    const prefix = thisId.length ? thisId + "_" : "";
    const json = await this.findTileInJson(this._tree.tilesetJson, thisId, "");
    if (undefined !== json && Array.isArray(json.json.children)) {
      for (let i = 0; i < json.json.children.length; i++) {
        const childId = prefix + i;
        const foundChild = await this.findTileInJson(this._tree.tilesetJson, childId, "");
        if (undefined !== foundChild)
          props.push(new RealityModelTileProps(foundChild.json, foundChild.id));
      }
    }

    return props;
  }
  public async requestTileContent(tile: Tile): Promise<TileRequest.Response> {
    const foundChild = await this.findTileInJson(this._tree.tilesetJson, tile.contentId, "");
    if (undefined === foundChild)
      return undefined;

    return this._tree.client.getTileContent(foundChild.json.content.url);
  }

  private async findTileInJson(tilesetJson: any, id: string, parentId: string): Promise<FindChildResult | undefined> {
    if (id.length === 0)
      return new FindChildResult(id, tilesetJson);    // Root.
    const separatorIndex = id.indexOf("_");
    const childId = (separatorIndex < 0) ? id : id.substring(0, separatorIndex);
    const childIndex = parseInt(childId, 10);

    if (isNaN(childIndex) || tilesetJson === undefined || tilesetJson.children === undefined || childIndex >= tilesetJson.children.length) {
      assert(false, "scalable mesh child not found.");
      return undefined;
    }

    let foundChild = tilesetJson.children[childIndex];
    const thisParentId = parentId.length ? (parentId + "_" + childId) : childId;
    if (separatorIndex >= 0) { return this.findTileInJson(foundChild, id.substring(separatorIndex + 1), thisParentId); }
    if (undefined !== foundChild.content && foundChild.content.url.endsWith("json")) {    // A child may contain a subTree...
      const subTree = await this._tree.client.getTileJson(foundChild.content.url);
      foundChild = subTree.root;
      tilesetJson.children[childIndex] = subTree.root;
    }
    return new FindChildResult(thisParentId, foundChild);
  }
}

/** @hidden */
export class RealityModelTileTree {
  public static loadRealityModelTileTree(url: string, tilesetToDb: any, tileTreeState: TileTreeState): void {

    this.getTileTreeProps(url, tilesetToDb, tileTreeState.iModel).then((tileTreeProps: RealityModelTileTreeProps) => {
      tileTreeState.setTileTree(tileTreeProps, new RealityModelTileLoader(tileTreeProps));
      IModelApp.viewManager.onNewTilesReady();
    }).catch((_err) => tileTreeState.loadStatus = TileTree.LoadStatus.NotFound);
  }

  private static async getTileTreeProps(url: string, tilesetToDbJson: any, iModel: IModelConnection): Promise<RealityModelTileTreeProps> {
    if (undefined !== url && undefined !== IModelApp.accessToken) {
      const tileClient = new RealityModelTileClient(url, IModelApp.accessToken);
      const json = await tileClient.getRootDocument(url);
      const ecefLocation = iModel.ecefLocation;
      const rootTransform: Transform = RealityModelTileUtils.transformFromJson(json.root.transform);
      let tilesetToDb = Transform.createIdentity();

      if (undefined !== tilesetToDbJson) {
        tilesetToDb.setFromJSON(tilesetToDbJson);
      } else if (ecefLocation !== undefined) {
        const dbToEcef = Transform.createOriginAndMatrix(ecefLocation.origin, ecefLocation.orientation.toMatrix3d());
        tilesetToDb = dbToEcef.inverse() as Transform;
      }
      const tileToDb = Transform.createIdentity();
      tileToDb.setMultiplyTransformTransform(tilesetToDb, rootTransform);
      return new RealityModelTileTreeProps(json, tileClient, tileToDb);
    } else {
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");
    }
  }
}

interface RDSClientProps {
  projectId: string;
  tilesId: string;
}

/**
 * ###TODO temporarly here for testing, needs to be moved to the clients repo
 * @hidden
 */
export class RealityModelTileClient {
  public readonly rdsProps?: RDSClientProps;
  private _baseUrl: string = "";
  private readonly _token: AccessToken;
  private static _client = new RealityDataServicesClient();

  // ###TODO we should be able to pass the projectId / tileId directly, instead of parsing the url
  constructor(url: string, accessToken: AccessToken) {
    this.rdsProps = this.parseUrl(url);
    this._token = accessToken;
  }

  // ###TODO temporary means of extracting the tileId and projectId from the given url
  private parseUrl(url: string): RDSClientProps | undefined {
    const urlParts = url.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
    const tilesId = urlParts.find(Guid.isGuid);
    let props: RDSClientProps | undefined;
    if (undefined !== tilesId) {
      let projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];

      // ###TODO This is a temporary workaround for accessing the reality meshes with a test account
      // The hardcoded project id corresponds to a project setup to yied access to the test account which is linked to the tileId
      if (projectId === "Server")
        projectId = "fb1696c8-c074-4c76-a539-a5546e048cc6";

      props = { projectId, tilesId };
    }
    return props;
  }

  // this is only used for accessing locally served reality tiles.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    urlParts.pop();
    this._baseUrl = urlParts.join("/") + "/";
  }

  public async getRootDocument(url: string): Promise<any> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    if (undefined !== this.rdsProps)
      return RealityModelTileClient._client.getRootDocumentJson(alctx, this._token, this.rdsProps.projectId, this.rdsProps.tilesId);

    this.setBaseUrl(url);
    return getJson(alctx, url);
  }

  public async getTileContent(url: string): Promise<any> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    if (undefined !== this.rdsProps)
      return RealityModelTileClient._client.getTileContent(alctx, this._token, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    if (undefined !== this._baseUrl) {
      const tileUrl = this._baseUrl + url;
      return getArrayBuffer(alctx, tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data content url");
  }

  public async getTileJson(url: string): Promise<any> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    if (undefined !== this.rdsProps)
      return RealityModelTileClient._client.getTileJson(alctx, this._token, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    if (undefined !== this._baseUrl) {
      const tileUrl = this._baseUrl + url;
      return getJson(alctx, tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data json url");
  }
}
