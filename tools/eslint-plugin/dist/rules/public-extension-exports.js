/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");

const syntaxKindFriendlyNames = {
  [ts.SyntaxKind.ClassDeclaration]: "class",
  [ts.SyntaxKind.EnumDeclaration]: "enum",
  [ts.SyntaxKind.InterfaceDeclaration]: "interface",
  [ts.SyntaxKind.ModuleDeclaration]: "module",
  [ts.SyntaxKind.MethodDeclaration]: "method",
  [ts.SyntaxKind.MethodSignature]: "method",
  [ts.SyntaxKind.FunctionDeclaration]: "function",
  [ts.SyntaxKind.GetAccessor]: "getter",
  [ts.SyntaxKind.SetAccessor]: "setter",
  [ts.SyntaxKind.PropertyDeclaration]: "property",
  [ts.SyntaxKind.PropertySignature]: "property",
  [ts.SyntaxKind.Constructor]: "constructor",
  [ts.SyntaxKind.EnumMember]: "enum member",
}

/**
 * This rule prevents the exporting of extension APIs that not not meet certain release tags.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent the exporting of extension APIs that not meet certain release tags.",
      category: "TypeScript",
    },
    messages: {
      forbidden: `{{kind}} "{{name}}" without one of the release tags "{{requiredTags}}".`,
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          requiredTags: {
            type: "array",
            uniqueItems: true,
            items: {
              type: "string",
              enum: ["public", "beta", "alpha", "internal"]
            }
          }
        }
      }
    ]
  },

  create(context) {
    const requiredTags = (context.options.length > 0 && context.options[0].tag) || ["public"];
    const extensionApiTag = "extensionApi"; // SWB temporary extension tag name
    const parserServices = getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();

    function getFileName(parent) {
      let currentParent = parent;
      while (currentParent) {
        if (currentParent.fileName !== undefined)
          return currentParent.fileName;
        currentParent = currentParent.parent;
      }
      return undefined;
    }

    function isLocalFile(declaration) {
      if (declaration) {
        const fileName = getFileName(declaration.parent);
        if (fileName && typeof fileName === "string" && !fileName.includes("node_modules"))
          return true;
      }
      return false;
    }

    function getParentSymbolName(declaration) {
      if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
        return declaration.parent.symbol.escapedName;
      return undefined;
    }

    function checkJsDoc(declaration, node) {
      // Only check local elements, not consumed ones
      if (!declaration || !declaration.jsDoc || !isLocalFile(declaration))
        return undefined;

      for (const jsDoc of declaration.jsDoc)
        if (jsDoc.tags) {
          // Has extension API tag
          if (jsDoc.tags.some(tag => tag.tagName.escapedText === extensionApiTag)) {
            // Does not have any of the required release tags
            if (!jsDoc.tags.some(tag => requiredTags.includes(tag.tagName.escapedText))) {
              let name;
              if (declaration.kind === ts.SyntaxKind.Constructor)
                name = declaration.parent.symbol.escapedName;
              else {
                name = declaration.symbol.escapedName;
                const parentSymbol = getParentSymbolName(declaration);
                if (parentSymbol)
                  name = `${parentSymbol}.${name}`;
              }

              context.report({
                node,
                messageId: "forbidden",
                data: {
                  kind: syntaxKindFriendlyNames.hasOwnProperty(declaration.kind) ? syntaxKindFriendlyNames[declaration.kind] : "unknown object type " + declaration.kind,
                  name,
                  requiredTags: requiredTags,
                }
              });
            }
          }
        }
    }

    function checkWithParent(declaration, node) {
      if (!declaration)
        return;
      checkJsDoc(declaration, node);
      if (declaration.parent && [
        ts.SyntaxKind.ClassDeclaration,
        ts.SyntaxKind.EnumDeclaration,
        ts.SyntaxKind.InterfaceDeclaration,
        ts.SyntaxKind.ModuleDeclaration,
      ].includes(declaration.parent.kind))
        checkJsDoc(declaration.parent, node);
    }

    return {
      TSFunctionDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSMethodDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSClassDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSInterfaceDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSTypeAliasDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSEnumDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSModuleDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSNamespaceExportDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSExportDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },
    };
  }
}