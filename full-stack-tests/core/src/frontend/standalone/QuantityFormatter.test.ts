/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, QuantityFormatter, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { SchemaContext, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { assert } from "chai";

describe("QuantityFormatter", () => {
  let context = new SchemaContext();
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  beforeEach(async () => {
    imodel = await SnapshotConnection.openFile("testUnits.bim"); // relative path resolved by BackendTestAssetResolver
    const schemaLocater = new ECSchemaRpcLocater(imodel);
    context = new SchemaContext();
    context.addLocater(schemaLocater);
  });

  afterEach(async () => {
    await imodel.close();
  });

  it("QuantityFormatter initialized properly using units schema from iModel", async () => {
    const quantityFormatter = new QuantityFormatter();
    quantityFormatter.unitsProvider = new SchemaUnitProvider(context);
    await quantityFormatter.onInitialized();
    const spec = quantityFormatter.findFormatterSpecByQuantityType("QuantityTypeEnumValue-1");
    assert(spec !== undefined);
  });
});
