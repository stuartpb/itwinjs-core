/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor, LazyLoadedInvertedUnit, LazyLoadedUnit, LazyLoadedFormat } from "../Interfaces";
import Schema from "./Schema";
import Format, { MutableFormat } from "../Metadata/Format";
import Unit from "../Metadata/Unit";
import InvertedUnit from "../Metadata/InvertedUnit";
import { DelayedPromiseWithProps } from "../DelayedPromise";

export const formatStringRgx: RegExp = RegExp(/([\w.:]+)(\(([^\)]+)\))?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?/);

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantity extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _precision: number = 1.0;
  protected _presentationUnits?: LazyLoadedFormat[];
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  public static readonly unitRgx: RegExp = RegExp(/^\[(u\s*\:\s*)?([\w\.]+)\s*(\|)?\s*(.*)?\s*\]$/);
  get precision() { return this._precision; }

  get presentationUnits(): LazyLoadedFormat[] | undefined { return this._presentationUnits; }

  get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  set persistenceUnit(persistenceUnit: LazyLoadedUnit| LazyLoadedInvertedUnit | undefined) { this._persistenceUnit = persistenceUnit; }

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.KindOfQuantity);
    this._presentationUnits = [];
  }

  public get defaultPresentationFormat() {
    return this!.presentationUnits!.length === 0 ? undefined : this!.presentationUnits![0];
  }

  private async processPresentationUnits(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      if (!formatStringRgx.test(formatString)) // throw if formatString is invalid
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `PresentationUnits contains a Format String with an invalid format.`);
      const parsedFormatStr = await this.parseFormatString(formatString);
      await this!._presentationUnits!.push(new DelayedPromiseWithProps(parsedFormatStr.key, async () => parsedFormatStr));
    }
  }

  private async processUnitLabel(overrideLabel: string, unitName: string): Promise<[LazyLoadedUnit | LazyLoadedInvertedUnit, string]> {
    let unitLabelToPush: string = ""; // if unit override label is undefined, use empty string for label
    if (overrideLabel !== undefined) // override label is defined... push old label
      unitLabelToPush = overrideLabel;
    const newUnit = await this.schema.getItem<Unit | InvertedUnit>(unitName, true);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    const unitToBeAdded = new DelayedPromiseWithProps(newUnit.key, async () => newUnit) as LazyLoadedUnit | LazyLoadedInvertedUnit;
    return [unitToBeAdded, unitLabelToPush]; // return new unit label entry
  }

  /**
   * Called to parse a format string and override properties of a Format
   * @param formatString short string-based representation of a Format, which allows overriding of certain key properties
   * @returns object representing {formatName, precision, Array of [unitName, unitLabel?] pairs}
   */
  private async parseFormatString(formatString: string): Promise<Format> {
    let precision: any = null;
    let numUnits: number | undefined;
    let unitArray: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>;
    let unit: any = null;
    let index = 4;  // units reside at indices 4,8,12,16
    let compositeIsDefined: boolean = false;

    // function to determine number of unit overrides from index
    const getNumUnitOverrides = ((x: number) => {
      if (x === 4) return 0; // if index is 4, that means there are 0 units
      else return (x - 4) / 4;
    });

    const match = formatString.split(formatStringRgx); // split string based on regex groups
    const matchedFormat = await this.schema.getItem<Format>(match[1], true); // get format object
    if (!matchedFormat)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Format ${match[1]}.`);
    if (matchedFormat!.composite === undefined) { // if composite is undefined
      compositeIsDefined = false;
    } else { // otherwise, composite is defined
      compositeIsDefined = true;
      numUnits = matchedFormat!.composite!.units!.length; // get how many units this format object has
    }

    if (match[2] !== undefined && match[3] !== undefined) { // if formatString contains optional override of the precision defined in Format
      precision = +match[3].split(",")[0]; // override the precision value, take the first value if it is a list
      if (!Number.isInteger(precision)) // precision value must be an integer
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Precision override must be an integer.`);
    } else {
      precision = matchedFormat.precision; // precision is not present in the format string, so use precision from format object
    }
    unitArray = new Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>(); // array to hold [lazyloadedunit | lazyloadedinvertedLabel, unitLabel?] entries
    while ( index < match.length - 1 ) { // index 0 and 21 are empty strings
      if ( match[index] !== undefined) { // this unit is defined
        unit = match[index].split(KindOfQuantity.unitRgx); // split unit based on regex groups
        let foundUnitName: boolean = false; // did we find a matching unit name in the format?
        if (!compositeIsDefined) { // if no units in format, units in format string are used
          unitArray.push(await this.processUnitLabel(unit[4], unit[2]));
          foundUnitName = true;
        } else { // if composite is defined
          const compositeUnits =  matchedFormat!.composite!.units;
          for (const compUnit of compositeUnits!) {
            const unitValue = await compUnit["0"];
            if ( unit[2].split(".")[1].toLowerCase() === unitValue.name.toLowerCase()) { // we found a match for this unitName
              unitArray.push(await this.processUnitLabel(unit[4], unit[2]));
              foundUnitName = true;
            }
          }
        }
        if ( foundUnitName === false )
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find unit name ${unit[2]}.`);
      } else
        break;
      index += 4; // add 4 to get to next unit
    }
    const numOverrides = getNumUnitOverrides(index);

    if (!compositeIsDefined) // if composite is not defined, number of units depends on format string
      numUnits = numOverrides;
    if (numOverrides !== numUnits) //  # of override units be = # of unit in the composite only if composite is defined - composite is require to have #units > 0
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Number of unit overrides must match number of units present in Format.`);
    if (numOverrides === 0 && numUnits > 0) // if there are no unit overrides and the number of format Units is not zero
      unitArray = matchedFormat!.composite!.units as Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>; // use the format's composite's units

    let newFormat: Format = new Format(this.schema, matchedFormat.name);
    newFormat = Object.assign(newFormat, matchedFormat);
    (newFormat as MutableFormat).setPrecision(precision);
    (newFormat as MutableFormat).setUnits(unitArray);
    const newFormatPromise = new DelayedPromiseWithProps(newFormat.key, async () => newFormat);
    return newFormatPromise;
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.precision)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'precision'.`);
    if (typeof(jsonObj.precision) !== "number")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    this._precision = jsonObj.precision;

    if (undefined === jsonObj.persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'persistenceUnit'.`);
    if (typeof(jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
    const persistenceUnit = await this.schema.getItem<Unit>(jsonObj.persistenceUnit, true);
    if (!persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the persistence unit ${jsonObj.persistenceUnit}.`);
    this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits) && typeof(jsonObj.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
      await this.processPresentationUnits(jsonObj.presentationUnits);
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity(this);
  }
}
