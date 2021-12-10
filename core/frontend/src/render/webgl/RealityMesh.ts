/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, IDisposable } from "@itwin/core-bentley";
import { ColorDef, Quantization, RenderTexture } from "@itwin/core-common";
import { Range2d, Range3d, Transform, Vector2d } from "@itwin/core-geometry";
import { GraphicBranch } from "../GraphicBranch";
import { RealityMeshGraphicParams, RealityMeshPrimitive } from "../primitives/mesh/RealityMeshPrimitive";
import { TerrainMeshPrimitive } from "../primitives/mesh/TerrainMeshPrimitive";
import { RenderGraphic } from "../RenderGraphic";
import { RenderMemory } from "../RenderMemory";
import { RenderPlanarClassifier } from "../RenderPlanarClassifier";
import { RenderSystem, TerrainTexture } from "../RenderSystem";
import { BufferHandle, BufferParameters, QBufferHandle2d, QBufferHandle3d } from "./AttributeBuffers";
import { AttributeMap } from "./AttributeMap";
import { IndexedGeometry, IndexedGeometryParams } from "./CachedGeometry";
import { GL } from "./GL";
import { Matrix4 } from "./Matrix";
import { PlanarClassifier } from "./PlanarClassifier";
import { Primitive } from "./Primitive";
import { RenderOrder, RenderPass } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";

const scratchOverlapRange = Range2d.createNull();
const scratchBytes = new Uint8Array(4);
const scratchBatchBaseId = new Uint32Array(scratchBytes.buffer);
const scratchRange2d = Range2d.createNull();
class ClassifierTexture {
  public classifier: PlanarClassifier;
  constructor(classifier: RenderPlanarClassifier, public meshParams: RealityMeshGraphicParams, public targetRectangle: Range2d) {
    this.classifier = classifier as PlanarClassifier;
  }
  public clone(targetRectangle: Range2d) {
    return new ClassifierTexture(this.classifier, this.meshParams, targetRectangle.clone());
  }
}
type TerrainOrClassifierTexture = TerrainTexture | ClassifierTexture;

class RealityTextureParam {
  constructor(public texture: RenderTexture | undefined, public matrix: Matrix4, private _classifierTexture: ClassifierTexture | undefined) { }
  public get isProjected() { return undefined  !== this._classifierTexture; }

  public getParams(result: Matrix4): Matrix4 {
    if (this._classifierTexture === undefined) {
      result.data[0] = 0;
    } else {
      result.data[0] = 1;
      result.data[1] = this._classifierTexture.classifier.textureImageCount;
      result.data[2] = this._classifierTexture.classifier.sourceTransparency === undefined ? 1.0 : (1.0 - this._classifierTexture.classifier.sourceTransparency);
      scratchBatchBaseId[0] = this._classifierTexture.classifier.baseBatchId;
      result.data[4] = scratchBytes[0];
      result.data[5] = scratchBytes[1];
      result.data[6] = scratchBytes[2];
      result.data[7] = scratchBytes[3];

      const points = [];
      const meshParams = this._classifierTexture.meshParams;
      // Calculate range in the tiles local coordinates.
      const low =  meshParams.tileRectangle.worldToLocal(this._classifierTexture.targetRectangle.low, scratchRange2d.low)!;
      const high = meshParams.tileRectangle.worldToLocal(this._classifierTexture.targetRectangle.high, scratchRange2d.high)!;
      points.push(meshParams.projection.getGlobalPoint(low.x, low.y, 0));
      points.push( meshParams.projection.getGlobalPoint(high.x, low.y, 0));
      points.push(meshParams.projection.getGlobalPoint(high.x, high.y, 0));
      points.push(meshParams.projection.getGlobalPoint(low.x, high.y, 0));
      for (let i = 0, j = 8; i < 4; i++) {
        const projectedPoint = this._classifierTexture.classifier.projectionMatrix.multiplyPoint3dQuietNormalize(points[i]);
        result.data[j++] = projectedPoint.x;
        result.data[j++] = projectedPoint.y;
      }
      const x0 = result.data[10] - result.data[8], y0 = result.data[11] - result.data[9];
      const x1 = result.data[12] - result.data[8], y1 = result.data[13] - result.data[9];
      if (x0 * y1 - x1 * y0 < 0) {
        const swap = ((i: number, j: number) => {
          const temp = result.data[i];
          result.data[i] = result.data[j];
          result.data[j] = temp;
        });
        for (let i = 8, j = 14; i <= 10; i += 2, j -= 2) {
          swap(i, j);
          swap(i + 1, j + 1);
        }
      }
    }
    return result;
  }
}

/** @internal */
export class RealityTextureParams {
  constructor(public params: RealityTextureParam[]) { }
  public static create(textures: TerrainOrClassifierTexture[]) {
    const maxTexturesPerMesh = System.instance.maxRealityImageryLayers;
    assert(textures.length <= maxTexturesPerMesh);

    const textureParams = new Array<RealityTextureParam>();
    for (const texture of textures) {
      if (texture instanceof TerrainTexture) {
        const terrainTexture = texture;
        const matrix = new Matrix4();      // Published as Mat4.
        assert(terrainTexture.texture !== undefined, "Texture not defined in TerrainTextureParams constructor");
        matrix.data[0] = terrainTexture.translate.x;
        matrix.data[1] = terrainTexture.translate.y;
        matrix.data[2] = terrainTexture.scale.x;
        matrix.data[3] = terrainTexture.scale.y;

        if (terrainTexture.clipRectangle) {
          matrix.data[4] = terrainTexture.clipRectangle.low.x;
          matrix.data[5] = terrainTexture.clipRectangle.low.y;
          matrix.data[6] = terrainTexture.clipRectangle.high.x;
          matrix.data[7] = terrainTexture.clipRectangle.high.y;
        } else {
          matrix.data[4] = matrix.data[5] = 0;
          matrix.data[6] = matrix.data[7] = 1;
        }
        matrix.data[8] = (1.0 - terrainTexture.transparency);
        matrix.data[9] = terrainTexture.featureId;
        textureParams.push(new RealityTextureParam(terrainTexture.texture, matrix, undefined));
      } else {
        const classifier = texture.classifier;
        textureParams.push(new RealityTextureParam(classifier.getOrCreateClassifierTexture(), Matrix4.fromMatrix4d(classifier.projectionMatrix), texture));
      }
    }

    for (let i = textures.length; i < maxTexturesPerMesh; i++) {
      const matrix = new Matrix4();
      matrix.data[0] = matrix.data[1] = 0.0;
      matrix.data[2] = matrix.data[3] = 1.0;
      matrix.data[4] = matrix.data[5] = 1;
      matrix.data[6] = matrix.data[7] = -1;
      matrix.data[15] = 0;        // Denotes a terrain texture.
      textureParams.push(new RealityTextureParam(undefined, matrix, undefined));
    }
    return new RealityTextureParams(textureParams);
  }

}

/** @internal */

export class RealityMeshGeometryParams extends IndexedGeometryParams {
  public readonly uvParams: QBufferHandle2d;
  public readonly featureID?: number;
  public readonly normals?: BufferHandle;

  protected constructor(positions: QBufferHandle3d, normals: BufferHandle | undefined, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, featureID?: number) {
    super(positions, indices, numIndices);
    let attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.RealityMesh, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;

    if (undefined !== normals) {
      attrParams = AttributeMap.findAttribute("a_norm", TechniqueId.RealityMesh, false);
      assert(attrParams !== undefined);
      if (normals.bytesUsed > 0)
        this.buffers.addBuffer(normals, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedByte, false, 0, 0, false)]);
      this.normals = normals;
    }
    this.featureID = featureID;
  }

  private static createFromBuffers(posBuf: QBufferHandle3d, uvParamBuf: QBufferHandle2d, indices: Uint16Array, normBuf: BufferHandle | undefined, featureID: number) {
    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indices);

    if (undefined === indBuf)
      return undefined;

    return new RealityMeshGeometryParams(posBuf, normBuf, uvParamBuf, indBuf, indices.length, featureID);

  }

  public static createFromRealityMesh(mesh: RealityMeshPrimitive) {
    const posBuf = QBufferHandle3d.create(mesh.pointQParams, mesh.points);
    const uvParamBuf = QBufferHandle2d.create(mesh.uvQParams, mesh.uvs);
    const normalBuf = mesh.normals ? BufferHandle.createArrayBuffer(mesh.normals) : undefined;
    return (undefined === posBuf || undefined === uvParamBuf) ? undefined : this.createFromBuffers(posBuf, uvParamBuf, mesh.indices, normalBuf, mesh.featureID);
  }

  public override get isDisposed(): boolean {
    return super.isDisposed && this.uvParams.isDisposed;
  }
  public get bytesUsed(): number { return this.positions.bytesUsed + (undefined === this.normals ? 0 : this.normals.bytesUsed) + this.uvParams.bytesUsed + this.indices.bytesUsed; }

  public override dispose() {
    super.dispose();
    dispose(this.uvParams);
  }
}

/** @internal */
export class RealityMeshGeometry extends IndexedGeometry implements IDisposable, RenderMemory.Consumer {
  public override get asRealityMesh(): RealityMeshGeometry | undefined { return this; }
  public override get isDisposed(): boolean { return this._realityMeshParams.isDisposed; }
  public get uvQParams() { return this._realityMeshParams.uvParams.params; }
  public override get hasFeatures(): boolean { return this._realityMeshParams.featureID !== undefined; }
  public override get supportsThematicDisplay() { return true; }
  public get overrideColorMix() { return .5; }     // This could be a setting from either the mesh or the override if required.

  private constructor(private _realityMeshParams: RealityMeshGeometryParams, public textureParams: RealityTextureParams | undefined, private readonly _transform: Transform | undefined, public readonly baseColor: ColorDef | undefined, private _baseIsTransparent: boolean, private _isTerrain: boolean) {
    super(_realityMeshParams);
  }

  public override dispose() {
    super.dispose();
    dispose(this._realityMeshParams);
  }

  public static createFromTerrainMesh(terrainMesh: TerrainMeshPrimitive, transform: Transform | undefined) {
    const params = RealityMeshGeometryParams.createFromRealityMesh(terrainMesh);
    return params ? new RealityMeshGeometry(params, undefined, transform, undefined, false, true) : undefined;
  }

  public static createFromRealityMesh(realityMesh: RealityMeshPrimitive): RealityMeshGeometry | undefined {
    const params = RealityMeshGeometryParams.createFromRealityMesh(realityMesh);
    if (!params)
      return undefined;
    const texture = realityMesh.texture ? new TerrainTexture(realityMesh.texture, realityMesh.featureID, Vector2d.create(1.0, -1.0), Vector2d.create(0.0, 1.0), Range2d.createXYXY(0, 0, 1, 1), 0, 0) : undefined;

    return new RealityMeshGeometry(params, texture ? RealityTextureParams.create([texture]) : undefined, undefined, undefined, false, false);
  }

  public getRange(): Range3d {
    return Range3d.createXYZXYZ(this.qOrigin[0], this.qOrigin[1], this.qOrigin[2], this.qOrigin[0] + Quantization.rangeScale16 * this.qScale[0], this.qOrigin[1] + Quantization.rangeScale16 * this.qScale[1], this.qOrigin[2] + Quantization.rangeScale16 * this.qScale[2]);
  }

  public static createGraphic(system: RenderSystem, params: RealityMeshGraphicParams): RenderGraphic | undefined {
    const meshes = [];
    const textures = params.textures ?? [];
    const realityMesh = params.realityMesh as RealityMeshGeometry;
    const { baseColor, baseTransparent, featureTable, tileId, layerClassifiers } = params;

    const texturesPerMesh = System.instance.maxRealityImageryLayers;
    const layers = new Array<(TerrainTexture | ClassifierTexture)[]>();
    // Collate the textures and classifiers layers into a single array.
    for (const texture of textures) {
      const layer = layers[texture.layerIndex];
      if (layer) {
        (layer as TerrainTexture[]).push(texture);
      } else {
        layers[texture.layerIndex] = [texture];
      }
    }
    params.layerClassifiers?.forEach((layerClassifier, layerIndex) => layers[layerIndex] = [new ClassifierTexture(layerClassifier, params, params.tileRectangle)]);

    if (layers.length < 2 && !layerClassifiers?.size && textures.length < texturesPerMesh) {
      // If only there is not more than one layer then we can group all of the textures into a single draw call.
      meshes.push(new RealityMeshGeometry(realityMesh._realityMeshParams, RealityTextureParams.create(textures), realityMesh._transform, baseColor, baseTransparent, realityMesh._isTerrain));
    } else {
      let primaryLayer;
      while (primaryLayer === undefined)
        primaryLayer = layers.shift();
      if (!primaryLayer)
        return undefined;
      for (const primaryTexture of primaryLayer) {
        const targetRectangle =  primaryTexture.targetRectangle;
        const overlapMinimum = 1.0E-5 * (targetRectangle.high.x - targetRectangle.low.x) * (targetRectangle.high.y - targetRectangle.low.y);
        let layerTextures = [primaryTexture];
        for (const secondaryLayer of layers) {
          if (!secondaryLayer)
            continue;
          for (const secondaryTexture of secondaryLayer) {
            if (secondaryTexture instanceof ClassifierTexture) {
              layerTextures.push(secondaryTexture.clone(targetRectangle));
            } else {
              const secondaryRectangle = secondaryTexture.targetRectangle;
              const overlap = targetRectangle.intersect(secondaryRectangle, scratchOverlapRange);
              if (!overlap.isNull && (overlap.high.x - overlap.low.x) * (overlap.high.y - overlap.low.y) > overlapMinimum) {
                const textureRange = Range2d.createXYXY(overlap.low.x, overlap.low.y, overlap.high.x, overlap.high.y);
                secondaryRectangle.worldToLocal(textureRange.low, textureRange.low);
                secondaryRectangle.worldToLocal(textureRange.high, textureRange.high);

                if (secondaryTexture.clipRectangle)
                  textureRange.intersect(secondaryTexture.clipRectangle, textureRange);

                if (!textureRange.isNull && textureRange) {
                  layerTextures.push(secondaryTexture.cloneWithClip(textureRange));
                }
              }
            }
          }
        }
        while (layerTextures.length > texturesPerMesh) {
          meshes.push(new RealityMeshGeometry(realityMesh._realityMeshParams, RealityTextureParams.create(layerTextures.slice(0, texturesPerMesh)), realityMesh._transform, baseColor, baseTransparent, realityMesh._isTerrain));
          layerTextures = layerTextures.slice(texturesPerMesh);
        }
        meshes.push(new RealityMeshGeometry(realityMesh._realityMeshParams, RealityTextureParams.create(layerTextures), realityMesh._transform, baseColor, baseTransparent, realityMesh._isTerrain));
      }
    }

    if (meshes.length === 0)
      return undefined;

    const branch = new GraphicBranch(true);
    for (const mesh of meshes) {
      const primitive = Primitive.create(mesh);
      branch.add(system.createBatch(primitive!, featureTable, mesh.getRange(), { tileId }));
    }

    return system.createBranch(branch, realityMesh._transform ? realityMesh._transform : Transform.createIdentity());
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._isTerrain ? stats.addTerrain(this._realityMeshParams.bytesUsed) : stats.addRealityMesh(this._realityMeshParams.bytesUsed);
  }

  public get techniqueId(): TechniqueId { return TechniqueId.RealityMesh; }

  public getRenderPass(target: Target): RenderPass {
    if (target.isDrawingShadowMap)
      return RenderPass.None;

    if (this._baseIsTransparent || (target.wantThematicDisplay && target.uniforms.thematic.wantIsoLines))
      return RenderPass.Translucent;

    return RenderPass.OpaqueGeneral;
  }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }

  public override draw(): void {
    this._params.buffers.bind();
    System.instance.context.drawElements(GL.PrimitiveType.Triangles, this._params.numIndices, GL.DataType.UnsignedShort, 0);
    this._params.buffers.unbind();
  }
}
