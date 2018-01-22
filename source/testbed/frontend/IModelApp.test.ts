/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, iModelApp } from "../../frontend/IModelApp";
import { AccuDraw } from "../../frontend/AccuDraw";
import { IdleTool } from "../../frontend/tools/IdleTool";
import { ToolGroup, Tool } from "../../frontend/tools/Tool";
import { RotateTool, PanTool } from "../../frontend/tools/ViewTool";

// tslint:disable:no-string-literal

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw {
}

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool {
}

let testVal1: string;
let testVal2: string;

/** class to test immediate tool */
class TestImmediate extends Tool {
  public static toolId = "Test.Immediate";
  constructor(val1: string, val2: string) { testVal1 = val1; testVal2 = val2; super(); }
}

class TestRotateTool extends RotateTool {
}

class TestApp extends IModelApp {
  protected onStartup() {
    this._accuDraw = new TestAccuDraw();

    const group = new ToolGroup("TestApp");
    TestIdleTool.register(group);
    TestImmediate.register(group);
    TestRotateTool.register(group);
    this.features.setGate("feature2", { a: true, b: false });
    this.features.setGate("feature5", { val: { str1: "string1", doNot: false } });
  }
}

describe("IModelApp", () => {
  before(async () => {
    TestApp.startup();
  });

  it("TestApp should override correctly", () => {
    assert.instanceOf(iModelApp, TestApp, "test app instance is valid");
    assert.instanceOf(iModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.instanceOf(iModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(iModelApp.tools.run("Test.Immediate", "test1", "test2"), "immediate tool ran");
    assert.equal(testVal1, "test1", "arg1 was correct");
    assert.equal(testVal2, "test2", "arg2 was correct");
    assert.isFalse(iModelApp.tools.run("Not.Found"), "toolId is not registered");
    assert.isTrue(iModelApp.tools.run("View.Pan"), "run view pan");
    assert.instanceOf(iModelApp.toolAdmin.activeViewTool, PanTool, "pan tool is active");

    assert.isUndefined(iModelApp.features.check("feature1.test1"));
    assert.isTrue(iModelApp.features.check("feature2.a"));
    assert.isFalse(iModelApp.features.check("feature2.b"));
    assert.isFalse(iModelApp.features.check("feature5.val.doNot"));
    assert.equal(iModelApp.features.check("feature5.val.str1"), "string1");
    const feature5 = iModelApp.features.check("feature5");
    assert.equal(feature5.val.str1, "string1");

    iModelApp.features.setGate("feat2", false);
    iModelApp.features.setGate("feat3.sub1.val.a", true);
    iModelApp.features.setGate("feat3.sub1.val.b", { yes: true });
    assert.isFalse(iModelApp.features.check("feat2"));
    assert.equal(iModelApp.features.check("feat3.sub1.nothere", "hello"), "hello");
    assert.isTrue(iModelApp.features.check("feat3.sub1.val.a"));
    assert.isTrue(iModelApp.features.check("feat3.sub1.val.b.yes"));
  });

});
