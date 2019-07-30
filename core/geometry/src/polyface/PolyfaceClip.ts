/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Point3d, Vector3d, Point2d } from "./PointVector";
import { Polyface } from "./Polyface";
import { ClipPlane } from "../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { PolyfaceBuilder } from "./PolyfaceBuilder";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { ChainMergeContext } from "../topology/ChainMerge";
import { LineString3d } from "../curve/LineString3d";
import { SweepContour } from "../solid/SweepContour";

/** PolyfaceClip is a static class gathering operations using Polyfaces and clippers.
 * @public
 */
export class PolyfaceClip {
  /** Clip each facet of polyface to the ClipPlane.
   * * Return all surviving clip as a new mesh.
   * * WARNING: The new mesh is "points only".
   */
  public static clipPolyfaceClipPlaneWithClosureFace(polyface: Polyface, clipper: ClipPlane, insideClip: boolean = true, buildClosureFace: boolean = true): Polyface {
    const visitor = polyface.createVisitor(0);
    const builder = PolyfaceBuilder.create();
    const chainContext = ChainMergeContext.create();

    const work = new GrowableXYZArray(10);
    const point0 = Point3d.create();
    const point1 = Point3d.create();
    for (visitor.reset(); visitor.moveToNextFacet();) {
      clipper.clipConvexPolygonInPlace(visitor.point, work, insideClip);
      if (visitor.point.length > 2)
        builder.addPolygonGrowableXYZArray(visitor.point);
      this.collectEdgesOnPlane(visitor.point, clipper, chainContext, point0, point1);
    }
    // SweepContour is your friend .. but maybe it doesn't do holes and multi-loops yet?
    if (buildClosureFace) {
      chainContext.clusterAndMergeVerticesXYZ();
      const loops = chainContext.collectMaximalGrowableXYZArrays();
      const contour = SweepContour.createForPolygon(loops);
      if (contour !== undefined) {
        contour.emitFacets(builder, false);
      }
    }
    return builder.claimPolyface(true);
  }

  /** Clip each facet of polyface to the ClipPlane.
   * * Return all surviving clip as a new mesh.
   * * WARNING: The new mesh is "points only".
   */
  public static clipPolyfaceClipPlane(polyface: Polyface, clipper: ClipPlane, insideClip: boolean = true): Polyface {
    return this.clipPolyfaceClipPlaneWithClosureFace(polyface, clipper, insideClip, false);
  }

  /** Clip each facet of polyface to the ClipPlane.
   * * Return surviving clip as a new mesh.
   * * WARNING: The new mesh is "points only".
   */
  public static clipPolyfaceConvexClipPlaneSet(polyface: Polyface, clipper: ConvexClipPlaneSet): Polyface {
    const visitor = polyface.createVisitor(0);
    const builder = PolyfaceBuilder.create();
    const work = new GrowableXYZArray(10);
    for (visitor.reset(); visitor.moveToNextFacet();) {
      clipper.clipConvexPolygonInPlace(visitor.point, work);
      if (visitor.point.length > 2)
        builder.addPolygonGrowableXYZArray(visitor.point);
    }
    return builder.claimPolyface(true);
  }

  /** Clip each facet of polyface to the ClipPlane or ConvexClipPlaneSet
   * * This method parses  the variant input types and calls a more specific method.
   * * WARNING: The new mesh is "points only".
   */
  public static clipPolyface(polyface: Polyface, clipper: ClipPlane | ConvexClipPlaneSet): Polyface | undefined {
    if (clipper instanceof ClipPlane)
      return this.clipPolyfaceClipPlane(polyface, clipper);
    if (clipper instanceof ConvexClipPlaneSet)
      return this.clipPolyfaceConvexClipPlaneSet(polyface, clipper);
    // (The if tests exhaust the type space -- this line is unreachable.)
    return undefined;
  }

  /** Find consecutive points around a polygon (with implied closure edge) that are ON a plane
   * @param points array of points around polygon.  Closure edge is implied.
   * @param chainContext context receiving edges
   * @param point0 work point
   * @param point1 work point
  */
  private static collectEdgesOnPlane(points: GrowableXYZArray, clipper: ClipPlane, chainContext: ChainMergeContext, point0: Point3d, point1: Point3d) {
    const n = points.length;
    if (n > 1) {
      points.getPoint3dAtUncheckedPointIndex(n - 1, point0);
      for (let i = 0; i < n; i++) {
        points.getPoint3dAtUncheckedPointIndex(i, point1);
        if (clipper.isPointOn(point0) && clipper.isPointOn(point1))
          chainContext.addSegment(point0, point1);
        point0.setFromPoint3d(point1);
      }
    }
  }
  /** Intersect each facet with the clip plane. (Producing intersection edges.)
   * * Return all edges  chained as array of LineString3d.
   */
  public static sectionPolyfaceClipPlane(polyface: Polyface, clipper: ClipPlane): LineString3d[] {
    const chainContext = ChainMergeContext.create();

    const visitor = polyface.createVisitor(0);
    const work = new GrowableXYZArray(10);
    const point0 = Point3d.create();
    const point1 = Point3d.create();
    for (visitor.reset(); visitor.moveToNextFacet();) {
      clipper.clipConvexPolygonInPlace(visitor.point, work, true);
      this.collectEdgesOnPlane(visitor.point, clipper, chainContext, point0, point1);
    }
    chainContext.clusterAndMergeVerticesXYZ();
    return chainContext.collectMaximalChains();
  }
}
