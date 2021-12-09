/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, dispose } from "@itwin/core-bentley";
import { ColorDef, GraphicParams, QParams3d, QPoint3dList, RenderMaterial, RenderTexture, TextureMapping } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicBranch, GraphicBuilder, GraphicType, imageElementFromUrl, IModelApp, IModelConnection, RenderClipVolume, RenderGraphic, Viewport } from "@itwin/core-frontend";
import { MeshArgs } from "@itwin/core-frontend/lib/cjs/render/primitives/mesh/MeshPrimitives";
import { MeshParams } from "@itwin/core-frontend/lib/cjs/render/primitives/VertexTable";
import { Angle, AngleSweep, Arc3d, ClipVector, LinearSweep, Path, Point2d, Point3d, Range3d, Transform, Vector3d, WritableXAndY, XAndY } from "@itwin/core-geometry";

/** Defines the type of panoramic image in the image.
 * @Note: Currently, only cylinder is supported.
*/
export enum PanoramaType {
  /** unsupported */
  Cube,
  /** unsupported */
  Sphere,
  Cylinder,
}

/** Defines an image being to be rendered in the viewport */
export interface ImageProps {
  /** Path to where the image for the texture can be found. */
  url: string;
  /** size, in pixels, of the image */
  size: WritableXAndY;
  /** *FOR TESTING* If the url path will try this one before failing. */
  localPath?: string;

  /** Describes the type of panoramic image. Is undefined if not panoramic. */
  panorama?: PanoramaType;
  /** Describes the angle the panoramic image covers. Is undefined if not panoramic. */
  panoramaArc?: Angle;
}

/** A cached image that is being/has been loaded into the app */
class EarthCamImage {
  public readonly url: string;
  public readonly size: WritableXAndY;
  public readonly type?: PanoramaType;
  public readonly arc?: Angle;
  public texture?: RenderTexture;
  public localPath?: string;

  constructor(props: ImageProps) {
    this.url = props.url;
    this.size = props.size;
    this.localPath = props.localPath;
    this.type = props.panorama;
    this.arc = props.panoramaArc;
  }

  /** Fetches the image from the URL and will create a texture for it. */
  public async populateTexture(): Promise<boolean> {
    if (this.texture !== undefined) return true; // texture is already allocated.
    console.debug("fetching texture");
    this.texture = await allocateTextureFromUrl(this.url, this.localPath);
    return this.texture !== undefined;
  }

  public disposeTexture() {
    this.texture = dispose(this.texture);
  }

  // Didn't work as expected.  Was hoping for a better way that testing url characters.
  // /** Returns true if the images are populated using the same URL. */
  // public equal(image: ImageProps | ArchivedImage) {
  //   return this.url === image.url;
  // }
}

/** Fetches camera image from EarthCam API */
const fetchCameraImage = async (url: string): Promise<HTMLImageElement> => {
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.crossOrigin = "Anonymous";
    img.src = url;

    img.onload = resolve;
    img.onerror = reject;
  });

  return img;
};

/** Allocates memory and creates a RenderTexture from a given URL. */
const allocateTextureFromUrl = async (url: string, localPath?: string): Promise<RenderTexture | undefined> => {
  // Note: the caller takes ownership of the textures, and disposes of those resources when they are no longer needed.
  const isOwned = true;
  const params = new RenderTexture.Params(undefined, undefined, isOwned);
  let texture;
  try {
    const image = await fetchCameraImage(url);
    texture = IModelApp.renderSystem.createTextureFromImage(image, false, undefined, params);
  } catch (err) {
    // Try again locally
    console.error("Error while Loading from remote: ", err);
    if (localPath === undefined)
      return undefined;
    console.log("Attempting to load local copy.");
    const image = await imageElementFromUrl(localPath);
    texture = IModelApp.renderSystem.createTextureFromImage(image, true, undefined, params);
  }

  return texture;
};

/** Returns the Great Common Denominator of the 2 given numbers. */
const gcdTwoNumbers = (x: number, y: number): number => {
  x = Math.abs(x);
  y = Math.abs(y);
  while(y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
};

/** This decorator functions as a particle emitter at the given a XYZ source and the particles are stylized as a fire burning.
 * Note: Assumes up is Z.
 */
export class ImageDecorator implements Decorator {
  private static _imageDecorator?: ImageDecorator;
  private static _clipVolume?: RenderClipVolume;
  private _image?: EarthCamImage;
  private _removeOnDispose?: () => void;
  private _removeOnClose?: () => void;
  private _invalidAfterSwipe?: () => void;

  // static properties
  // TODO: need a better way to pass the alignment information into the decorator
  public static transparency: number = 0;
  public static scaling: number = 100;
  public static origin: Point3d = new Point3d();
  public static panoramicRotationAngle: Angle = Angle.create360();
  public transform: Transform = Transform.createIdentity();

  /** Returns a list of FireEmitter decorators that have been added using the ViewManager API. */
  public static getOrCreate(viewport: Viewport): ImageDecorator {
    return ImageDecorator._imageDecorator ?? new ImageDecorator(viewport);
  }
  /** Disposes of each emitter, triggering disposal of their owned resources. */
  public static dispose() {
    // The FireEmitters collectively own the textures and will dispose of them when no longer required.
    const dec = ImageDecorator._imageDecorator;
    ImageDecorator._imageDecorator = undefined;
    if (!dec)
      return;

    dec.dispose();
    IModelApp.viewManager.dropDecorator(dec);
  }

  private disposeTexture() {
    this._image?.disposeTexture();
  }

  private argToProps(arg: ImageProps): ImageProps {
    return arg;
  }

  /** The clip vector passed in should be flipped with respect to the normally applied clip vector.
   * It could be calculated in the "addToScene(...)" but we want to optimize that method.
   */
  public static setClipVector(clipVector: ClipVector): void {
    ImageDecorator._clipVolume = IModelApp.renderSystem.createClipVolume(clipVector);
  }

  /** Changes the side the comparison will happen on.
   * @Note SwipingComparison is the only object that knows were to create the clipping plane so it must be called from there.
   */
  public flipComparisonSide(_viewport: Viewport) {
    // SwipingComparison.flipComparisonSide(viewport);
  }

  /** If the textures are not created yet, will attempt to create them.  Returns true if successful. */
  public async setImage(arg: ImageProps, disposeOld: boolean = true): Promise<boolean> {
    // if (this._image && this._image.equal(image)) {
    //   return true; // Exit as they are the same image
    // }
    if (disposeOld) this.disposeTexture();
    // get the new image
    const props = this.argToProps(arg);
    this._image = new EarthCamImage(props);
    return this._image.populateTexture();
  }

  /** Drop decorator and attempt to dispose of resources. */
  public dispose() {
    const tryDisposeListener = (func?: () => void) => {
      if (func !== undefined) func();
      func = undefined;
    };
    // Remove listeners
    tryDisposeListener(this._removeOnDispose);
    tryDisposeListener(this._removeOnClose);
    tryDisposeListener(this._invalidAfterSwipe);
  }

  private constructor(viewport: Viewport) {
    ImageDecorator._imageDecorator = this;
    IModelApp.viewManager.addDecorator(this);
    // Due to the constructions of the showcase, we know when the viewport will be closed.  Under different circumstances, the methods below are example events to ensure the timely dispose of textures owned by the decorator.
    // When the iModel is closed, dispose of any decorations.
    this._removeOnClose = viewport.iModel.onClose.addOnce(() => ImageDecorator.dispose());
    // When the viewport is destroyed, dispose of any decorations. too.
    this._removeOnDispose = viewport.onDisposed.addListener(() => ImageDecorator.dispose());
    // Ensures that the image is re-rendered after updating the clipping plane.
    // this._invalidAfterSwipe = SwipingComparison.onSwipeEvent.addListener(() => viewport.invalidateDecorations());
  }

  /** Called by the render loop and adds the fire particles graphics to the context. */
  public decorate(context: DecorateContext): void {
    if (!this._image?.texture || !ImageDecorator._clipVolume)
      return;
    const imageSize = this._image.size;
    const texture = this._image.texture;
    const scaling = ImageDecorator.scaling;
    const gdc = gcdTwoNumbers(imageSize.x, imageSize.y);
    // we reduce the size as much as possible using greatest common denominators to have better control of the size and maintain aspect ratio.
    const size = { x: imageSize.x * scaling / gdc, y: imageSize.y * scaling / gdc };

    // Draw graphics on a branch with the reversed clipping plan.
    //   This allows us to have the clipping plane only effect the decorator and not the model.
    const graphics = this.drawImageOnMesh(context, size, texture, this._image.type, this._image.arc);
    context.addDecoration(GraphicType.WorldOverlay, graphics);
    return;
  }

  /** Returns the graphics for a mesh that as the image texture mapped to it. */
  private drawImageOnMesh(context: DecorateContext, size: XAndY, tx: RenderTexture, type?: PanoramaType, imageArc?: Angle): RenderGraphic {
    let graphic: RenderGraphic;
    switch (type) {
      case PanoramaType.Cylinder:
        const builder = this.setupBuilder(context, tx);
        assert(imageArc !== undefined, "Panoramic images must have an arc defined");
        this.drawCylinder(builder, size, ImageDecorator.origin, imageArc);
        graphic = this.clipGraphics(context, builder.finish());

        break;
      default:
        const params = this.createQuad(size, tx);
        graphic = this.clipGraphics(context, IModelApp.renderSystem.createMesh(params, ImageDecorator.origin));
    }
    return graphic;
  }

  /** This recreates the graphics, but applies the clip volume only to them, not the rest of the view. */
  private clipGraphics(context: DecorateContext, graphic?: RenderGraphic): RenderGraphic{
    const branch = new GraphicBranch(true);
    if (graphic)
      branch.add(graphic);
    return context.createGraphicBranch(branch, this.transform, { clipVolume: ImageDecorator._clipVolume });
  }

  /** Creates a graphics builder that will apply the texture. */
  private setupBuilder(context: DecorateContext, tx: RenderTexture): GraphicBuilder {
    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    // The Material contains the texture of the image
    const material = this.createMaterial(context, tx, context.viewport.iModel);
    const params = new GraphicParams();
    params.material = material;
    builder.activateGraphicParams(params);
    return builder;
  }

  /** Creates the flat mesh the texture will be applied too. */
  private createQuad(size: XAndY, texture: RenderTexture): MeshParams {
    // TODO: Assumes a responsibly low sized image.  Should have a fixed dimension while maintaining the aspect ratio.
    const halfWidth = size.x / 2;
    const halfHeight = size.y / 2;
    const corners = [
      new Point3d(-halfWidth, -halfHeight, 0), new Point3d(halfWidth, -halfHeight, 0),
      new Point3d(-halfWidth, halfHeight, 0), new Point3d(halfWidth,halfHeight, 0),
    ];

    const quadArgs = new MeshArgs();
    const range = new Range3d();
    range.low = corners[0];
    range.high = corners[3];
    quadArgs.points = new QPoint3dList(QParams3d.fromRange(range));
    for (const corner of corners)
      quadArgs.points.add(corner);

    quadArgs.vertIndices = [0, 1, 2, 2, 1, 3];
    quadArgs.textureUv = [ new Point2d(0, 1), new Point2d(1, 1), new Point2d(0, 0), new Point2d(1, 0) ];
    quadArgs.texture = texture;
    quadArgs.colors.initUniform(ColorDef.white.withTransparency(ImageDecorator.transparency));
    quadArgs.isPlanar = true;

    return MeshParams.create(quadArgs);
  }

  /** Creates a Swept Arc mesh the texture will be applied too. */
  private drawCylinder(builder: GraphicBuilder, size: XAndY, origin: Point3d, arc: Angle) {
    // len = 2*pi*r*deg/360
    // len / (2 * pi * deg/360) = r
    // const radius = size.x / (2 * Math.PI * angle/360);
    // maintain constant radius and solve for height based on the aspect ratio
    // ratio = x/y
    // y = x/ratio
    const translate = Transform.createTranslation(origin);
    const radius = 5; // in meters, chosen based on what looked okay
    const tou = 2 * Math.PI;
    const arcLen = tou * radius * arc.radians / (tou);
    const aspectRatio = size.x / size.y;
    const height = arcLen/aspectRatio;

    const downVec = Vector3d.create(0, 0, -height);
    const topOrigin = Point3d.create(0, 0, height*.333);
    translate.multiplyPoint3dArrayInPlace([topOrigin]);

    const start = ImageDecorator.panoramicRotationAngle;
    const end = Angle.createDegrees(start.degrees + arc.degrees);

    // create arc from the start and end angles.
    const baseLine = Arc3d.createXY(topOrigin, radius, AngleSweep.createStartEnd(end, start));
    // creates a set of geometry base on the arc.
    const curveChain = Path.create(baseLine);
    // sweeps that geometry along the vector provided.
    const sweep = LinearSweep.create(curveChain, downVec, false);

    if (sweep)
      builder.addSolidPrimitive(sweep);
  }

  /** Creates a material that contains the texture. */
  private createMaterial(context: DecorateContext, tx: RenderTexture, iModel: IModelConnection): RenderMaterial | undefined {
    const matParams = new RenderMaterial.Params();
    // Lighting
    matParams.diffuseColor = ColorDef.green;
    matParams.shadows = false;
    matParams.ambient = 1;
    matParams.diffuse = 0;
    matParams.alpha = 1;
    // Texture Mapping
    const mapParams = new TextureMapping.Params();
    // identity matrix with no translation
    const transform = new TextureMapping.Trans2x3(1,0,0,0,1,0);
    mapParams.textureMatrix = transform;
    mapParams.weight = 1;
    // Applying texture with map
    matParams.textureMapping = new TextureMapping(tx, mapParams);

    return context.viewport.target.renderSystem.createMaterial(matParams, iModel);
  }
}
