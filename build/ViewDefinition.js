"use strict";
/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Element_1 = require("./Element");
const Render_1 = require("./Render");
const Lighting_1 = require("./Lighting");
const IModel_1 = require("./IModel");
const PointVector_1 = require("@bentley/geometry-core/lib/PointVector");
const Geometry_1 = require("@bentley/geometry-core/lib/Geometry");
const Geometry4d_1 = require("@bentley/geometry-core/lib/Geometry4d");
const Constant_1 = require("@bentley/geometry-core/lib/Constant");
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
class ViewController {
}
exports.ViewController = ViewController;
/** The 8 corners of the NPC cube. */
var Npc;
(function (Npc) {
    Npc[Npc["_000"] = 0] = "_000";
    Npc[Npc["_100"] = 1] = "_100";
    Npc[Npc["_010"] = 2] = "_010";
    Npc[Npc["_110"] = 3] = "_110";
    Npc[Npc["_001"] = 4] = "_001";
    Npc[Npc["_101"] = 5] = "_101";
    Npc[Npc["_011"] = 6] = "_011";
    Npc[Npc["_111"] = 7] = "_111";
    Npc[Npc["LeftBottomRear"] = 0] = "LeftBottomRear";
    Npc[Npc["RightBottomRear"] = 1] = "RightBottomRear";
    Npc[Npc["LeftTopRear"] = 2] = "LeftTopRear";
    Npc[Npc["RightTopRear"] = 3] = "RightTopRear";
    Npc[Npc["LeftBottomFront"] = 4] = "LeftBottomFront";
    Npc[Npc["RightBottomFront"] = 5] = "RightBottomFront";
    Npc[Npc["LeftTopFront"] = 6] = "LeftTopFront";
    Npc[Npc["RightTopFront"] = 7] = "RightTopFront";
    Npc[Npc["CORNER_COUNT"] = 8] = "CORNER_COUNT";
})(Npc = exports.Npc || (exports.Npc = {}));
exports.standardView = {
    Top: PointVector_1.RotMatrix.identity,
    Bottom: PointVector_1.RotMatrix.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1),
    Left: PointVector_1.RotMatrix.createRowValues(0, 0, -1, -1, 0, 0, 0, 1, 0),
    Right: PointVector_1.RotMatrix.createRowValues(0, 0, 1, 1, 0, 0, 0, 1, 0),
    Front: PointVector_1.RotMatrix.createRowValues(1, 0, 0, 0, 0, -1, 0, 1, 0),
    Back: PointVector_1.RotMatrix.createRowValues(-1, 0, 0, 0, 0, 1, 0, 1, 0),
    Iso: PointVector_1.RotMatrix.createRowValues(0.707106781186548, 0.408248290463863, -0.577350269189626, -0.70710678118654757, 0.40824829046386302, -0.57735026918962573, 0, 0.81649658092772603, 0.57735026918962573),
    RightIso: PointVector_1.RotMatrix.createRowValues(0.707106781186548, -0.408248290463863, 0.577350269189626, 0.70710678118654757, 0.40824829046386302, -0.57735026918962573, 0, 0.81649658092772603, 0.57735026918962573),
};
exports.standardViewMatrices = [
    exports.standardView.Top, exports.standardView.Bottom, exports.standardView.Left, exports.standardView.Right,
    exports.standardView.Front, exports.standardView.Back, exports.standardView.Iso, exports.standardView.RightIso,
];
/** adjust to any nearby standard view */
function findNearbyStandardViewMatrix(rMatrix) {
    for (const test of exports.standardViewMatrices) {
        if (test.maxDiff(rMatrix) < 1.0e-7) {
            rMatrix.setFrom(test);
            return;
        }
    }
}
/** The region of physical (3d) space that appears in a view. It forms the field-of-view of a camera.
 *  It is stored as 8 points, in NpcCorner order, that must define a truncated pyramid.
 */
class Frustum {
    constructor() { for (let i = 0; i < 8; ++i)
        this.points[i] = new PointVector_1.Point3d(); }
    getCorner(i) { return this.points[i]; }
    getCenter() { return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear)); }
    distance(corner1, corner2) { return this.getCorner(corner1).distance(this.getCorner(corner2)); }
    getFraction() { return this.distance(Npc.LeftTopFront, Npc.RightBottomFront) / this.distance(Npc.LeftTopRear, Npc.RightBottomRear); }
    multiply(trans) { trans.multiplyPoint3dArrayInPlace(this.points); }
    translate(offset) { for (const pt of this.points)
        pt.plus(offset); }
    transformBy(trans, result) { result = result ? result : new Frustum(); trans.multiplyPoint3dArray(this.points, result.points); return result; }
    toRange(range) { range = range ? range : new PointVector_1.Range3d(); PointVector_1.Range3d.createArray(this.points, range); return range; }
    clone(result) { result = result ? result : new Frustum(); for (let i = 0; i < 8; ++i)
        PointVector_1.Point3d.createFrom(this.points[i], result.points[i]); return result; }
    scaleAboutCenter(scale) {
        const orig = this.clone();
        const f = 0.5 * (1.0 + scale);
        orig.getCorner(Npc._111).interpolate(f, orig.getCorner(Npc._000), this.points[Npc._000]);
        orig.getCorner(Npc._011).interpolate(f, orig.getCorner(Npc._100), this.points[Npc._100]);
        orig.getCorner(Npc._101).interpolate(f, orig.getCorner(Npc._010), this.points[Npc._010]);
        orig.getCorner(Npc._001).interpolate(f, orig.getCorner(Npc._110), this.points[Npc._110]);
        orig.getCorner(Npc._110).interpolate(f, orig.getCorner(Npc._001), this.points[Npc._001]);
        orig.getCorner(Npc._010).interpolate(f, orig.getCorner(Npc._101), this.points[Npc._101]);
        orig.getCorner(Npc._100).interpolate(f, orig.getCorner(Npc._011), this.points[Npc._011]);
        orig.getCorner(Npc._000).interpolate(f, orig.getCorner(Npc._111), this.points[Npc._111]);
    }
    toDMap4d() {
        const org = this.getCorner(Npc.LeftBottomRear);
        const xVec = org.vectorTo(this.getCorner(Npc.RightBottomRear));
        const yVec = org.vectorTo(this.getCorner(Npc.LeftTopRear));
        const zVec = org.vectorTo(this.getCorner(Npc.LeftBottomFront));
        return Geometry4d_1.Map4d.createVectorFrustum(org, xVec, yVec, zVec, this.getFraction());
    }
    invalidate() { for (let i = 0; i < 8; ++i)
        this.points[i].set(0, 0, 0); }
    equals(rhs) {
        for (let i = 0; i < 8; ++i) {
            if (!this.points[i].isExactEqual(rhs.points[i]))
                return false;
        }
        return true;
    }
    /** Initialize this Frustum from a Range3d */
    initFromRange(range) {
        const pts = this.points;
        pts[0].x = pts[3].x = pts[4].x = pts[7].x = range.low.x;
        pts[1].x = pts[2].x = pts[5].x = pts[6].x = range.high.x;
        pts[0].y = pts[1].y = pts[4].y = pts[5].y = range.low.y;
        pts[2].y = pts[3].y = pts[6].y = pts[7].y = range.high.y;
        pts[0].z = pts[1].z = pts[2].z = pts[3].z = range.low.z;
        pts[4].z = pts[5].z = pts[6].z = pts[7].z = range.high.z;
    }
    /** Create a new Frustum from a Range3d */
    static fromRange(range) {
        const frustum = new Frustum();
        frustum.initFromRange(range);
        return frustum;
    }
}
exports.Frustum = Frustum;
/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
class DisplayStyle extends Element_1.DefinitionElement {
    constructor(props) { super(props); }
    getStyles() { const p = this.jsonProperties; if (!p.styles)
        p.styles = new Object(); return p.styles; }
    getStyle(name) {
        const style = this.getStyles()[name];
        return style ? style : new Object();
    }
    /** change the value of a style on this DisplayStyle */
    setStyle(name, value) { this.getStyles()[name] = value; }
    /** Remove a Style from this DisplayStyle. */
    removeStyle(name) { delete this.getStyles()[name]; }
    /** Get the background color for this DisplayStyle */
    getBackgroundColor() {
        const color = this.getStyle("backgroundColor");
        return color ? color : Render_1.ColorDef.black();
    }
    /** Set the background color for this DisplayStyle */
    setBackgroundColor(val) { this.setStyle("backgroundColor", val); }
    getMonochromeColor() {
        const color = this.getStyle("monochromeColor");
        return color ? color : Render_1.ColorDef.black();
    }
    setMonochromeColor(val) { this.setStyle("monochromeColor", val); }
}
exports.DisplayStyle = DisplayStyle;
/** A DisplayStyle for 2d views */
class DisplayStyle2d extends DisplayStyle {
    constructor(props) { super(props); }
}
exports.DisplayStyle2d = DisplayStyle2d;
/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
class GroundPlane {
    constructor() {
        this.enabled = false;
        this.elevation = 0.0; // the Z height to draw the ground plane
    }
}
exports.GroundPlane = GroundPlane;
class SkyBox {
    constructor() {
        this.enabled = false;
        this.twoColor = false;
        this.groundExponent = 4.0; // if no jpeg file, the cutoff between ground and nadir
        this.skyExponent = 4.0; // if no jpeg file, the cutoff between sky and zenith
    }
}
exports.SkyBox = SkyBox;
/** A DisplayStyle for 3d views */
class DisplayStyle3d extends DisplayStyle {
    constructor(props) { super(props); }
    getHiddenLineParams() { return this.getStyle("hline"); }
    setHiddenLineParams(params) { this.setStyle("hline", params); }
    setSceneLight(light) {
        if (!light.isValid())
            return;
        const sceneLights = this.getStyle("sceneLights");
        switch (light.lightType) {
            case Lighting_1.LightType.Ambient:
                sceneLights.ambient = light;
                break;
            case Lighting_1.LightType.Flash:
                sceneLights.flash = light;
                break;
            case Lighting_1.LightType.Portrait:
                sceneLights.portrait = light;
                break;
        }
    }
    setSolarLight(light, direction) {
        const sceneLights = this.getStyle("sceneLights");
        if (light.lightType !== Lighting_1.LightType.Solar || !light.isValid()) {
            delete sceneLights.sunDir;
            return;
        }
        sceneLights.sun = light;
        sceneLights.sunDir = direction;
    }
    setSceneBrightness(fstop) { Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
    getSceneBrightness() { return this.getStyle("sceneLights").fstop; }
}
exports.DisplayStyle3d = DisplayStyle3d;
/** A list of GeometricModels for a SpatialViewDefinition.
 *  When a SpatialViewDefinition is loaded into a ViewController, it makes a copy of its ModelSelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
class ModelSelector extends Element_1.DefinitionElement {
    constructor(props) { super(props); this.models = new Set(); }
    /** Get the name of this ModelSelector */
    getName() { return this.code.getValue(); }
    /** Query if the specified DgnModelId is selected by this ModelSelector */
    containsModel(modelId) { return this.models.has(modelId.toString()); }
    /**  Add a model to this ModelSelector */
    addModel(id) { this.models.add(id.toString()); }
    /** Drop a model from this ModelSelector. Model will no longer be displayed by views that use this ModelSelector.
     *  @return true if the model was dropped, false if it was not previously in this ModelSelector
     */
    dropModel(id) { return this.models.delete(id.toString()); }
}
exports.ModelSelector = ModelSelector;
/** A list of Categories to be displayed in a view.
 *  When a ViewDefinition is loaded into memory, it makes a copy of its CategorySelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
class CategorySelector extends Element_1.DefinitionElement {
    constructor(props) { super(props); this.categories = new Set(); }
    /** Get the name of this CategorySelector */
    getName() { return this.code.getValue(); }
    /** Determine whether this CategorySelector includes the specified category */
    isCategoryViewed(categoryId) { return this.categories.has(categoryId.toString()); }
    /**  Add a category to this CategorySelector */
    addCategory(id) { this.categories.add(id.toString()); }
    /** Drop a category from this CategorySelector */
    dropCategory(id) { return this.categories.delete(id.toString()); }
    /** Add or Drop a category to this CategorySelector */
    changeCategoryDisplay(categoryId, add) { if (add)
        this.addCategory(categoryId);
    else
        this.dropCategory(categoryId); }
}
exports.CategorySelector = CategorySelector;
var ViewportStatus;
(function (ViewportStatus) {
    ViewportStatus[ViewportStatus["Success"] = 0] = "Success";
    ViewportStatus[ViewportStatus["ViewNotInitialized"] = 1] = "ViewNotInitialized";
    ViewportStatus[ViewportStatus["AlreadyAttached"] = 2] = "AlreadyAttached";
    ViewportStatus[ViewportStatus["NotAttached"] = 3] = "NotAttached";
    ViewportStatus[ViewportStatus["DrawFailure"] = 4] = "DrawFailure";
    ViewportStatus[ViewportStatus["NotResized"] = 5] = "NotResized";
    ViewportStatus[ViewportStatus["ModelNotFound"] = 6] = "ModelNotFound";
    ViewportStatus[ViewportStatus["InvalidWindow"] = 7] = "InvalidWindow";
    ViewportStatus[ViewportStatus["MinWindow"] = 8] = "MinWindow";
    ViewportStatus[ViewportStatus["MaxWindow"] = 9] = "MaxWindow";
    ViewportStatus[ViewportStatus["MaxZoom"] = 10] = "MaxZoom";
    ViewportStatus[ViewportStatus["MaxDisplayDepth"] = 11] = "MaxDisplayDepth";
    ViewportStatus[ViewportStatus["InvalidUpVector"] = 12] = "InvalidUpVector";
    ViewportStatus[ViewportStatus["InvalidTargetPoint"] = 13] = "InvalidTargetPoint";
    ViewportStatus[ViewportStatus["InvalidLens"] = 14] = "InvalidLens";
    ViewportStatus[ViewportStatus["InvalidViewport"] = 15] = "InvalidViewport";
})(ViewportStatus = exports.ViewportStatus || (exports.ViewportStatus = {}));
/** The definition element for a view. ViewDefinitions specify the area/volume that is viewed, and points to a DisplayStyle and a CategorySelector.
 *  Subclasses of ViewDefinition determine which model(s) are viewed.
 *  A ViewController holds an editable copy of a ViewDefinition, and a ViewDefinition holds an editable copy of its DisplayStyle and CategorySelector.
 */
class ViewDefinition extends Element_1.DefinitionElement {
    clearState() { this._categorySelector = undefined; this._displayStyle = undefined; }
    constructor(props) {
        super(props);
        this.categorySelectorId = new IModel_1.Id(props.categorySelectorId);
        this.displayStyleId = new IModel_1.Id(props.displayStyleId);
        if (props.categorySelector)
            this.setCategorySelector(props.categorySelector);
    }
    /**  Get the target point of the view. If there is no camera, center is returned. */
    getTargetPoint() { return this.getCenter(); }
    /**  Get the point at the geometric center of the view. */
    getCenter() {
        const delta = this.getRotation().transpose().multiplyVector(this.getExtents());
        return this.getOrigin().plusScaled(delta, 0.0);
    }
    setupFromFrustum(frustum) {
        const frustPts = frustum.points;
        let viewOrg = frustPts[Npc.LeftBottomRear];
        // frustumX, frustumY, frustumZ are vectors along edges of the frustum. They are NOT unit vectors.
        // X and Y should be perpendicular, and Z should be right handed.
        const frustumX = viewOrg.vectorTo(frustPts[Npc.RightBottomRear]);
        const frustumY = viewOrg.vectorTo(frustPts[Npc.LeftTopRear]);
        const frustumZ = viewOrg.vectorTo(frustPts[Npc.LeftBottomFront]);
        const frustMatrix = PointVector_1.RotMatrix.createPerpendicularUnitColumns(frustumX, frustumY, Geometry_1.AxisOrder.XYZ);
        if (!frustMatrix)
            return ViewportStatus.InvalidWindow;
        findNearbyStandardViewMatrix(frustMatrix);
        const xDir = frustMatrix.getColumn(0);
        const yDir = frustMatrix.getColumn(1);
        const zDir = frustMatrix.getColumn(2);
        // set up view Rotation matrix as rows of frustum matrix.
        const viewRot = frustMatrix.inverse();
        if (!viewRot)
            return ViewportStatus.InvalidWindow;
        // Left handed frustum?
        const zSize = zDir.dotProduct(frustumZ);
        if (zSize < 0.0)
            return ViewportStatus.InvalidWindow;
        const viewDiagRoot = new PointVector_1.Vector3d();
        viewDiagRoot.plus2Scaled(xDir, xDir.dotProduct(frustumX), yDir, yDir.dotProduct(frustumY)); // vectors on the back plane
        viewDiagRoot.plusScaled(zDir, zSize); // add in z vector perpendicular to x,y
        // use center of frustum and view diagonal for origin. Original frustum may not have been orthogonal
        viewOrg = frustum.getCenter();
        viewOrg.plusScaled(viewDiagRoot, -0.5);
        // delta is in view coordinates
        const viewDelta = viewRot.multiplyVector(viewDiagRoot);
        const validSize = this.validateViewDelta(viewDelta, false);
        if (validSize !== ViewportStatus.Success)
            return validSize;
        this.setOrigin(viewOrg);
        this.setExtents(viewDelta);
        this.setRotation(viewRot);
        return ViewportStatus.Success;
    }
    getExtentLimits() { return { minExtent: Constant_1.Constant.oneMillimeter, maxExtent: 2.0 * Constant_1.Constant.diameterOfEarth }; }
    setupDisplayStyle(style) { this._displayStyle = style; this.displayStyleId = style.id; }
    getDetails() { if (!this.jsonProperties.viewDetails)
        this.jsonProperties.viewDetails = new Object(); return this.jsonProperties.viewDetails; }
    adjustAspectRatio(windowAspect) {
        const extents = this.getExtents();
        const viewAspect = extents.x / extents.y;
        windowAspect *= this.getAspectRatioSkew();
        if (Math.abs(1.0 - (viewAspect / windowAspect)) < 1.0e-9)
            return;
        const oldDelta = extents.clone();
        if (viewAspect > windowAspect)
            extents.y = extents.x / windowAspect;
        else
            extents.x = extents.y * windowAspect;
        let origin = this.getOrigin();
        const trans = PointVector_1.Transform.createOriginAndMatrix(PointVector_1.Point3d.createZero(), this.getRotation());
        const newOrigin = trans.multiplyPoint(origin);
        newOrigin.x += ((oldDelta.x - extents.x) / 2.0);
        newOrigin.y += ((oldDelta.y - extents.y) / 2.0);
        origin = trans.inverse().multiplyPoint(newOrigin);
        this.setOrigin(origin);
        this.setExtents(extents);
    }
    validateViewDelta(delta, messageNeeded) {
        const limit = this.getExtentLimits();
        let error = ViewportStatus.Success;
        const limitWindowSize = (v) => {
            if (v < limit.minExtent) {
                v = limit.minExtent;
                error = ViewportStatus.MinWindow;
            }
            else if (v > limit.maxExtent) {
                v = limit.maxExtent;
                error = ViewportStatus.MaxWindow;
            }
            return v;
        };
        delta.x = limitWindowSize(delta.x);
        delta.y = limitWindowSize(delta.y);
        delta.z = limitWindowSize(delta.z);
        if (messageNeeded && error !== ViewportStatus.Success) {
            //      DgnViewport::OutputFrustumErrorMessage(error);
        }
        return error;
    }
    /**  Get the name of this ViewDefinition */
    getName() { return this.code.getValue(); }
    /** Get the current value of a view detail */
    getDetail(name) { const v = this.getDetails()[name]; return v ? v : {}; }
    /** Change the value of a view detail */
    setDetail(name, value) { this.getDetails()[name] = value; }
    /** Remove a view detail */
    removeDetail(name) { delete this.getDetails()[name]; }
    /** Get the CategorySelector for this ViewDefinition.
     *  @note this method may only be called on a writeable copy of a ViewDefinition.
     */
    getCategorySelector() { /*NEEDS_WORK*/ return this._categorySelector; }
    getCategorySelectorId() { return this.categorySelectorId; }
    /** Get the DisplayStyle for this ViewDefinition
     *  @note this is a non-const method and may only be called on a writeable copy of a ViewDefinition.
     */
    getDisplayStyle() { /*NEEDS_WORK*/ return this._displayStyle; }
    getDisplayStyleId() { return this.displayStyleId; }
    /** Set the CategorySelector for this view. */
    setCategorySelector(categories) { this._categorySelector = categories; this.categorySelectorId = categories.id; }
    /** Get the AuxiliaryCoordinateSystem for this ViewDefinition */
    getAuxiliaryCoordinateSystemId() { return new IModel_1.Id(this.getDetail("acs")); }
    /** Set the AuxiliaryCoordinateSystem for this view. */
    setAuxiliaryCoordinateSystem(acsId) {
        if (acsId.isValid())
            this.setDetail("acs", acsId.toString());
        else
            this.removeDetail("acs");
    }
    /** Query if the specified Category is displayed in this view */
    viewsCategory(id) { return this._categorySelector.isCategoryViewed(id); }
    /**  Get the aspect ratio (width/height) of this view */
    getAspectRatio() { const extents = this.getExtents(); return extents.x / extents.y; }
    /** Get the aspect ratio skew (x/y, usually 1.0) that can be used to exaggerate one axis of the view. */
    getAspectRatioSkew() { return JsonUtils_1.JsonUtils.asDouble(this.getDetail("aspectSkew"), 1.0); }
    /** Set the aspect ratio skew for this view */
    setAspectRatioSkew(val) {
        if (!val || val === 1.0) {
            this.removeDetail("aspectSkew");
        }
        else {
            this.setDetail("aspectSkew", val);
        }
    }
    /** Get the unit vector that points in the view X (left-to-right) direction. */
    getXVector() { return this.getRotation().getRow(0); }
    /**  Get the unit vector that points in the view Y (bottom-to-top) direction. */
    getYVector() { return this.getRotation().getRow(1); }
    // //! Get the unit vector that points in the view Z (front-to-back) direction.
    getZVector() { return this.getRotation().getRow(2); }
}
exports.ViewDefinition = ViewDefinition;
/** Margins for "white space" to be left around view volumes for #lookAtVolume.
 *  Values mean "percent of view" and must be between 0 and .25.
 */
// +===============+===============+===============+===============+===============+======*/
// struct MarginPercent
// {
//   private:
//   double m_left;
//   double m_top;
//   double m_right;
//   double m_bottom;
//   double LimitMargin(double val) {return (val < 0.0) ? 0.0 : (val > .25) ? .25 : val; }
//   public:
//   MarginPercent(double left, double top, double right, double bottom) {Init(left, top, right, bottom); }
//   void Init(double left, double top, double right, double bottom)
//   {
//     m_left = LimitMargin(left);
//     m_top = LimitMargin(top);
//     m_right = LimitMargin(right);
//     m_bottom = LimitMargin(bottom);
//   }
// double Left() const   { return m_left;}
// double Top() const    { return m_top;}
// double Right() const  { return m_right;}
// double Bottom() const { return m_bottom;}
// };
// //! Change the volume that this view displays, keeping its current rotation.
// //! @param[in] worldVolume The new volume, in world-coordinates, for the view. The resulting view will show all of worldVolume, by fitting a
// //! view-axis-aligned bounding box around it. For views that are not aligned with the world coordinate system, this will sometimes
// //! result in a much larger volume than worldVolume.
// //! @param[in] aspectRatio The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
// //! match aspectRatio, the shorter axis is lengthened and the volume is centered. If aspectRatio is nullptr, no adjustment is made.
// //! @param[in] margin The amount of "white space" to leave around the view volume (which essentially increases the volume
// //! of space shown in the view.) If nullptr, no additional white space is added.
// //! @param[in] expandClippingPlanes If false, the front and back clipping planes are not moved. This is rarely desired.
// //! @note For 3d views, the camera is centered on the new volume and moved along the view z axis using the default lens angle
// //! such that the entire volume is visible.
// //! @note, for 2d views, only the X and Y values of volume are used.
// DGNPLATFORM_EXPORT void lookAtVolume(DRange3dCR worldVolume, double const* aspectRatio=nullptr, MarginPercent const* margin=nullptr, bool expandClippingPlanes= true);
// DGNPLATFORM_EXPORT void lookAtViewAlignedVolume(DRange3dCR volume, double const* aspectRatio=nullptr, MarginPercent const* margin=nullptr, bool expandClippingPlanes= true);
// };
// /** @addtogroup GROUP_DgnView DgnView Module
// <h4>%ViewDefintion3d Camera</h4>
// This is what the parameters to the camera methods, and the values stored by ViewDefinition3d mean.
// @verbatim
//                v-- {origin}
//           -----+-------------------------------------- -   [back plane]
//           ^\   .                                    /  ^
//           | \  .                                   /   |        P
//         d |  \ .                                  /    |        o
//         e |   \.         {targetPoint}           /     |        s
//         l |    |---------------+----------------|      |        i    [focus plane]
//         t |     \  ^delta.x    ^               /     b |        t
//         a |      \             |              /      a |        i
//         . |       \            |             /       c |        v
//         z |        \           | f          /        k |        e
//           |         \          | o         /         D |        Z
//           |          \         | c        /          i |        |
//           |           \        | u       /           s |        v
//           v            \       | s      /            t |
//           -     -       -----  | D -----               |   [front plane]
//                 ^              | i                     |
//                 |              | s                     |
//     frontDist ->|              | t                     |
//                 |              |                       |
//                 v           \  v  / <- lens angle      v
//                 -              + {eyePoint}            -     positiveX ->
// @endverbatim
//    Notes:
//          - Up vector (positiveY) points out of the screen towards you in this diagram. Likewise delta.y.
//          - The view origin is in world coordinates. It is the point at the lower left of the rectangle at the
//            focus plane, projected onto the back plane.
//          - [delta.x,delta.y] are on the focus plane and delta.z is from the back plane to the front plane.
//          - The three view vectors come from:
// @verbatim
//                 {vector from eyePoint->targetPoint} : -Z (positive view Z points towards negative world Z)
//                 {the up vector}                     : +Y
//                 {Z cross Y}                         : +X
// @endverbatim
//            these three vectors form the rows of the view's RotMatrix
//          - Objects in space in front of the front plane or behind the back plane are not displayed.
//          - The focus plane is not necessarily centered between the front plane and back plane (though it often is). It should generally be
//            between the front plane and the back plane.
//          - targetPoint is not stored in the view parameters. Instead it may be derived from
//            {origin},{eyePoint},[RotMatrix] and focusDist.
//          - The view volume is completely specified by: @verbatim {origin}<delta>[RotMatrix] @endverbatim
//          - Perspective is determined by {eyePoint}, which is independent of the view volume. Sometimes the eyepoint is not centered
//            on the rectangle on the focus plane (that is, a vector from the eyepoint along the viewZ does not hit the view center.)
//            This creates a 1-point perspective, which can be disconcerting. It is usually best to keep the camera centered.
//          - Cameras hold a "lens angle" value which is defines the field-of-view for the camera in radians.
//            The lens angle value is not used to compute the perspective transform for a view. Instead, the lens angle value
//            can be used to reposition {eyePoint} when the view volume or target changes.
//          - View volumes where one dimension is very small or large relative to the other dimensions (e.g. "long skinny telescope" views,
//            or "wide and shallow slices", etc.) are problematic and disallowed based on ratio limits.
// */
/** The current position, lens angle, and focus distance of a camera. */
class Camera {
    constructor() {
        this.focusDistance = 0.0;
        this.eye = new PointVector_1.Point3d(0.0, 0.0, 0.0);
    }
    static isValidLensAngle(val) { return val.radians > (Math.PI / 8.0) && val < Geometry_1.Angle.createRadians(Math.PI); }
    invalidateFocus() { this.focusDistance = 0.0; }
    isFocusValid() { return this.focusDistance > 0.0 && this.focusDistance < 1.0e14; }
    getFocusDistance() { return this.focusDistance; }
    setFocusDistance(dist) { this.focusDistance = dist; }
    isLensValid() { return Camera.isValidLensAngle(this.lens); }
    validateLens() { if (!this.isLensValid())
        this.lens = Geometry_1.Angle.createRadians(Math.PI / 2.0); }
    getLensAngle() { return this.lens; }
    setLensAngle(angle) { this.lens = angle; }
    getEyePoint() { return this.eye; }
    setEyePoint(pt) { this.eye = pt; }
    isValid() { return this.isLensValid() && this.isFocusValid(); }
    isEqual(other) { return this.lens === other.lens && this.focusDistance === other.focusDistance && this.eye.isExactEqual(other.eye); }
    static fromJSON(json) {
        const camera = new Camera();
        if (json) {
            camera.lens = Geometry_1.Angle.fromJSON(json.lens);
            camera.focusDistance = JsonUtils_1.JsonUtils.asDouble(json.focusDistance);
            camera.eye = PointVector_1.Point3d.fromJSON(json.eye);
        }
        return camera;
    }
}
exports.Camera = Camera;
/** Defines a view of 3d models. */
class ViewDefinition3d extends ViewDefinition {
    // protected setupFromFrustum(Frustum const& inFrustum: Frustum): ViewportStatus;
    // protected getTargetPoint(): Point3d;
    static calculateMaxDepth(delta, zVec) {
        // We are going to limit maximum depth to a value that will avoid subtractive cancellation
        // errors on the inverse frustum matrix. - These values will occur when the Z'th row values
        // are very small in comparison to the X-Y values.  If the X-Y values are exactly zero then
        // no error is possible and we'll arbitrarily limit to 1.0E8.
        const depthRatioLimit = 1.0E8; // Limit for depth Ratio.
        const maxTransformRowRatio = 1.0E5;
        const minXYComponent = Math.min(Math.abs(zVec.x), Math.abs(zVec.y));
        const maxDepthRatio = (0.0 === minXYComponent) ? depthRatioLimit : Math.min((maxTransformRowRatio / minXYComponent), depthRatioLimit);
        return Math.max(delta.x, delta.y) * maxDepthRatio;
    }
    getOrigin() { return this.origin; }
    getExtents() { return this.extents; }
    getRotation() { return this.rotation; }
    setOrigin(origin) { this.origin = origin; }
    setExtents(extents) { this.extents = extents; }
    setRotation(rot) { this.rotation = rot; }
    enableCamera() { this._cameraOn = true; }
    supportsCamera() { return true; }
    get cameraOn() { return this._cameraOn; }
    static minimumFrontDistance() { return 300 * Constant_1.Constant.oneMillimeter; }
    isEyePointAbove(elevation) { return !this.cameraOn ? (this.getZVector().z > 0) : (this.getEyePoint().z > elevation); }
    // void VerifyFocusPlane();//!< private
    // DGNPLATFORM_EXPORT DPoint3d ComputeEyePoint(Frustum const& frust) const ;//!< private
    constructor(props) {
        super(props);
        this._cameraOn = JsonUtils_1.JsonUtils.asBool(props.cameraOn);
        this.origin = PointVector_1.Point3d.fromJSON(props.origin);
        this.extents = PointVector_1.Vector3d.fromJSON(props.extents);
        this.rotation = PointVector_1.YawPitchRollAngles.fromJSON(props.angles).toRotMatrix();
        this.camera = Camera.fromJSON(props.camera);
        if (props.displayStyle)
            this.setupDisplayStyle3d(props.displayStyle);
    }
    getDisplayStyle3d() { return this.getDisplayStyle(); }
    setupDisplayStyle3d(style) { super.setupDisplayStyle(style); }
    /**  Turn the camera off for this view. After this call, the camera parameters in this view definition are ignored and views that use it will
     *  display with an orthographic (infinite focal length) projection of the view volume from the view direction.
     *  @note To turn the camera back on, call #lookAt
     */
    turnCameraOff() { this._cameraOn = false; }
    /** Determine whether the camera is valid for this view */
    isCameraValid() { return this.camera.isValid(); }
    /**  Calculate the lens angle formed by the current delta and focus distance */
    calcLensAngle() {
        const maxDelta = Math.max(this.extents.x, this.extents.y);
        return Geometry_1.Angle.createRadians(2.0 * Math.atan2(maxDelta * 0.5, this.camera.getFocusDistance()));
    }
    /**  Position the camera for this view and point it at a new target point.
     * @param[in] eyePoint The new location of the camera.
     * @param[in] targetPoint The new location to which the camera should point. This becomes the center of the view on the focus plane.
     * @param[in] upVector A vector that orients the camera's "up" (view y). This vector must not be parallel to the vector from eye to target.
     * @param[in] viewDelta The new size (width and height) of the view rectangle. The view rectangle is on the focus plane centered on the targetPoint.
     * If viewDelta is nullptr, the existing size is unchanged.
     * @param[in] frontDistance The distance from the eyePoint to the front plane. If nullptr, the existing front distance is used.
     * @param[in] backDistance The distance from the eyePoint to the back plane. If nullptr, the existing back distance is used.
     * @return a status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
     * @note If the aspect ratio of viewDelta does not match the aspect ratio of a DgnViewport into which this view is displayed, it will be
     * adjusted when the DgnViewport is synchronized from this view.
     * @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport.synchWithViewController
     * to see the new changes in the DgnViewport.
     */
    lookAt(eyePoint, targetPoint, upVector, newExtents, frontDistance, backDistance) {
        const yVec = upVector.normalize();
        if (!yVec)
            return ViewportStatus.InvalidUpVector;
        const zVec = this.getEyePoint().vectorTo(targetPoint); // z defined by direction from eye to target
        const focusDist = zVec.normalizeWithLength(zVec).mag; // set focus at target point
        if (focusDist <= ViewDefinition3d.minimumFrontDistance())
            return ViewportStatus.InvalidTargetPoint;
        const xVec = new PointVector_1.Vector3d();
        if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < Geometry_1.Geometry.smallMetricDistance)
            return ViewportStatus.InvalidUpVector; // up is parallel to z
        if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < Geometry_1.Geometry.smallMetricDistance)
            return ViewportStatus.InvalidUpVector;
        // we now have rows of the rotation matrix
        const rotation = PointVector_1.RotMatrix.createRows(xVec, yVec, zVec);
        backDistance = backDistance ? backDistance : this.getBackDistance();
        frontDistance = frontDistance ? frontDistance : this.getFrontDistance();
        const delta = newExtents ? new PointVector_1.Vector3d(Math.abs(newExtents.x), Math.abs(newExtents.y), this.extents.z) : this.extents;
        frontDistance = Math.max(frontDistance, (.5 * Constant_1.Constant.oneMeter));
        backDistance = Math.max(backDistance, focusDist + (.5 * Constant_1.Constant.oneMeter));
        if (backDistance < focusDist)
            backDistance = focusDist + Constant_1.Constant.oneMillimeter;
        if (frontDistance > focusDist)
            frontDistance = focusDist - ViewDefinition3d.minimumFrontDistance();
        if (frontDistance < ViewDefinition3d.minimumFrontDistance())
            frontDistance = ViewDefinition3d.minimumFrontDistance();
        // BeAssert(backDistance > frontDistance);
        delta.z = (backDistance - frontDistance);
        const frontDelta = delta.scale(frontDistance / focusDist);
        const stat = this.validateViewDelta(frontDelta, false); // validate window size on front (smallest) plane
        if (ViewportStatus.Success !== stat)
            return stat;
        if (delta.z > ViewDefinition3d.calculateMaxDepth(delta, zVec))
            return ViewportStatus.MaxDisplayDepth;
        // The origin is defined as the lower left of the view rectangle on the focus plane, projected to the back plane.
        // Start at eye point, and move to center of back plane, then move left half of width. and down half of height
        const origin = eyePoint.plus3Scaled(zVec, -backDistance, xVec, -0.5 * delta.x, yVec, -0.5 * delta.y);
        this.setEyePoint(eyePoint);
        this.setRotation(rotation);
        this.setFocusDistance(focusDist);
        this.setOrigin(origin);
        this.setExtents(delta);
        this.setLensAngle(this.calcLensAngle());
        this.enableCamera();
        return ViewportStatus.Success;
    }
    // //! Position the camera for this view and point it at a new target point, using a specified lens angle.
    // //! @param[in] eyePoint The new location of the camera.
    // //! @param[in] targetPoint The new location to which the camera should point. This becomes the center of the view on the focus plane.
    // //! @param[in] upVector A vector that orients the camera's "up" (view y). This vector must not be parallel to the vector from eye to target.
    // //! @param[in] fov The angle, in radians, that defines the field-of-view for the camera. Must be between .0001 and pi.
    // //! @param[in] frontDistance The distance from the eyePoint to the front plane. If nullptr, the existing front distance is used.
    // //! @param[in] backDistance The distance from the eyePoint to the back plane. If nullptr, the existing back distance is used.
    // //! @return Status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
    // //! @note The aspect ratio of the view remains unchanged.
    // //! @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport::SynchWithViewController
    // //! to see the new changes in the DgnViewport.
    // DGNPLATFORM_EXPORT ViewportStatus lookAtUsingLensAngle(DPoint3dCR eyePoint, DPoint3dCR targetPoint, DVec3dCR upVector,
    //   Angle fov, double const* frontDistance=nullptr, double const* backDistance=nullptr);
    // //! Move the camera relative to its current location by a distance in camera coordinates.
    // //! @param[in] distance to move camera. Length is in world units, direction relative to current camera orientation.
    // //! @return Status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
    // //! @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport::SynchWithViewController
    // //! to see the new changes in the DgnViewport.
    // DGNPLATFORM_EXPORT ViewportStatus MoveCameraLocal(DVec3dCR distance);
    // //! Move the camera relative to its current location by a distance in world coordinates.
    // //! @param[in] distance in world units.
    // //! @return Status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
    // //! @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport::SynchWithViewController
    // //! to see the new changes in the DgnViewport.
    // DGNPLATFORM_EXPORT ViewportStatus MoveCameraWorld(DVec3dCR distance);
    // //! Rotate the camera from its current location about an axis relative to its current orientation.
    // //! @param[in] angle The angle to rotate the camera, in radians.
    // //! @param[in] axis The axis about which to rotate the camera. The axis is a direction relative to the current camera orientation.
    // //! @param[in] aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is nullptr, the camera rotates in place
    // //! (i.e. about the current eyePoint).
    // //! @note Even though the axis is relative to the current camera orientation, the aboutPt is in world coordinates, \b not relative to the camera.
    // //! @return Status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
    // //! @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport::SynchWithViewController
    // //! to see the new changes in the DgnViewport.
    // DGNPLATFORM_EXPORT ViewportStatus RotateCameraLocal(double angle, DVec3dCR axis, DPoint3dCP aboutPt= nullptr);
    // //! Rotate the camera from its current location about an axis in world coordinates.
    // //! @param[in] angle The angle to rotate the camera, in radians.
    // //! @param[in] axis The world-based axis (direction) about which to rotate the camera.
    // //! @param[in] aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is nullptr, the camera rotates in place
    // //! (i.e. about the current eyePoint).
    // //! @return Status indicating whether the camera was successfully positioned. See values at #ViewportStatus for possible errors.
    // //! @note This method modifies this ViewController. If this ViewController is attached to DgnViewport, you must call DgnViewport::SynchWithViewController
    // //! to see the new changes in the DgnViewport.
    // DGNPLATFORM_EXPORT ViewportStatus RotateCameraWorld(double angle, DVec3dCR axis, DPoint3dCP aboutPt= nullptr);
    /** Get the distance from the eyePoint to the front plane for this view. */
    getFrontDistance() { return this.getBackDistance() - this.extents.z; }
    /** Get the distance from the eyePoint to the back plane for this view. */
    getBackDistance() {
        // backDist is the z component of the vector from the origin to the eyePoint .
        const eyeOrg = this.origin.vectorTo(this.getEyePoint());
        this.getRotation().multiplyVector(eyeOrg, eyeOrg);
        return eyeOrg.z;
    }
    // //! Place the eyepoint of the camera so it is centered in the view. This removes any 1-point perspective skewing that may be
    // //! present in the current view.
    // //! @param[in] backDistance optional, If not nullptr, the new the distance from the eyepoint to the back plane. Otherwise the distance from the
    // //! current eyepoint is used.
    // DGNPLATFORM_EXPORT void CenterEyePoint(double const* backDistance=nullptr);
    // //! Center the focus distance of the camera halfway between the front plane and the back plane, keeping the eyepoint,
    // //! lens angle, rotation, back distance, and front distance unchanged.
    // //! @note The focus distance, origin, and delta values are modified, but the view encloses the same volume and appears visually unchanged.
    // DGNPLATFORM_EXPORT void CenterFocusDistance();
    /**  Get the current location of the eyePoint for camera in this view. */
    getEyePoint() { return this.camera.eye; }
    /**  Get the lens angle for this view. */
    getLensAngle() { return this.camera.lens; }
    /**  Set the lens angle for this view.
     *  @param[in] angle The new lens angle in radians. Must be greater than 0 and less than pi.
     *  @note This does not change the view's current field-of-view. Instead, it changes the lens that will be used if the view
     *  is subsequently modified and the lens angle is used to position the eyepoint.
     *  @note To change the field-of-view (i.e. "zoom") of a view, pass a new viewDelta to #lookAt
     */
    setLensAngle(angle) { this.camera.lens = angle; }
    /**  Change the location of the eyePoint for the camera in this view.
     *  @param[in] pt The new eyepoint.
     *  @note This method is generally for internal use only. Moving the eyePoint arbitrarily can result in skewed or illegal perspectives.
     *  The most common method for user-level camera positioning is #lookAt.
     */
    setEyePoint(pt) { this.camera.eye = pt; }
    /**  Set the focus distance for this view.
     *  @note Changing the focus distance changes the plane on which the delta.x and delta.y values lie. So, changing focus distance
     *  without making corresponding changes to delta.x and delta.y essentially changes the lens angle, causing a "zoom" effect
     */
    setFocusDistance(dist) { this.camera.setFocusDistance(dist); }
    /**  Get the distance from the eyePoint to the focus plane for this view. */
    getFocusDistance() { return this.camera.focusDistance; }
}
exports.ViewDefinition3d = ViewDefinition3d;
/** Defines a view of one or more SpatialModels.
 *  The list of viewed models is stored by the ModelSelector.
 */
class SpatialViewDefinition extends ViewDefinition3d {
    constructor(props) { super(props); if (props.modelSelector)
        this.setModelSelector(props.modelSelector); }
    //   DGNPLATFORM_EXPORT void _ToJson(JsonValueR out, JsonValueCR opts) const override;
    //   void _OnInserted(DgnElementP copiedFrom) const override {m_modelSelector=nullptr; T_Super::_OnInserted(copiedFrom); }
    //   void _OnUpdateFinished() const override {m_modelSelector=nullptr; T_Super::_OnUpdateFinished(); }
    //   DGNPLATFORM_EXPORT void _CopyFrom(DgnElementCR el) override;
    //   SpatialViewDefinitionCP _ToSpatialView() const override {return this;}
    //   DGNPLATFORM_EXPORT ViewControllerPtr _SupplyController() const override;
    //   //! Get a writable reference to the ModelSelector for this SpatialViewDefinition
    //   DGNPLATFORM_EXPORT ModelSelectorR GetModelSelector();
    viewsModel(modelId) { return this._modelSelector.containsModel(modelId); }
    /** Set the ModelSelector for this SpatialViewDefinition
     *  @param[in] models The new ModelSelector.
     */
    setModelSelector(models) { this._modelSelector = models; this.modelSelectorId = models.id; }
}
exports.SpatialViewDefinition = SpatialViewDefinition;
/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection. */
class OrthographicViewDefinition extends SpatialViewDefinition {
    constructor(props) { super(props); }
    // DGNPLATFORM_EXPORT ViewControllerPtr _SupplyController() const override;
    // tslint:disable-next-line:no-empty
    enableCamera() { }
    supportsCamera() { return false; }
}
exports.OrthographicViewDefinition = OrthographicViewDefinition;
