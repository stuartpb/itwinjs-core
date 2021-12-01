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

const initializeLut = `
  g_edge_step = vec2(1.0) / u_edgeLUTParams.xy;
  g_edge_center = g_edge_step * 0.5;
`;

// The edge index is an integer in [1..numEdges].
// Each edge is represented by 1.5 RGBA values.
// The third component of the returned vec3 is 0 if edge begins at the first 2 bytes of the texel, or 1 if at the second 2 bytes.
const computeLUTCoords = `
vec3 computeEdgeLUTCoords(float edgeIndex) {
  float baseIndex = (edgeIndex - 1.0) * 6.0;
  float halfIndex = baseIndex * 0.5;
  float index = floor(halfIndex);

  float epsilon = 0.5 / u_edgeLUTParams.x;
  float yId = floor(index / u_edgeLUTParams.x + epsilon);
  float xId = index - u_edgeLUTParams.x * yId;

  vec2 texCoord = g_edge_center + vec2(xId, yId) / u_edgeLUTParams.xy;
  return vec3(texCoord, 2.0 * (halfIndex - index));
}
`;

const sampleEdgeNormals = `
bool sampleEdgeOctEncodedNormals(float edgeIndex, out vec2 n0, out vec2 n1, out vec2 dir) {
  if (0.0 == edgeIndex) {
    n0 = n1 = dir = vec2(0.0);
    return false;
  }

  vec3 coords = computeEdgeLUTCoords(edgeIndex);
  vec2 tc = coords.xy;
  vec4 s0 = TEXTURE(u_edgeLUT, tc.xy);
  tc.x += g_edge_step.x;
  vec4 s1 = TEXTURE(u_edgeLUT, tc.xy);
  if (coords.z == 0.0) {
    n0 = s0.xy;
    n1 = s0.zw;
    dir = s1.xy;
  } else {
    n0 = s0.zw;
    n1 = s1.xy;
    dir = s1.zw;
  }

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
`;

// Fragment shader draws in the line color for fragments close to the edge of the triangle.
// Vertex shader requires WebGL 2 which includes the functionality of the GL_OES_standard_derivatives extension.
const applyWiremesh = `
  const float lineWidth = 4.0;
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

const scratchLutParams = new Float32Array(2);

/** Adds to a mesh shader logic to produce an overlaid wiremesh.
 * @internal
 */
export function addWiremesh(builder: ProgramBuilder): void {
  if (!System.instance.isWebGL2)
    return;

  builder.vert.addGlobal("g_edge_step", VariableType.Vec2);
  builder.vert.addGlobal("g_edge_center", VariableType.Vec2);
  builder.vert.addInitializer(initializeLut);

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
  builder.vert.addFunction(computeLUTCoords);
  builder.vert.addFunction(sampleEdgeNormals);

  builder.vert.addUniform("u_edgeLUTParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_edgeLUTParams", (uniform, params) => {
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

  builder.frag.set(FragmentShaderComponent.ApplyWiremesh, applyWiremesh);
}
