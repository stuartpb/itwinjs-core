/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Sprite } from "./Sprites";
import { Point3d, Vector3d, RotMatrix, Point2d, Transform } from "@bentley/geometry-core/lib/PointVector";
import { HitDetail, SnapMode, SnapDetail } from "./HitDetail";
import { DecorationList, GraphicList, Decorations, Graphic, GraphicType, GraphicBuilder } from "../common/Render";

export class ViewContext {
  public viewport: Viewport;
}

export class NullContext extends ViewContext {
}

export class SnapContext extends ViewContext {
  public snapDetail?: SnapDetail; // result of the snap
  public snapAperture: number;
  public snapMode: SnapMode;
  public snapDivisor: number;

  public async snapToPath(_thisPath: HitDetail, _snapMode: SnapMode, _snapDivisor: number, _hotAperture: number): Promise<SnapDetail | undefined> {
    //   if (!ElementLocateManager.instance.isSnappableModel(thisPath.getModel())   {
    //       return undefined nullptr;
    //     return SnapStatus.ModelNotSnappable;
    //   }

    //   // test for un-snappable hits...ex. pattern, linestyle...
    //   GeomDetail const& detail = thisPath -> GetGeomDetail();

    //   if (!detail.IsSnappable())
    //     return SnapStatus:: NotSnappable;

    //   SnapStatus  status = SnapStatus:: NotSnappable;

    //   // attach the context
    //   Attach(& thisPath -> GetViewport(), DrawPurpose:: Pick);

    //   m_snapMode = snapMode;
    //   m_snapDivisor = snapDivisor ? snapDivisor : 2;
    //   m_snapPath = new SnapDetail(thisPath);
    //   m_snapAperture = hotAperture;

    //   m_snapPath -> AddRef();

    //   // Save divisor used for this snap
    //   m_snapPath -> SetSnapDivisor(snapDivisor);

    //   DgnElementCPtr   element = m_snapPath -> GetElement();
    //   GeometrySourceCP geom = (element.IsValid() ? element -> ToGeometrySource() : nullptr);

    //   if (nullptr == geom) {
    //     IElemTopologyCP elemTopo = m_snapPath -> GetElemTopology();

    //     geom = (nullptr != elemTopo ? elemTopo -> _ToGeometrySource() : nullptr);
    //   }

    //   if (nullptr != geom)
    //     status = geom -> OnSnap(* this);
    //   else
    //     status = DoDefaultDisplayableSnap(); // Default snap for transients using HitDetail...

    //   if (SnapStatus:: Success == status)
    //   ElementLocateManager:: GetManager()._AdjustSnapDetail(* this);

    //   if (SnapStatus:: Success != status)
    //   {
    //     delete m_snapPath;
    //     m_snapPath = nullptr;
    //   }

    //   * snappedPath = m_snapPath;
    //   m_snapPath = nullptr;

    //   return status;
    return undefined;
  }
}

export class RenderContext extends ViewContext {
  public createGraphic(_tf: Transform, _type: GraphicType): GraphicBuilder | undefined { return undefined; }
}

export class DecorateContext extends RenderContext {
  private readonly decorations = new Decorations();

  public drawSheetHit(_hit: HitDetail): void { }
  public drawNormalHit(_hit: HitDetail): void { }
  public drawHit(hit: HitDetail): void {
    const sheetVp = hit.m_sheetViewport;
    return (sheetVp && hit.m_viewport === this.viewport) ? this.drawSheetHit(hit) : this.drawNormalHit(hit);
  }
  public addNormal(graphic: Graphic) {
    // if (nullptr != m_viewlet) {
    //   m_viewlet -> Add(graphic);
    //   return;
    // }

    if (!this.decorations.normal)
      this.decorations.normal = new GraphicList();

    this.decorations.normal.add(graphic);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing enabled. */
  public addWorldDecoration(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.world)
      this.decorations.world = new DecorationList();
    this.decorations.world.add(graphic); // , ovrParams);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addWorldOverlay(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.worldOverlay)
      this.decorations.worldOverlay = new DecorationList();
    this.decorations.worldOverlay.add(graphic); // , ovrParams);
  }

  /** Display view coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addViewOverlay(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.viewOverlay)
      this.decorations.viewOverlay = new DecorationList();
    this.decorations.viewOverlay.add(graphic); // , ovrParams);
  }

  /** Display sprite as view overlay graphic. */
  public addSprite(_sprite: Sprite, _location: Point3d, _xVec: Vector3d, _transparency: number) {
    //  this.addViewOverlay(* m_target.CreateSprite(sprite, location, xVec, transparency, GetDgnDb()), nullptr);
  }

  /** @private */
  public drawStandardGrid(_gridOrigin: Point3d, _rMatrix: RotMatrix, _spacing: Point2d, _gridsPerRef: number, _isoGrid = false, _fixedRepetitions?: Point2d) { }

  /** Display view coordinate graphic as background with smooth shading, default lighting, and z testing disabled. e.g., a sky box. */
  public setViewBackground(graphic: Graphic) { this.decorations.viewBackground = graphic; }

  public createViewBackground(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewBackground)!; }
  public createWorldDecoration(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldDecoration)!; }
  public createWorldOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldOverlay)!; }
  public createViewOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewOverlay)!; }
}
