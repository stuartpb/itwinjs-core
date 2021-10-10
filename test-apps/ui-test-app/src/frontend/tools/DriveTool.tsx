/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Angle, LineSegment3d, Point3d, Ray3d, Vector3d } from "@bentley/geometry-core";
import { ColorDef, Easing } from "@bentley/imodeljs-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, IModelApp, PrimitiveTool, ScreenViewport, ToolAssistance, ToolAssistanceImage, ToolAssistanceInstructions, ViewChangeOptions } from "@bentley/imodeljs-frontend";
import { ToolbarItemUtilities } from "@bentley/ui-abstract";
import { ViewportComponent } from "@bentley/ui-components";
import { Dialog } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import * as React from "react";

// Most basic drive tool possible.
export class DriveTool extends PrimitiveTool {
  public static override toolId = "drive";
  public static override get flyover() { return "Drive"; }

  private _points: Point3d[] = [];
  private _driveManager?: DriveManager;
  private _minimap?: React.ReactNode;

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public onRestartTool(): void {
    const tool = new DriveTool();
    if (!tool.run())
      this.exitTool();
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._points.length < 2) {
      this._points.push(ev.point.clone());
    }

    if (this._points.length === 2 && !this._driveManager) {
      const line = LineSegment3d.createCapture(this._points[0], this._points[1]);
      this._driveManager = new DriveManager(this.targetView as ScreenViewport, line);
      this._driveManager.start();
    }

    this.setupAndPromptForNextAction();
    return EventHandled.Yes;
  }

  public override async onResetButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onRestartTool();
    return EventHandled.Yes;
  }

  public override async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (wentDown && this._driveManager) {
      if (keyEvent.key === "t") {
        this._driveManager.toggleMovement();
        return EventHandled.Yes;
      }
      if (keyEvent.key === "m") {
        (undefined === this._minimap) ? this.openMinimap() : this.closeMinimap();
        return EventHandled.Yes;
      }
    }

    return super.onKeyTransition(wentDown, keyEvent);
  }

  public override onPostInstall(): void {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override onUnsuspend(): void {
    this.setupAndPromptForNextAction();
  }

  public override onCleanup(): void {
    super.onCleanup();
    if (this._driveManager)
      this._driveManager.stop();
    this.closeMinimap();
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (0 === this._points.length)
      return;

    const graphicBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    graphicBuilder.setSymbology(ColorDef.white, ColorDef.white, 3);

    if (1 === this._points.length) {
      const ev = new BeButtonEvent();
      this.getCurrentButtonEvent(ev);
      graphicBuilder.addLineString([this._points[0], ev.point]);
    } else {
      graphicBuilder.addLineString(this._points);
    }
    context.addDecorationFromBuilder(graphicBuilder);
  }

  private openMinimap(): void {
    if (!this._minimap && this._driveManager) {
      this._minimap = <MinimapDialog manager={this._driveManager}/>;
      ModalDialogManager.openDialog(this._minimap);
    }
  }

  private closeMinimap(): void {
    if (this._minimap) {
      ModalDialogManager.closeDialog(this._minimap);
      this._minimap = undefined;
    }
  }

  private setupAndPromptForNextAction(): void {
    const enableSnap = this._points.length < 2;
    this.changeLocateState(false, enableSnap);

    let instructions: ToolAssistanceInstructions;
    if (0 === this._points.length)
      instructions = ToolAssistance.createInstructions(ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, "Input first point of segment"));
    else if (1 === this._points.length)
      instructions = ToolAssistance.createInstructions(ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, "Input second point of segment"));
    else {
      const instruction = ToolAssistance.createInstruction(ToolAssistanceImage.Keyboard, "Use key shortcuts for driving");
      const section = ToolAssistance.createSection([
        ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo(["T"]), "Toggle driving"),
        ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo(["M"]), "Toggle minimap display"),
      ]);
      instructions = ToolAssistance.createInstructions(instruction, [section]);
    }

    IModelApp.notifications.setToolAssistance(instructions);
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(DriveTool.toolId, itemPriority, DriveTool.iconSpec, DriveTool.flyover,
      () => {
        IModelApp.tools.run(DriveTool.toolId);
      }, overrides);
  }
}

// Contains all the logic to simulate driving
class DriveManager {
  /** Main viewport. Camera is oriented 'along' the road */
  public readonly viewport: ScreenViewport;

  /** Optional minimap viewport. Camera is top-down */
  private _minimapViewport?: ScreenViewport;
  public set minimapViewport(vp: ScreenViewport | undefined) {
    this._minimapViewport = vp;
    if (this._minimapViewport) {
      this._minimapViewport.changeView(this.viewport.view.clone());
      this.updateCameras(0);
    }
  }

  /** Reference linear geometry */
  private readonly _line: LineSegment3d;
  private readonly _maxDistanceAlong: number;
  /** Current position along the curve [origin, direction] */
  private readonly _currentPositionAlong: Ray3d = Ray3d.createXAxis();
  private _currentDistanceAlong: number = 0.0;
  private _speedKMH: number = 100.0;
  private _intervalTimeInMs: number = 500;
  private _intervalId?: NodeJS.Timeout;

  constructor(vp: ScreenViewport, line: LineSegment3d) {
    this.viewport = vp;
    this._line = line;
    this._maxDistanceAlong = this._line.curveLength();
  }

  public get isMoving(): boolean {
    return undefined !== this._intervalId;
  }

  public toggleMovement(): void {
    this.isMoving ? this.stop(): this.start();
  }

  public start(): void {
    assert(undefined === this._intervalId);
    // Calls the step() method periodically
    this._intervalId = setInterval(() => { this.step(); }, this._intervalTimeInMs);
    this.step();
  }

  public stop(): void {
    if (undefined !== this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  // Calculate displacement to update position along the curve
  private step(): void {
    assert(this.isMoving);

    const speedMetersPerSecond = this._speedKMH / 3.6;
    const newDistanceAlong = this._currentDistanceAlong + (speedMetersPerSecond * this._intervalTimeInMs/1000);
    if (newDistanceAlong < 0.0 || newDistanceAlong > this._maxDistanceAlong) {
      this.stop();
    }

    this._currentDistanceAlong = newDistanceAlong;
    // Clamped fraction [0, 1]
    const fraction = Math.max(0, Math.min(newDistanceAlong / this._maxDistanceAlong, 1));
    this._line.fractionToPointAndUnitTangent(fraction, this._currentPositionAlong);
    this.updateCameras(this._intervalTimeInMs);
  }

  private updateCameras(animationTime: number): void {
    const view = this.viewport.view;
    if (!view.is3d())
      return;

    const opts: ViewChangeOptions = {
      animateFrustumChange: 0 < animationTime,
      animationTime,
      easingFunction: Easing.Linear.None,
    };

    // Update main camera
    const fov = Angle.createDegrees(90);
    const mainEye = this._currentPositionAlong.getOriginRef().plusXYZ(0, 0, 2);
    const mainTarget = mainEye.plus(this._currentPositionAlong.getDirectionRef());
    const mainUpVector = Vector3d.unitZ();

    view.lookAtUsingLensAngle(mainEye, mainTarget, mainUpVector, fov);
    this.viewport.synchWithView(opts);

    if (this._minimapViewport && this._minimapViewport.view.is3d()) {
      const miniEye = mainEye.plusXYZ(0, 0, 50);
      const miniTarget = mainEye;
      const miniUpVector = this._currentPositionAlong.getDirectionRef();

      this._minimapViewport.view.lookAtUsingLensAngle(miniEye, miniTarget, miniUpVector, fov);
      this._minimapViewport.synchWithView(opts);
    }

  }

}

interface MinimapDialogProps {
  manager: DriveManager;
}

// Basic viewport component hosted in a floating, modeless dialog.
const MinimapDialog: React.FC<MinimapDialogProps> = (props: MinimapDialogProps) => {

  const mainViewState = props.manager.viewport.view;
  const viewportRefHandler = (vp: ScreenViewport) => {
    props.manager.minimapViewport = vp;
  };

  return (
    <Dialog
      hideHeader={true}
      opened={true}
      width={200}
      height={200}
      movable={false}
      resizable={false}
      style={{zIndex: 9000}}
      modal={false}
      modelessId={"driveToolPanel"}
      y={100}
      x={100}
    >
      <ViewportComponent imodel={mainViewState.iModel} viewState={mainViewState.clone()} viewportRef={viewportRefHandler}/>
    </Dialog>
  );
};

