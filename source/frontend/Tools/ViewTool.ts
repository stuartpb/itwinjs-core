/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ToolAdmin } from "./ToolAdmin";
import { Tool, ButtonEvent, Cursor, WheelMouseEvent, CoordSource } from "./Tool";
import { Viewport, CoordSystem } from "../Viewport";
import { Point3d, Vector3d, RotMatrix, Transform } from "@bentley/geometry-core/lib/PointVector";
import { Frustum, NpcCenter, Npc, MarginPercent, ViewStatus } from "../../common/ViewState";
import { BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { Angle } from "@bentley/geometry-core/lib/Geometry";

const toolAdmin = ToolAdmin.instance;
const scratchButtonEvent = new ButtonEvent();
const scratchFrustum = new Frustum();
const scratchTransform = Transform.createIdentity();
const scratchRotMatrix = new RotMatrix();
const scratchPoint3d1 = new Point3d();
const scratchPoint3d2 = new Point3d();

export const enum ViewHandleType {
  None = 0,
  Rotate = 1,
  TargetCenter = 1 << 1,
  ViewPan = 1 << 2,
  ViewScroll = 1 << 3,
  ViewZoom = 1 << 4,
  ViewWalk = 1 << 5,
  ViewFly = 1 << 6,
  ViewWalkMobile = 1 << 7, // Uses tool state instead of mouse for input
  ViewLook = 1 << 9,
}

export const enum HitPriority {
  Low = 1,
  Normal = 10,
  Medium = 100,
  High = 1000,
}

// tslint:disable-next-line:variable-name
export const ViewToolSettings = {
  dynamicRotationSphere: false,
  preserveWorldUp: true,
  fitExpandsClipping: true,
  walkEnforceZUp: true,
  fitModes: 0,            // ALL
  mode3dInput: 0,         // WALK
  walkVelocity: 3.5,      // in m/sec
  walkCameraAngle: 75.6,  // in degrees
  animationTime: BeDuration.fromSeconds(260),
  animateZoom: false,
  minDistanceToSurface: 2,
  pickSize: 13,
  zoomToElement: false,
};

// tslint:disable:no-empty
export abstract class ViewTool extends Tool {
  public inDynamicUpdate = false;
  public beginDynamicUpdate() { this.inDynamicUpdate = true; }
  public endDynamicUpdate() { this.inDynamicUpdate = false; }
  public installToolImplementation() {
    if (!toolAdmin.onInstallTool(this))
      return ViewStatus.InvalidViewport;

    toolAdmin.setViewTool(undefined);
    toolAdmin.startViewTool();
    toolAdmin.setViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return ViewStatus.Success;
  }

  public onResetButtonUp(_ev: ButtonEvent) { this.exitTool(); return true; }

  /** Do not override. */
  public exitTool() { toolAdmin.exitViewTool(); }
}

export abstract class ViewingToolHandle {
  constructor(public viewTool: ViewManip) { }
  public onReinitialize() { }
  public focusOut() { }
  public noMotion(_ev: ButtonEvent) { return false; }
  public motion(_ev: ButtonEvent) { return false; }
  public checkOneShot() { return true; }
  public getHandleCursor() { return Cursor.Default; }
  public abstract doManipulation(ev: ButtonEvent, inDynamics: boolean): boolean;
  public abstract firstPoint(ev: ButtonEvent): boolean;
  public abstract testHandleForHit(ptScreen: Point3d): { distance: number, priority: HitPriority } | undefined;
  public abstract get handleType(): ViewHandleType;
  public focusIn() { toolAdmin.setViewCursor(this.getHandleCursor()); }
}

export class ViewHandleArray {
  public handles: ViewingToolHandle[];
  public viewport: Viewport;
  public focus: number;
  public focusDrag: boolean;
  public hitHandleIndex: number;

  constructor(public viewTool: ViewManip) {
    this.handles = [];
    this.empty();
  }

  public empty() {
    this.focus = -1;
    this.focusDrag = false;
    this.hitHandleIndex = -1;
    this.handles.length = 0;
  }

  public get count() { return this.handles.length; }
  public get hitHandle() { return this.getByIndex(this.hitHandleIndex); }
  public get focusHandle() { return this.getByIndex(this.focus); }
  public add(handle: ViewingToolHandle) { this.handles.push(handle); }
  public getByIndex(index: number): ViewingToolHandle | undefined { return (index >= 0 && index < this.count) ? this.handles[index] : undefined; }
  public focusHitHandle() { this.setFocus(this.hitHandleIndex); }

  public testHit(ptScreen: Point3d, forced = ViewHandleType.None): boolean {
    this.hitHandleIndex = -1;
    let minDistance = 0.0;
    let minDistValid = false;
    let highestPriority = HitPriority.Low;
    let nearestHitHandle: ViewingToolHandle | undefined;

    for (let i = 0; i < this.count; ++i) {
      const handle = this.handles[i];
      if (!handle)
        continue;

      if (forced !== ViewHandleType.None) {
        if (handle.handleType === forced) {
          this.hitHandleIndex = i;
          return true;
        }
      } else {
        const hit = handle.testHandleForHit(ptScreen);
        if (!hit)
          continue;

        if (hit.priority >= highestPriority) {
          if (hit.priority > highestPriority)
            minDistValid = false;

          highestPriority = hit.priority;
          if (!minDistValid || (hit.distance < minDistance)) {
            minDistValid = true;
            minDistance = hit.distance;
            nearestHitHandle = handle;
            this.hitHandleIndex = i;
          }
        }
      }
    }

    return nearestHitHandle !== undefined;
  }

  public setFocus(index: number) {
    if (this.focus === index && (this.focusDrag === this.viewTool.isDragging))
      return;

    let focusHandle: ViewingToolHandle | undefined;
    if (this.focus >= 0) {
      focusHandle = this.getByIndex(this.focus);
      if (focusHandle)
        focusHandle.focusOut();
    }

    if (index >= 0) {
      focusHandle = this.getByIndex(index);
      if (focusHandle)
        focusHandle.focusIn();
    }

    this.focus = index;
    this.focusDrag = this.viewTool.isDragging;
  }

  public onReinitialize() { this.handles.forEach((handle) => { if (handle) handle.onReinitialize(); }); }

  /** determine whether a handle of a specific type exists */
  public hasHandle(handleType: ViewHandleType) {
    for (let i = 0; i < this.count; ++i) {
      const handle = this.getByIndex(i);
      if (handle && handle.handleType === handleType)
        return true;
    }

    return false;
  }

  public getHandleByType(handleType: ViewHandleType): ViewingToolHandle | undefined {
    for (let i = 0; i < this.count; i++) {
      const handle = this.getByIndex(i);
      if (handle && handle.handleType === handleType)
        return handle;
    }

    return undefined;
  }

  public motion(ev: ButtonEvent): boolean {
    this.handles.forEach((handle) => { if (handle) handle.motion(ev); });
    return true;
  }
}

export class ViewManip extends ViewTool {
  public viewport?: Viewport;
  public viewHandles: ViewHandleArray;
  public frustumValid: boolean;
  public alwaysLeaveLastView: boolean;
  public ballRadius: number;          // screen coords
  public lastPtScreen: Point3d;
  public targetCenterWorld: Point3d;
  public worldUpVector: Vector3d;
  public isDragging: boolean;
  public isDragOperation: boolean;
  public stoppedOverHandle: boolean;
  public wantMotionStop: boolean;
  public targetCenterValid: boolean;
  public supportsOrientationEvents: boolean;
  public nPts: number;
  public forcedHandle: ViewHandleType;
  public lastFrustum: Frustum;

  constructor(viewport: Viewport, public handleMask: number, public isOneShot: boolean, public scrollOnNoMotion: boolean,
    public isDragOperationRequired: boolean = false) {
    super();
    this.viewport = viewport;
    this.wantMotionStop = true;
    this.isDragOperation = false;
    this.targetCenterValid = false;
    this.lastPtScreen = new Point3d();
    this.targetCenterWorld = new Point3d();
    this.ballRadius = 0.0;
    this.worldUpVector = new Vector3d();
    this.forcedHandle = ViewHandleType.None;
    this.lastFrustum = new Frustum();
    this.viewHandles = new ViewHandleArray(this);

    if (handleMask & ViewHandleType.ViewPan)
      this.viewHandles.add(new ViewPan(this));

    if (handleMask & ViewHandleType.Rotate) {
      this.viewHandles.add(new ViewRotate(this));
    }

    if (handleMask & ViewHandleType.ViewWalk)
      this.viewHandles.add(new ViewWalk(this));

    this.onReinitialize();
  }

  public get toolId(): string {
    if (this.handleMask & (ViewHandleType.Rotate | ViewHandleType.TargetCenter))
      return "View.Rotate";

    if (this.handleMask & ViewHandleType.ViewPan)
      return "View.Pan";

    if (this.handleMask & ViewHandleType.ViewScroll)
      return "View.Scroll";

    if (this.handleMask & ViewHandleType.ViewZoom)
      return "View.Zoom";

    if (this.handleMask & ViewHandleType.ViewWalk)
      return "View.Walk";

    if (this.handleMask & ViewHandleType.ViewWalkMobile)
      return "View.WalkMobile";

    if (this.handleMask & ViewHandleType.ViewFly)
      return "View.Fly";

    if (this.handleMask & ViewHandleType.ViewLook)
      return "View.Look";

    return "";
  }

  public onReinitialize() {
    toolAdmin.gesturePending = false;
    if (this.viewport) {
      this.viewport.synchWithView(true);
      this.viewHandles.setFocus(-1);
    }
    this.nPts = 0;
    this.isDragging = false;
    this.inDynamicUpdate = false;
    this.frustumValid = false;
    this.viewHandles.onReinitialize();
  }

  public onDataButtonDown(ev: ButtonEvent) {
    if (0 === this.nPts && this.isDragOperationRequired && !this.isDragOperation)
      return false;

    switch (this.nPts) {
      case 0:
        if (this.processFirstPoint(ev))
          this.nPts = 1;
        break;
      case 1:
        this.nPts = 2;
        break;
    }

    if (this.nPts > 1) {
      if (this.processPoint(ev, false) && this.isOneShot)
        this.exitTool();
      else
        this.onReinitialize();
    }

    return true;
  }

  public onDataButtonUp(_ev: ButtonEvent) {
    if (this.nPts <= 1 && this.isDragOperationRequired && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  // Just let the idle tool handle this...
  public onMiddleButtonDown(_ev: ButtonEvent) { return false; }

  public onMiddleButtonUp(_ev: ButtonEvent) {
    if (this.nPts <= 1 && !this.isDragOperation && this.isOneShot)
      this.exitTool();

    return false;
  }

  public onMouseWheel(inputEv: WheelMouseEvent) {
    const ev = inputEv.clone();

    // If the rotate is active, the mouse wheel should work as if the cursor is at the target center
    if ((this.handleMask & ViewHandleType.Rotate)) {
      ev.point = this.targetCenterWorld;
      ev.coordsFrom = CoordSource.Precision; // don't want raw point used...
    }

    toolAdmin.processMouseWheelEvent(ev, false);
    this.doUpdate(true);
    return true;
  }

  public onModelStartDrag(ev: ButtonEvent) {
    this.isDragOperation = true;
    this.stoppedOverHandle = false;

    toolAdmin.gesturePending = false;
    if (0 === this.nPts)
      this.onDataButtonDown(ev);

    return true;
  }

  public onModelEndDrag(ev: ButtonEvent) {
    this.isDragOperation = false;
    return 0 === this.nPts || this.onDataButtonDown(ev);
  }

  public onModelMotion(ev: ButtonEvent) {
    this.stoppedOverHandle = false;
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);
  }

  public onModelMotionStopped(ev: ButtonEvent) {
    if (ev.viewport !== this.viewport)
      return;

    if (0 === this.nPts) {
      if (this.viewHandles.testHit(ev.viewPoint)) {
        this.stoppedOverHandle = true;
        this.viewHandles.focusHitHandle();
      } else if (this.stoppedOverHandle) {
        this.stoppedOverHandle = false;
        this.viewport!.invalidateDecorations();
      }
    }
  }

  public onModelNoMotion(ev: ButtonEvent) {
    if (0 === this.nPts || !ev.viewport)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle && hitHandle.noMotion(ev))
      this.doUpdate(false);
  }

  public onCleanup() {
    let restorePrevious = false;

    if (this.inDynamicUpdate) {
      this.endDynamicUpdate();
      restorePrevious = !this.alwaysLeaveLastView;
    }

    const vp = this.viewport;
    if (vp) {
      vp.synchWithView(true);
      if (restorePrevious)
        vp.applyPrevious(BeDuration.fromSeconds(0));
      vp.invalidateDecorations();
    }

    this.viewHandles.empty();
    this.viewport = undefined;
  }

  public isSameFrustum() {
    const frust = this.viewport!.getWorldFrustum(scratchFrustum);
    if (this.frustumValid && frust.equals(this.lastFrustum))
      return true;

    frust.clone(this.lastFrustum);
    this.frustumValid = true;
    return false;
  }

  /** Get the geometric center of the union of the ranges of all selected elements. */
  private getSelectedElementCenter(): Point3d | undefined {
    // DgnElementIdSet const& elemSet = SelectionSetManager:: GetManager().GetElementIds();

    // if (0 == elemSet.size())
    //   return ERROR;

    // DRange3d range = DRange3d:: NullRange();
    // DgnDbR dgnDb = SelectionSetManager:: GetManager().GetDgnDbR();

    // for (DgnElementId elemId : elemSet)
    // {
    //   DgnElementCP el = dgnDb.Elements().FindLoadedElement(elemId); // Only care about already loaded elements...

    //   if (NULL == el)
    //     continue;

    //   DPoint3d origin;
    //   GeometrySourceCP geom = el -> ToGeometrySource();
    //   if (geom && geom -> HasGeometry()) {
    //     DRange3d elRange = geom -> CalculateRange3d();

    //     origin.Interpolate(elRange.low, 0.5, elRange.high);
    //     range.Extend(origin);
    //   }
    // }

    // if (range.IsNull())
    //   return ERROR;

    // center.Interpolate(range.low, 0.5, range.high);
    // return SUCCESS;
    return undefined;
  }

  public updateTargetCenter() {
    const vp = this.viewport;
    if (!vp)
      return;

    if (this.targetCenterValid) {
      // React to AccuDraw compass being moved using "O" shortcut or tentative snap...
      if (this.isDragging)
        return;

      // DPoint3d  center = this.getTargetCenterWorld();
      // AccuDrawR accudraw = AccuDraw:: GetInstance();

      // if (accudraw.IsActive()) {
      //   DPoint3d    testPoint;
      //   accudraw.GetOrigin(testPoint);
      //   // Redefine target center if changed...world-locked if moved by user after tool starts...
      //   if (!testPoint.IsEqual(center, 1.0e-10))
      //     SetTargetCenterWorld(& testPoint, true);
      // }
      // else if (TentativePoint:: GetInstance().IsActive())
      // {
      //   // Clear current tentative, i.e. no datapoint to accept...
      //   DPoint3d    testPoint = * TentativePoint:: GetInstance().GetPoint();

      //   // Redefine target center if changed...world-locked if moved by user after tool starts...
      //   if (!testPoint.IsEqual(center, 1.0e-10))
      //     SetTargetCenterWorld(& testPoint, true);

      //   TentativePoint:: GetInstance().Clear(true);

      //   // NOTE: AccuDraw won't normally grab focus because it's disabled for viewing tools...
      //   AccuDrawShortcuts:: RequestInputFocus();
      // }

      return;
    }
    // TentativePoint & tentPoint = TentativePoint:: GetInstance();
    // // Define initial target center for view ball...
    // if (tentPoint.IsActive()) {
    //   SetTargetCenterWorld(tentPoint.GetPoint(), true);
    //   return;
    // }

    // if (tentPoint.IsSnapped() || AccuSnap:: GetInstance().IsHot())
    // {
    //   SetTargetCenterWorld(TentativeOrAccuSnap:: GetCurrentPoint(), true);
    //   return;
    // }

    let center = this.getSelectedElementCenter();
    if (center && this.isPointVisible(center)) {
      this.setTargetCenterWorld(center, true);
      return;
    }

    center = vp.viewCmdTargetCenter;

    if (center && this.isPointVisible(center)) {
      this.setTargetCenterWorld(center, true);
      return;
    }

    center = scratchPoint3d1;
    if (!vp.view.allow3dManipulations()) {
      vp.npcToWorld(NpcCenter, center);
      center.z = 0.0;
    } else {
      vp.determineDefaultRotatePoint(center);
    }

    this.setTargetCenterWorld(center, false);
  }

  public updateWorldUpVector(initialSetup: boolean) {
    if (!initialSetup)
      return;

    this.worldUpVector.x = 0.0;
    this.worldUpVector.y = 0.0;
    this.worldUpVector.z = 1.0;
  }

  public processFirstPoint(ev: ButtonEvent) {
    const forcedHandle = this.forcedHandle;
    this.forcedHandle = ViewHandleType.None;
    this.frustumValid = false;

    if (this.viewHandles.testHit(ev.viewPoint, forcedHandle)) {
      this.isDragging = true;
      this.viewHandles.focusHitHandle();
      const handle = this.viewHandles.hitHandle;
      if (handle && !handle.firstPoint(ev))
        return false;
    }

    return true;
  }

  public processPoint(ev: ButtonEvent, inDynamics: boolean) {
    const hitHandle = this.viewHandles.hitHandle;
    if (!hitHandle)
      return true;

    const doUpdate = hitHandle.doManipulation(ev, inDynamics);
    if (doUpdate)
      this.doUpdate(true);

    return inDynamics || (doUpdate && hitHandle.checkOneShot());
  }

  public lensAngleMatches(angle: number, tolerance: number) {
    const cameraView = this.viewport!.view;
    return !cameraView.is3d() ? false : Math.abs(cameraView.calcLensAngle().radians - angle) < tolerance;
  }

  public isZUp() {
    const view = this.viewport!.view;
    const viewX = view.getXVector();
    const viewY = view.getXVector();
    const zVec = Vector3d.unitZ();
    return (Math.abs(zVec.dotProduct(viewY)) > 0.99 && Math.abs(zVec.dotProduct(viewX)) < 0.01);
  }

  public doUpdate(_abortOnButton: boolean) {
    // we currently have no built-in support for dynamics, therefore nothing to update.
  }

  public setTargetCenterWorld(pt: Point3d, snapOrPrecision: boolean) {
    this.targetCenterWorld.setFrom(pt);
    this.targetCenterValid = true;
    const vp = this.viewport;
    if (!vp)
      return;

    if (!vp.view.allow3dManipulations())
      this.targetCenterWorld.z = 0.0;

    vp.viewCmdTargetCenter = (snapOrPrecision ? pt : undefined);

    const viewPt = vp.worldToView(this.targetCenterWorld, scratchPoint3d1);
    const ev = scratchButtonEvent;
    ev.initEvent(this.targetCenterWorld, this.targetCenterWorld, viewPt, vp, CoordSource.User, 0);
    toolAdmin.setAdjustedDataPoint(ev);
    ev.reset();
  }

  public invalidateTargetCenter() { this.targetCenterValid = false; }

  public isPointVisible(testPt: Point3d): boolean {
    const vp = this.viewport;
    if (!vp)
      return false;
    const testPtView = vp.worldToView(testPt);
    const frustum = vp.getFrustum(CoordSystem.Screen, false, scratchFrustum);

    const screenRange = scratchPoint3d1;
    screenRange.x = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
    screenRange.y = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
    screenRange.z = frustum.points[Npc._000].distance(frustum.points[Npc._001]);

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  public static fitView(viewport: Viewport, doUpdate: boolean, marginPercent?: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getWorldFrustum(scratchFrustum);

    viewport.view.lookAtViewAlignedVolume(range, aspect, marginPercent);
    viewport.synchWithView(false);
    viewport.viewCmdTargetCenter = undefined;

    if (doUpdate)
      viewport.animateFrustumChange(before, viewport.getFrustum(), ViewToolSettings.animationTime);

    viewport.synchWithView(true);
  }

  public setCameraLensAngle(lensAngle: Angle, retainEyePoint: boolean): ViewStatus {
    const vp = this.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    const view = vp.view;
    if (!view || !view.is3d())
      return ViewStatus.InvalidViewport;

    const result = (retainEyePoint && view.isCameraOn()) ?
      view.lookAtUsingLensAngle(view.getEyePoint(), view.getTargetPoint(), view.getYVector(), lensAngle) :
      vp.turnCameraOn(lensAngle);

    if (result !== ViewStatus.Success)
      return result;

    this.targetCenterValid = false;
    vp.synchWithView(false);
    return ViewStatus.Success;
  }

  public enforceZUp(pivotPoint: Point3d) {
    const vp = this.viewport;
    if (!vp || this.isZUp())
      return false;

    const view = vp.view;
    const viewY = view.getYVector();
    const rotMatrix = RotMatrix.createRotationVectorToVector(viewY, Vector3d.unitZ(), scratchRotMatrix);
    if (!rotMatrix)
      return false;

    const transform = Transform.createFixedPointAndMatrix(pivotPoint, rotMatrix, scratchTransform);
    const frust = vp.getWorldFrustum(scratchFrustum);
    frust.multiply(transform);
    vp.setupFromFrustum(frust);
    return true;
  }
}

/** ViewingToolHandle for performing the "pan view" operation */
class ViewPan extends ViewingToolHandle {
  private anchorPt: Point3d = new Point3d();
  private lastPtNpc: Point3d = new Point3d();
  public get handleType() { return ViewHandleType.ViewPan; }
  public getHandleCursor() { return this.viewTool.isDragging ? Cursor.ClosedHand : Cursor.OpenHand; }

  public doManipulation(ev: ButtonEvent, _inDynamics: boolean) {
    const vp = ev.viewport!;
    const newPtWorld = ev.point.clone();
    const thisPtNpc = vp.worldToNpc(newPtWorld);
    const firstPtNpc = vp.worldToNpc(this.anchorPt);

    thisPtNpc.z = firstPtNpc.z;

    if (this.lastPtNpc.isAlmostEqual(thisPtNpc, 1.0e-10))
      return true;

    vp.npcToWorld(thisPtNpc, newPtWorld);
    this.lastPtNpc.setFrom(thisPtNpc);
    return this.doPan(newPtWorld);
  }

  public firstPoint(ev: ButtonEvent) {
    const vp = ev.viewport!;
    this.anchorPt.setFrom(ev.point);

    // if the camera is on, we need to find the element under the starting point to get the z
    if (CoordSource.User === ev.coordsFrom && vp.isCameraOn()) {
      const depthIntersection = vp.pickDepthBuffer(ev.viewPoint);
      if (depthIntersection) {
        this.anchorPt.setFrom(depthIntersection);
      } else {
        const firstPtNpc = vp.worldToNpc(this.anchorPt);
        firstPtNpc.z = vp.getFocusPlaneNpc();
        this.anchorPt = vp.npcToWorld(firstPtNpc, this.anchorPt);
      }
    }

    this.viewTool.beginDynamicUpdate();
    return true;
  }

  public onReinitialize() {
    const vha = this.viewTool.viewHandles.hitHandle;
    if (vha === this)
      toolAdmin.setViewCursor(this.getHandleCursor());
  }

  public testHandleForHit(_ptScreen: Point3d) { return { distance: 0.0, priority: HitPriority.Low }; }

  public doPan(newPtWorld: Point3d) {
    const vp = this.viewTool.viewport!;
    const view = vp.view;
    const dist = newPtWorld.vectorTo(this.anchorPt);

    if (view.is3d()) {
      view.moveCameraWorld(dist);
      return false;
    } else {
      view.setOrigin(view.getOrigin().plus(dist));
    }

    vp.synchWithView(false);
    return true;
  }
}

class ViewRotate extends ViewingToolHandle {
  private lastPtNpc = new Point3d();
  private firstPtNpc = new Point3d();
  private frustum = new Frustum();
  private activeFrustum = new Frustum();
  public get handleType() { return ViewHandleType.Rotate; }
  public getHandleCursor() { return Cursor.Rotate; }

  public testHandleForHit(ptScreen: Point3d) {
    const tool = this.viewTool;
    const targetPt = tool.viewport!.worldToView(tool.targetCenterWorld);
    const dist = targetPt.distanceXY(ptScreen);
    return { distance: dist, priority: HitPriority.Normal };
  }

  public firstPoint(ev: ButtonEvent) {
    if (toolAdmin.gesturePending)
      return false;

    const tool = this.viewTool;
    const vp = tool.viewport!;

    const pickPt = ev.rawPoint; // Use raw point when AccuDraw is not active, don't want tentative location...
    // if (accudraw.IsActive()) {
    // DPoint3d    adrawOrigin;
    // RotMatrix   adrawMatrix;

    // accudraw.GetOrigin(adrawOrigin);
    // accudraw.GetRotation(adrawMatrix);

    // pickPt = pickPtOrig = * ev.GetPoint(); // Use adjusted point when AccuDraw is active...

    // DVec3d      viewZWorld;
    // DPoint3d    distWorld = pickPt;

    // // Lock to the construction plane
    // if (viewport -> IsCameraOn())
    //   viewZWorld.DifferenceOf(distWorld, viewport -> GetCamera().GetEyePoint());
    // else
    //   viewport -> GetRotMatrix().GetRow(viewZWorld, 2);

    // DVec3d      adrawZWorld;
    // DPoint3d    pickPt;

    // adrawMatrix.GetRow(adrawZWorld, 2);
    // LegacyMath:: Vec:: LinePlaneIntersect(& distWorld, & distWorld, & viewZWorld, & adrawOrigin, & adrawZWorld, false);
    // pickPt = distWorld;

    // uint32_t    flags = ACCUDRAW_AlwaysSetOrigin | ACCUDRAW_SetModePolar | ACCUDRAW_FixedOrigin;
    // DVec3d      adrawX, adrawY, adrawZ;

    // if (adrawX.NormalizedDifference(pickPt, activeOrg) > mgds_fc_epsilon) {
    //   adrawMatrix.GetRow(adrawZ, 2);
    //   adrawY.CrossProduct(adrawZ, adrawX);
    //   adrawMatrix.InitFromRowVectors(adrawX, adrawY, adrawZ);
    //   adrawMatrix.NormalizeRowsOf(adrawMatrix, adrawZWorld);

    //   flags |= ACCUDRAW_SetRMatrix;
    // }

    // accudraw.SetContext((AccuDrawFlags) flags, & activeOrg, (DVec3dP) & adrawMatrix);

    vp.worldToNpc(pickPt, this.firstPtNpc);
    this.lastPtNpc.setFrom(this.firstPtNpc);

    vp.getWorldFrustum(this.activeFrustum);
    this.frustum.setFrom(this.activeFrustum);

    tool.beginDynamicUpdate();
    return true;
  }

  public doManipulation(ev: ButtonEvent, _inDynamics: boolean) {
    const tool = this.viewTool;
    const viewport = tool.viewport!;
    const ptNpc = viewport.worldToNpc(ev.point);
    if (this.lastPtNpc.isAlmostEqual(ptNpc, 1.0e-10))
      return true;

    if (this.firstPtNpc.isAlmostEqual(ptNpc, 1.0e-2))
      ptNpc.setFrom(this.firstPtNpc);

    this.lastPtNpc.setFrom(ptNpc);
    const currentFrustum = viewport.getWorldFrustum(scratchFrustum);
    const frustumChange = !currentFrustum.equals(this.activeFrustum);
    if (frustumChange)
      this.frustum.setFrom(currentFrustum);
    else if (!viewport.setupFromFrustum(this.frustum))
      return false;

    const currPt = viewport.npcToView(ptNpc, scratchPoint3d2);
    if (frustumChange) {
      this.firstPtNpc.setFrom(ptNpc);
    }

    const radians = 0.0;
    const worldAxis = new Cartesian3();
    const worldPt = tool.targetCenterWorld;
    if (this.viewTool.useSphere || !viewport.view.allow3dManipulations) {
      const currBallPt = this.viewTool.viewPtToSpherePt(currPt, true);

      const axisVector = new Cartesian3();
      radians = this.viewTool.ballPointsToMatrix(undefined, axisVector, this.ballVector0, currBallPt);

      const viewMatrix = viewport.rotMatrix;
      const xVec = viewMatrix.getRow(0);
      const yVec = viewMatrix.getRow(1);
      const zVec = viewMatrix.getRow(2);

      worldAxis.sumOf3ScaledVectors(Cartesian3.ZERO, xVec, axisVector.x, yVec, axisVector.y, zVec, axisVector.z);
    } else {
      const viewRect = viewport.getViewRect();
      const xExtent = viewRect.width;
      const yExtent = viewRect.height;

      const currPt = viewport.npcToView(ptNpc);
      const firstPt = viewport.npcToView(this.firstPtNpc);

      const xDelta = (currPt.x - firstPt.x);
      const yDelta = (currPt.y - firstPt.y);

      // Movement in screen x == rotation about drawing Z (preserve up) or rotation about screen  Y...
      const xAxis = ViewToolSettings.preserveWorldUp ? this.viewTool.worldUpVector.clone() : viewport.rotMatrix.getRow(1);

      // Movement in screen y == rotation about screen X...
      const yAxis = viewport.rotMatrix.getRow(0);

      const xRMatrix = RotMatrix.createIdentity();
      if (xDelta)
        xRMatrix.initFromVectorAndRotationAngle(xAxis, Math.PI / (xExtent / xDelta));

      const yRMatrix = RotMatrix.createIdentity();
      if (yDelta)
        yRMatrix.initFromVectorAndRotationAngle(yAxis, Math.PI / (yExtent / yDelta));

      const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);
      radians = -worldRMatrix.getRotationAngleAndVector(worldAxis);
    }

    this.rotateViewWorld(worldPt, worldAxis, radians);
    // viewport.moveViewToSurfaceIfRequired();
    viewport.getWorldFrustum(this.activeFrustum);

    return true;
  }

  private rotateViewWorld(worldOrigin: Point3d, worldAxisVector: Vector3d, primaryAngle: Angle) {
    const worldMatrix = RotMatrix.createRotationAroundVector(worldAxisVector, primaryAngle);
    const worldTransform = Transform.createFixedPointAndMatrix(worldOrigin, worldMatrix!);
    const frustum = this.frustum.clone();
    frustum.multiply(worldTransform);
    this.viewTool.viewport!.setupFromFrustum(frustum);
  }
}

/** tool that performs a fit view */
export class FitViewTool extends ViewTool {
  constructor(public viewport: Viewport, public oneShot: boolean) { super(); }
  public get toolId() { return "View.Fit"; }

  public onDataButtonDown(_ev: ButtonEvent) { return this.doFit(); }
  public onPostInstall() { super.onPostInstall(); this.doFit(); }
  public doFit() {
    ViewManip.fitView(this.viewport, true);
    if (this.oneShot)
      this.exitTool();
    return this.oneShot;
  }
}
