/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  DialogButtonDef, DialogButtonType
} from "@itwin/appui-abstract";
import {
  ModalDialogManager,
} from "@itwin/appui-react";
import { Dialog } from "@itwin/core-react";
import { Input } from "@itwin/itwinui-react";

export interface PushChangesDialogInput {
  description: string;
}

interface PushChangesDialogProps {
  onClose(input?: PushChangesDialogInput): void,
}

function PushChangesDialog({
  onClose,
}: PushChangesDialogProps) {
  const [description, setDescription] = React.useState("");

  const onCancel = () => {
    onClose();
  };

  const buttonCluster: DialogButtonDef[] = [
    {
      type: DialogButtonType.Yes,
      label: "Push",
      disabled: !description,
      onClick: () => {
        onClose({
          description,
        });
      },
    },
    {
      type: DialogButtonType.Close,
      label: "Cancel",
      onClick: onCancel,
    },
  ];

  return (
    <Dialog
      title="Push changes"
      buttonCluster={buttonCluster}
      opened={true}
      resizable={false}
      movable={false}
      modal={true}
      trapFocus={true}
      onClose={onCancel}
      onEscape={onCancel}
    >
      <Input
        placeholder="Changeset description..."
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
        }}
      />
    </Dialog>
  );
}

export function openPushChangesDialog(onClose: (input?: PushChangesDialogInput) => void) {
  const dialog = <PushChangesDialog
    onClose={(input) => {
      ModalDialogManager.closeDialog(dialog);
      onClose(input);
    }}
  />;
  ModalDialogManager.openDialog(dialog);
}
