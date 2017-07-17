/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id, IModel, GeometryStream, Placement3d } from "./IModel";
import { registerEcClass } from "./EcRegistry";

export interface ICode {
  spec: Id | string;
  scope: string;
  value?: string;
}

export class Code implements ICode {
  public spec: Id;
  public scope: string;
  public value?: string;

  constructor(val: ICode) {
    this.spec = new Id(val.spec);
    this.scope = val.scope;
    this.value = val.value;
  }

  public static createDefault(): Code { return new Code({ spec: new Id(1), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
}

/** The id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  public id: Id;
  public relationshipClass?: string;
}

export interface IElement {
  _iModel: IModel;
  schemaName: string;
  className: string;
  model: Id | string;
  code: ICode;
  id: Id | string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  jsonProperties?: any;
}

/** An element within an iModel */
@registerEcClass("BisCore.Element")
export class Element {
  public _iModel: IModel;
  public id: Id;
  public model: Id;
  public schemaName: string;
  public className: string;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: string;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element */
  constructor(val: IElement) {
    this.schemaName = val.schemaName;
    this.className = val.className;
    this.id = new Id(val.id);
    this.code = new Code(val.code);
    this._iModel = val._iModel;
    this.model = new Id(val.model);
    this.parent = val.parent;
    this.federationGuid = val.federationGuid;
    this.userLabel = val.userLabel;
    this.jsonProperties = val.jsonProperties ? val.jsonProperties : {};
  }

  public getUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
  public setUserProperties(nameSpace: string, value: any) { this.getUserProperties()[nameSpace] = value; }
  public removeUserProperties(nameSpace: string) { delete this.getUserProperties()[nameSpace]; }
}

export interface IGeometricElement extends IElement {
  category?: Id;
  geom?: GeometryStream;
}

/** A Geometric element */
@registerEcClass("BisCore.GeometricElement")
export class GeometricElement extends Element {
  public category: Id;
  public geom: GeometryStream | null;
  public constructor(opts: IGeometricElement) {
    super(opts);
    this.category = opts.category ? opts.category : new Id();
    this.geom = opts.geom ? opts.geom : null;
  }
}

export class TypeDefinition {
  public definitionId: Id;
  public relationshipClass?: string;
}

export interface IGeometricElement3d extends IGeometricElement {
  placement?: Placement3d;
  typeDefinition?: TypeDefinition;
}

@registerEcClass("BisCore.GeometricElement3d")
export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;
  public constructor(opts: IGeometricElement3d) {
    super(opts);
    this.placement = opts.placement ? opts.placement : new Placement3d();
    this.typeDefinition = opts.typeDefinition;
  }
}

@registerEcClass("BisCore.SpatialElement")
export class SpatialElement extends GeometricElement3d {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

@registerEcClass("BisCore.PhysicalElement")
export class PhysicalElement extends SpatialElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

@registerEcClass("BisCore.PhysicalPortion")
export class PhysicalPortion extends PhysicalElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** A SpatialElement that identifies a "tracked" real word 3-dimensional location but has no mass and cannot be "touched".
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
@registerEcClass("BisCore.SpatialLocationElement")
export class SpatialLocationElement extends SpatialElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
@registerEcClass("BisCore.SpatialLocationPortion")
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
@registerEcClass("BisCore.InformationContentElement")
export class InformationContentElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.InformationReferenceElement")
export class InformationReferenceElement extends InformationContentElement {
  public constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.Subject")
export class Subject extends InformationReferenceElement {
  public constructor(opts: IElement) { super(opts); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
@registerEcClass("BisCore.Document")
export class Document extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.Drawing")
export class Drawing extends Document {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.SectionDrawing")
export class SectionDrawing extends Drawing {
  constructor(opts: IElement) { super(opts); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
@registerEcClass("BisCore.InformationCarrierElement")
export class InformationCarrierElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

/** An information element whose main purpose is to hold an information record. */
@registerEcClass("BisCore.InformationRecordElement")
export class InformationRecordElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
@registerEcClass("BisCore.DefinitionElement")
export class DefinitionElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TypeDefinitionElement")
export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.RecipeDefinitionElement")
export class RecipeDefinitionElement extends DefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
@registerEcClass("BisCore.PhysicalType")
export class PhysicalType extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
@registerEcClass("BisCore.SpatialLocationType")
export class SpatialLocationType extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TemplateRecipe3d")
export class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.GraphicalType2d")
export class GraphicalType2d extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TemplateRecipe2d")
export class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.InformationPartitionElement")
export class InformationPartitionElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.DefinitionPartition")
export class DefinitionPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.DocumentPartition")
export class DocumentPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.GroupInformationPartition")
export class GroupInformationPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.InformationRecordPartition")
export class InformationRecordPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.PhysicalPartition")
export class PhysicalPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.SpatialLocationPartition")
export class SpatialLocationPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
@registerEcClass("BisCore.GroupInformationElement")
export class GroupInformationElement extends InformationReferenceElement {
  constructor(opts: IElement) { super(opts); }
}

/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
@registerEcClass("BisCore.RoleElement")
export class RoleElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

/** A LinkPartition provides a starting point for a LinkModel hierarchy */
@registerEcClass("BisCore.LinkPartition")
export class LinkPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}
