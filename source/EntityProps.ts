/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModel } from "./IModel";

/** The properties to create an Entity. Every Entity must have an [[IModel]] and the full name of the class that defines it. */
export interface EntityProps {
  iModel: IModel;
  classFullName?: string;
  [propName: string]: any;
}
