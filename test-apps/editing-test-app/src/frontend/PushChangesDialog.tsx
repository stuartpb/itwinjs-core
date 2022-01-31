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
import { useTranslated } from "./Translate";

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
  const title = useTranslated("pushChangesDialog.title");
  const pushLabel = useTranslated("pushChangesDialog.push");
  const cancelLabel = useTranslated("pushChangesDialog.cancel");
  const placeholder = useTranslated("pushChangesDialog.descriptionPlaceholder");

  const handleCancel = () => {
    onClose();
  };

  const buttonCluster: DialogButtonDef[] = [
    {
      type: DialogButtonType.Yes,
      label: pushLabel,
      disabled: !description,
      onClick: () => {
        onClose({
          description,
        });
      },
    },
    {
      type: DialogButtonType.Close,
      label: cancelLabel,
      onClick: handleCancel,
    },
  ];

  return (
    <Dialog
      title={title}
      buttonCluster={buttonCluster}
      opened={true}
      trapFocus={true}
      onClose={handleCancel}
      onEscape={handleCancel}
    >
      <Input
        placeholder={placeholder}
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
