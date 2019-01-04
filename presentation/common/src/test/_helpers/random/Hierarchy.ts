/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { ECInstanceNodeKey, StandardNodeTypes, Node, NodePathElement } from "../../../presentation-common";
import { ECInstanceNodeKeyJSON } from "../../../hierarchy/Key";
import { NodeJSON } from "../../../hierarchy/Node";
import { NodePathElementJSON } from "../../../hierarchy/NodePathElement";
import { nullable, createRandomHexColor, createRandomRgbColor } from "./Misc";
import { createRandomECInstanceKey, createRandomECInstanceKeyJSON } from "./EC";

export const createRandomECInstanceNodeKey = (): ECInstanceNodeKey => {
  return {
    type: "ECInstanceNode",
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
    instanceKey: createRandomECInstanceKey(),
  } as ECInstanceNodeKey;
};

export const createRandomECInstanceNodeKeyJSON = (): ECInstanceNodeKeyJSON => {
  return {
    type: StandardNodeTypes.ECInstanceNode,
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
    instanceKey: createRandomECInstanceKeyJSON(),
  };
};

export const createRandomECInstanceNode = (): Node => {
  return {
    key: createRandomECInstanceNodeKey(),
    label: faker.random.words(),
    description: nullable<string>(faker.lorem.sentence),
    foreColor: nullable<string>(createRandomHexColor),
    backColor: nullable<string>(createRandomRgbColor),
    hasChildren: faker.random.boolean(),
    isSelectionDisabled: faker.random.boolean(),
    isEditable: faker.random.boolean(),
    isChecked: faker.random.boolean(),
    isExpanded: faker.random.boolean(),
    isCheckboxVisible: faker.random.boolean(),
    isCheckboxEnabled: faker.random.boolean(),
  };
};

export const createRandomECInstanceNodeJSON = (): NodeJSON => {
  return {
    key: createRandomECInstanceNodeKeyJSON(),
    label: faker.random.words(),
    description: nullable<string>(faker.lorem.sentence),
    foreColor: nullable<string>(createRandomHexColor),
    backColor: nullable<string>(createRandomRgbColor),
    hasChildren: faker.random.boolean(),
    isSelectionDisabled: faker.random.boolean(),
    isEditable: faker.random.boolean(),
    isChecked: faker.random.boolean(),
    isExpanded: faker.random.boolean(),
    isCheckboxVisible: faker.random.boolean(),
    isCheckboxEnabled: faker.random.boolean(),
  };
};

export const createRandomNodePathElement = (depth: number = 1): NodePathElement => {
  const el: NodePathElement = {
    node: createRandomECInstanceNode(),
    index: faker.random.number(999),
    isMarked: faker.random.boolean(),
    children: [],
  };
  if (depth > 1) {
    let childrenCount = faker.random.number({ min: 1, max: 5 });
    while (childrenCount--)
      el.children.push(createRandomNodePathElement(depth - 1));
  }
  return el;
};

export const createRandomNodePathElementJSON = (depth: number = 1): NodePathElementJSON => {
  const el: NodePathElementJSON = {
    node: createRandomECInstanceNodeJSON(),
    index: faker.random.number(999),
    isMarked: faker.random.boolean(),
    children: [],
    filteringData: { occurances: 0, childrenOccurances: 0 },
  };
  if (depth > 1) {
    let childrenCount = faker.random.number({ min: 1, max: 5 });
    while (childrenCount--)
      el.children.push(createRandomNodePathElementJSON(depth - 1));
  }
  return el;
};
