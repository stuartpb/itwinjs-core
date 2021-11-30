/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { System } from "../System";
import { FragmentShaderComponent, ProgramBuilder, VariableType } from "../ShaderBuilder";
import { decodeUint24 } from "./Decode";

// Vertex shader produces barycentric coordinate for corner of triangle to be smoothly interpolated over face of triangle.
// This requires WebGL 2 because gl_VertexID.
// It also requires that we are drawing non-indexed vertices, or using an index buffer in which each set of 3 consecutive indices correspond to one triangle -
// otherwise gl_VertexID will not correlate to triangle corners.
const computeBarycentric = `
  int vertIndex = gl_VertexID % 3;
  v_barycentric = vec3(float(0 == vertIndex), float(1 == vertIndex), float(2 == vertIndex));
`;

const computeEdgePresent = `
  v_edgePresent = vec3(1.0);
  v_edgePresent[vertIndex] = u_allEdgesVisible || 0.0 != decodeUInt24(a_edge) ? 2.0 : 0.0;
`;

// Fragment shader draws in the line color for fragments close to the edge of the triangle.
// Vertex shader requires WebGL 2 which includes the functionality of the GL_OES_standard_derivatives extension.
const applyWiremesh = `
  const float lineWidth = 3.0;
  const vec3 lineColor = vec3(0.0);
  vec3 delta = fwidth(v_barycentric);
  vec3 factor = smoothstep(vec3(0.0), delta * lineWidth, v_barycentric);

  float r = 1.0;
  if (v_edgePresent.x > 1.0)
    r = factor.x;
  if (v_edgePresent.y > 1.0)
    r = min(r, factor.y);
  if (v_edgePresent.z > 1.0)
    r = min(r, factor.z);

  bool colorCode = true;
  vec3 color = mix(lineColor, colorCode ? v_barycentric : baseColor.rgb, r);

  return vec4(color, baseColor.a);
`;

/** Adds to a mesh shader logic to produce an overlaid wiremesh.
 * @internal
 */
export function addWiremesh(builder: ProgramBuilder): void {
  if (!System.instance.isWebGL2)
    return;

  builder.vert.addFunction(decodeUint24);
  builder.vert.addUniform("u_allEdgesVisible", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_allEdgesVisible", (uniform, params) => {
      uniform.setUniform1i(params.target.currentViewFlags.wiremesh ? /* ###TODO 1 */ 0 : 0);
    });
  });

  builder.addInlineComputedVarying("v_barycentric", VariableType.Vec3, computeBarycentric);
  builder.addInlineComputedVarying("v_edgePresent", VariableType.Vec3, computeEdgePresent);

  builder.frag.set(FragmentShaderComponent.ApplyWiremesh, applyWiremesh);
}
