/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ToolAdmin, CoordinateLockOverrides } from "./ToolAdmin";
import { Tool, BeButtonEvent, BeCursor } from "./Tool";
import { Viewport } from "../Viewport";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { ViewManager } from "../ViewManager";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelConnection } from "../IModelConnection";

/**
 * The PrimitiveTool class can be used to implement a primitive command. Placement
 * tools that don't need to locate or modify elements are good candidates for a PrimitiveTool.
 */
export abstract class PrimitiveTool extends Tool {
  public targetView?: Viewport;
  public targetModelId = new Id64();
  public targetIsLocked: boolean = false; // If target model is known, set this to true in constructor and override getTargetModel.
  public toolStateId: string = "";  // Tool State Id can be used to determine prompts and control UI control state.

  /**  Returns the prompt based on the tool's current state. */
  public getPrompt(): string { return ""; }

  /** Notifies the tool that a view tool is starting. */
  public onStartViewTool(_tool: Tool) { }

  /** Notifies the tool that a view tool is exiting. Return true if handled. */
  public onExitViewTool(): void { }

  /** Notifies the tool that an input collector is starting. */
  public onStartInputCollector(_tool: Tool) { }

  /** Notifies the tool that an input collector is exiting. */
  public onExitInputCollector() { }

  /** Called from isCompatibleViewport to check for a read only iModel, which is not a valid target for tools that create or modify elements. */
  public requireWriteableTarget(): boolean { return true; }

  /**
   * Called when active view changes. Tool may choose to restart or exit based on current view type.
   * @param current The new active view.
   * @param previous The previously active view.
   */
  public onSelectedViewportChanged(current: Viewport, _previous: Viewport) {
    if (this.isCompatibleViewport(current, true))
      return;
    this.onRestartTool();
  }

  /** Get the iModel the tool is operating against. */
  public getIModel(): IModelConnection { return this.targetView!.view!.iModel as IModelConnection; }

  /**
   * Called when an external event may invalidate the current tool's state.
   * Examples are undo, which may invalidate any references to elements, or an incompatible active view change.
   * The active tool is expected to call installTool with a new instance, or exitTool to start the default tool.
   *  @note You *MUST* check the status of installTool and call exitTool if it fails!
   * ``` ts
   * MyTool.oOnRestartTool() {
   * const newTool = new MyTool();
   * if (BentleyStatus.SUCCESS !== newTool.installTool())
   *   this.exitTool(); // Tool exits to default tool if new tool instance could not be installed.
   * }
   * MyTool.onRestartTool() {
   * _this.exitTool(); // Tool always exits to default tool.
   * }
   * ```
   */
  public abstract onRestartTool(): void;

  /**
   * Called to reset tool to initial state. This method is provided here for convenience; the only
   * external caller is ElementSetTool. PrimitiveTool implements this method to call _OnRestartTool.
   */
  public onReinitialize(): void { this.onRestartTool(); }

  /** Called on data button down event in order to lock the tool to it's current target model. */
  public autoLockTarget(): void { if (!this.targetView) return; this.targetIsLocked = true; }
  public getCursor(): BeCursor { return BeCursor.Arrow; }

  /** Called by InstallTool to setup tool instance as the current active primitive command.
   *  @return SUCCESS if new tool instance is now the active primitive command.
   *  @see Tool.installTool Tool.onInstall Tool.onPostInstall
   *  @private
   */
  public installToolImplementation(): BentleyStatus {
    if (this.isCompatibleViewport(ViewManager.instance.selectedView, false) || !ToolAdmin.instance.onInstallTool(this))
      return BentleyStatus.ERROR;

    ToolAdmin.instance.startPrimitiveTool(this);
    ToolAdmin.instance.setPrimitiveTool(this);

    // The tool may exit in onPostInstall causing "this" to be
    // deleted so installToolImplementation must not call any
    // methods on "this" after _OnPostInstall returns.
    ToolAdmin.instance.onPostInstallTool(this);

    return BentleyStatus.SUCCESS;
  }

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean {
    if (!vp)
      return false;
    const view = vp.view;
    const iModel = view.iModel;
    if (this.requireWriteableTarget()) {
      if (iModel.isReadonly())
        return false; // Tool can't be used when iModel is read only.

      // IBriefcaseManager:: Request req;
      // req.Locks().Insert(db, LockLevel:: Shared);
      // if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //   return false;   // another briefcase has locked the db for editing
    }

    if (!this.targetView)
      this.targetView = vp;
    else if (iModel !== this.getIModel())
      return false; // Once a ViewController has been established, only accept views for the same iModel by default.

    if (!this.targetIsLocked) {
      if (isSelectedViewChange)
        this.targetView = vp; // Update target to newly selected view.

      return true; // Any type of model/view is still ok and target is still free to change.
    }

    if (this.targetModelId.isValid() && !view.viewsModel(this.targetModelId))
      return false; // Only allow view where target is being viewed.

    if (this.requireWriteableTarget()) {
      //   IBriefcaseManager:: Request req;
      //   req.Locks().Insert(* targetModel, LockLevel:: Shared);
      //   if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //     return false; // another briefcase has locked the model for editing
    }

    return true;
  }

  /**
   * Checks that the adjusted point from the supplied button event is within the project extents for spatial views. The range of physical geometry
   * should always be fully inside the project extents. Only checking the adjusted point won't absolutely guarantee that a tool doesn't create/move geometry
   * outside the project extents, but it will be sufficient to handle most cases and provide good feedback to the user.
   * @return true if ev is acceptable.
   */
  public isValidLocation(ev: BeButtonEvent, isButtonEvent: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return false;

    const view = vp.view;
    const iModel = view.iModel;
    if (!view.isSpatialView() || iModel.isReadonly() || !this.requireWriteableTarget())
      return true;

    // NOTE: If points aren't being adjusted then the tool shouldn't be creating geometry currently (ex. locating elements) and we shouldn't filter point...
    if (0 !== (ToolAdmin.instance.toolState.coordLockOvr & CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_ACS))
      return true;

    const extents = iModel.projectExtents;
    if (extents.containsPoint(ev.point))
      return true;

    if (isButtonEvent && ev.isDown) {
      //   NotificationManager:: OutputMessage(NotifyMessageDetails(OutputMessagePriority:: Error, DgnViewL10N:: GetString(DgnViewL10N:: ELEMENTSETTOOL_ERROR_ProjectExtents()).c_str()));
    }

    return false;
  }

  public exitTool(): void { ToolAdmin.instance.startDefaultTool(); }

  /**
   * Called to revert to a previous tool state (ex. undo last data button).
   * @return false to instead reverse the most recent transaction.
   */
  public onUndoPreviousStep(): boolean { return false; }

  /**
   * Tools need to call SaveChanges to commit any elements they have added/changes they have made.
   * This helper method supplies the tool name for the undo string to iModel.saveChanges.
   */
  public saveChanges(): Promise<void> { return this.getIModel().saveChanges(this.getLocalizedToolName()); }

  // //! Ensures that any locks and/or codes required for the operation are obtained from iModelServer before making any changes to the iModel.
  // //! Default implementation invokes _PopulateRequest() and forwards request to server.
  //  RepositoryStatus _AcquireLocks();

  // //! Called from _AcquireLocks() to identify any locks and/or codes required to perform the operation
  // virtual RepositoryStatus _PopulateRequest(IBriefcaseManager:: Request & request) { return RepositoryStatus:: Success; }

  // //! Query availability of locks, potentially notifying user of result
  //  bool AreLocksAvailable(IBriefcaseManager:: Request & request, iModelR db, bool fastQuery = true);

  // //! Acquire locks on this tools behalf, potentially notifying user of result
  //  RepositoryStatus AcquireLocks(IBriefcaseManager:: Request & request, iModelR db);

  // //! Acquire a shared lock on the specified model (e.g., for placement tools which create new elements)
  //  RepositoryStatus LockModelForPlacement(DgnModelR model);

  // //! Acquires any locks and/or codes required to perform the specified operation on the element
  // //! If your tool operates on more than one element it should batch all such requests rather than calling this convenience function repeatedly.
  //  RepositoryStatus LockElementForOperation(DgnElementCR element, BeSQLite:: DbOpcode operation);

  /** Call to find out of complex dynamics are currently active. */
  public isDynamicsStarted() { return ViewManager.instance.inDynamicsMode; }
  /** Call to initialize dynamics mode. */
  public beginDynamics() { ToolAdmin.instance.beginDynamics(); }
  /** Call to terminate dynamics mode. */
  public endDynamics() { ToolAdmin.instance.endDynamics(); }
  /** Called to display dynamic elements. */
  public onDynamicFrame(_ev: BeButtonEvent) { }
  public callOnRestartTool(): void { this.onRestartTool(); }
  public undoPreviousStep(): boolean {
    if (!this.onUndoPreviousStep())
      return false;

    // AccuDrawShortcuts:: ProcessPendingHints(); // Process any hints the active tool setup in _OnUndoPreviousStep now...

    const ev = new BeButtonEvent();
    ToolAdmin.instance.fillEventFromCursorLocation(ev);
    this.updateDynamics(ev);
    return true;
  }

  public updateDynamics(ev: BeButtonEvent): void {
    if (!ev.viewport || !ViewManager.instance.inDynamicsMode)
      return;

    // DynamicsContext context(* ev.GetViewport(), Render:: Task:: Priority:: Highest());
    this.onDynamicFrame(ev);
  }
}
