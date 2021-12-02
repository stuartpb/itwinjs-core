/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { System } from "../System";
import { FragmentShaderComponent, ProgramBuilder, VariableType } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { decodeUint24 } from "./Decode";
import { octDecodeNormal } from "./Surface";
import { addLookupTable } from "./LookupTable";

const sampleEdgeNormals = `
bool sampleEdgeOctEncodedNormals(float edgeIndex, out vec2 n0, out vec2 n1, out vec2 dir) {
  if (0.0 == edgeIndex) {
    n0 = n1 = dir = vec2(0.0);
    return false;
  }

  vec2 tc = compute_edge_coords(edgeIndex - 1.0);
  vec4 s0 = floor(TEXTURE(u_edgeLUT, tc) * 255.0 + 0.25);
  tc.x += g_edge_stepX;
  vec4 s1 = floor(TEXTURE(u_edgeLUT, tc) * 255.0 + 0.25);
  n0 = s0.xy;
  n1 = s0.zw;
  dir = s1.xy;
  // ###TODO direction length

  return true;
}
`;

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
  v_edgeDouble = vec3(1.0);

  bool edgePresent = false;
  vec2 on0, on1, odir;
  if (u_allEdgesVisible || !sampleEdgeOctEncodedNormals(decodeUInt24(a_edge), on0, on1, odir)) {
    edgePresent = u_allEdgesVisible;
  } else {
    // If only one face, first normal will be encoded as zero and edge is always displayed (and at double width).
    // ###TODO double-width edges...
    edgePresent = true;
    if (0.0 != on0.x || 0.0 != on0.y) {
      // ###TODO Need to reserve a bit in a_edge to indicate whether this edge is a silhouette.
      // For now, treat all edges as silhouettes.
      vec3 n0 = MAT_NORM * octDecodeNormal(on0);
      vec3 n1 = MAT_NORM * octDecodeNormal(on1);

      if (kFrustumType_Perspective != u_frustum.z) {
        float perpTol = 4.75e-6;
        if (n0.z * n1.z > perpTol)
          edgePresent = false;
      } else {
        float perpTol = 2.5e-4;

        // ###TODO we need the midpoint of the edge, not the position of the opposite vertex...
        vec4 viewPos = MAT_MV * rawPosition;
        vec3 toEye = normalize(viewPos.xyz);
        float dot0 = dot(n0, toEye);
        float dot1 = dot(n1, toEye);
        if (dot0 * dot1 > perpTol) {
          edgePresent = false;
        }
      }
    }
  }

  v_edgePresent[vertIndex] = edgePresent ? 2.0 : 0.0;

  // ###TODO only double if only one face is visible.
  v_edgeDouble[vertIndex] = edgePresent ? 2.0 : 0.0;
`;

// Fragment shader draws in the line color for fragments close to the edge of the triangle.
// Vertex shader requires WebGL 2 which includes the functionality of the GL_OES_standard_derivatives extension.
const applyWiremesh = `
  const float lineWidth = 1.0;
  const vec3 lineColor = vec3(0.0);
  vec3 delta = fwidth(v_barycentric);
  vec3 factor = smoothstep(vec3(0.0), delta * lineWidth, v_barycentric);

  int index = -1;
  float r = 1.0;
  if (v_edgePresent.x > 1.0) {
    index = 0;
    r = factor.x;
  }

  if (v_edgePresent.y > 1.0 && factor.y < r) {
    r = factor.y;
    index = 1;
  }

  if (v_edgePresent.z > 1.0 && factor.z < r) {
    r = factor.z;
    index = 2;
  }

  if (index >= 0 && v_edgeDouble[index] > 1.0) {
    factor = smoothstep(vec3(0.0), delta * lineWidth * 2.0, v_barycentric);
    r = factor[index];
  }

  bool colorCode = true;
  vec3 color = mix(lineColor, colorCode ? v_barycentric : baseColor.rgb, r);

  return vec4(color, baseColor.a);
`;

const scratchLutParams = new Float32Array(2);

/** Adds to a mesh shader logic to produce an overlaid wiremesh.
 * @internal
 */
export function addWiremesh(builder: ProgramBuilder): void {
  if (!System.instance.isWebGL2)
    return;

  addLookupTable(builder.vert, "edge", "2.0");

  builder.vert.addUniform("u_edgeLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_edgeLUT", (uniform, params) => {
      const surf = params.geometry.asSurface;
      const texture = surf?.edges?.lut.texture;
      if (texture)
        texture.bindSampler(uniform, TextureUnit.EdgeLUT);
      else
        System.instance.ensureSamplerBound(uniform, TextureUnit.EdgeLUT);
    });
  });

  builder.vert.addFunction(decodeUint24);
  builder.vert.addFunction(sampleEdgeNormals);

  builder.vert.addUniform("u_edgeParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_edgeParams", (uniform, params) => {
      const surf = params.geometry.asSurface;
      const lut = surf?.edges?.lut;
      if (lut) {
        scratchLutParams[0] = lut.texture.width;
        scratchLutParams[1] = lut.texture.height;
        uniform.setUniform2fv(scratchLutParams);
      }
    });
  });

  builder.vert.addUniform("u_allEdgesVisible", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_allEdgesVisible", (uniform, params) => {
      uniform.setUniform1i(params.target.currentViewFlags.wiremesh ? /* ###TODO 1 */ 0 : 0);
    });
  });

  builder.addInlineComputedVarying("v_barycentric", VariableType.Vec3, computeBarycentric);
  builder.addInlineComputedVarying("v_edgePresent", VariableType.Vec3, computeEdgePresent);
  builder.addVarying("v_edgeDouble", VariableType.Vec3);

  builder.frag.set(FragmentShaderComponent.ApplyWiremesh, applyWiremesh);
}
