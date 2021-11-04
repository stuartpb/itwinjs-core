/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Input, LabeledInput, ProgressLinear, Radio, Select, SelectOption } from "@itwin/itwinui-react";
import { Dialog, Icon, InputStatus } from "@itwin/core-react";
import { ModalDialogManager } from "@itwin/appui-react";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapTypesOptions } from "../Interfaces";
import {
  IModelApp, MapLayerImageryProviderStatus, MapLayerSettingsService, MapLayerSource,
  MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, ScreenViewport,
} from "@itwin/core-frontend";
import { MapLayerProps } from "@itwin/core-common";
import "./MapUrlDialog.scss";
import { DialogButtonType, SpecialKey } from "@itwin/appui-abstract";

export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
};

interface MapUrlDialogProps {
  activeViewport?: ScreenViewport;
  isOverlay: boolean;
  onOkResult: () => void;
  onCancelResult?: () => void;
  mapTypesOptions?: MapTypesOptions;

  // An optional layer definition can be provide to enable the edit mode
  layerRequiringCredentials?: MapLayerProps;

  mapLayerSourceToEdit?: MapLayerSource;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog(props: MapUrlDialogProps) {
  const { isOverlay, onOkResult, mapTypesOptions } = props;
  const supportWmsAuthentication = (mapTypesOptions?.supportWmsAuthentication ? true : false);

  const getMapUrlFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.url;
    } else if (props.layerRequiringCredentials?.url) {
      return props.layerRequiringCredentials.url;
    }
    return "";
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const getMapNameFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.name;
    } else if (props.layerRequiringCredentials?.name) {
      return props.layerRequiringCredentials.name;
    }
    return "";
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const getFormatFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.formatId;
    } else if (props.layerRequiringCredentials?.formatId) {
      return props.layerRequiringCredentials.formatId;
    }
    return undefined;
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString(props.layerRequiringCredentials || props.mapLayerSourceToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.Name"));
  const [nameInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.NameInputPlaceHolder"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.URL"));
  const [urlInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.UrlInputPlaceHolder"));
  const [iTwinSettingsLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.StoreOnITwinSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.StoreOnModelSettings"));
  const [missingCredentialsLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.MissingCredentials"));
  const [invalidCredentialsLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.InvalidCredentials"));
  const [serverRequireCredentials, setServerRequireCredentials] = React.useState(props.layerRequiringCredentials ?? false);
  const [invalidCredentialsProvided, setInvalidCredentialsProvided] = React.useState(false);
  const [layerAttachPending, setLayerAttachPending] = React.useState(false);
  const [warningMessage, setWarningMessage] = React.useState(props.layerRequiringCredentials ? missingCredentialsLabel : undefined);
  const [mapUrl, setMapUrl] = React.useState(getMapUrlFromProps());
  const [mapName, setMapName] = React.useState(getMapNameFromProps());
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:AuthenticationInputs.Password"));
  const [passwordRequiredLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:AuthenticationInputs.PasswordRequired"));
  const [userNameLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:AuthenticationInputs.Username"));
  const [userNameRequiredLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:AuthenticationInputs.UsernameRequired"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("ITwin");

  const [mapType, setMapType] = React.useState(getFormatFromProps() ?? MAP_TYPES.arcGis);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [mapTypes] = React.useState((): SelectOption<string>[] => {
    const types = [
      { value: MAP_TYPES.arcGis, label: MAP_TYPES.arcGis },
      { value: MAP_TYPES.wms, label: MAP_TYPES.wms },
      { value: MAP_TYPES.wmts, label: MAP_TYPES.wmts },
    ];
    if (mapTypesOptions?.supportTileUrl)
      types.push({ value: MAP_TYPES.tileUrl, label: MAP_TYPES.tileUrl });
    return types;
  });

  const [isSettingsStorageAvailable] = React.useState(props?.activeViewport?.iModel?.iTwinId && props?.activeViewport?.iModel?.iModelId);

  // Even though the settings storage is available,
  // we don't always want to enable it in the UI.
  const [settingsStorageDisabled] = React.useState(!isSettingsStorageAvailable || props.mapLayerSourceToEdit !== undefined || props.layerRequiringCredentials !== undefined);

  const isAuthSupported = React.useCallback(() => {
    return ((mapType === MAP_TYPES.wms || mapType === MAP_TYPES.wms) && supportWmsAuthentication)
      || mapType === MAP_TYPES.arcGis;
  }, [mapType, supportWmsAuthentication]);

  // const [layerIdxToEdit] = React.useState((): number | undefined => {
  const [layerRequiringCredentialsIdx] = React.useState((): number | undefined => {
    if (props.layerRequiringCredentials === undefined || !props.layerRequiringCredentials.name || !props.layerRequiringCredentials.url) {
      return undefined;
    }

    const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(props.layerRequiringCredentials.name, props.layerRequiringCredentials.url, isOverlay);
    if (indexInDisplayStyle === undefined || indexInDisplayStyle < 0) {
      return undefined;
    } else {
      return indexInDisplayStyle;
    }
  });

  // Update warning message based on the dialog state and server response
  React.useEffect(() => {
    if (invalidCredentialsProvided) {
      setWarningMessage(invalidCredentialsLabel);
    } else if (serverRequireCredentials && (!userName || !password)) {
      setWarningMessage(missingCredentialsLabel);
    } else {
      setWarningMessage(undefined);
    }
  }, [invalidCredentialsProvided, invalidCredentialsLabel, missingCredentialsLabel, serverRequireCredentials, userName, password, setWarningMessage]);

  const handleMapTypeSelection = React.useCallback((newValue: string) => {
    setMapType(newValue);
  }, [setMapType]);

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
    ModalDialogManager.closeDialog();
  }, [props]);

  const onUsernameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
    if (invalidCredentialsProvided)
      setInvalidCredentialsProvided(false);
  }, [setUserName, invalidCredentialsProvided, setInvalidCredentialsProvided]);

  const onPasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    if (invalidCredentialsProvided)
      setInvalidCredentialsProvided(false);
  }, [setPassword, invalidCredentialsProvided, setInvalidCredentialsProvided]);

  const doAttach = React.useCallback(async (source: MapLayerSource): Promise<boolean> => {
    // Returns a promise, When true, the dialog should closed
    return new Promise<boolean>((resolve, _reject) => {
      const vp = props?.activeViewport;
      if (vp === undefined || source === undefined) {
        resolve(true);
        return;
      }

      const storeOnIModel = "Model" === settingsStorage;
      source.validateSource(true).then(async (validation) => {
        if (validation.status === MapLayerSourceStatus.Valid
          || validation.status === MapLayerSourceStatus.RequireAuth
          || validation.status === MapLayerSourceStatus.InvalidCredentials) {
          const sourceRequireAuth = (validation.status === MapLayerSourceStatus.RequireAuth);
          const invalidCredentials = (validation.status === MapLayerSourceStatus.InvalidCredentials);
          const closeDialog = !sourceRequireAuth && !invalidCredentials;
          resolve(closeDialog);

          if (sourceRequireAuth && !serverRequireCredentials) {
            setServerRequireCredentials(true);
          }
          if (invalidCredentials) {
            setInvalidCredentialsProvided(true);
            return;
          } else if (invalidCredentialsProvided) {
            setInvalidCredentialsProvided(false);  // flag reset
          }

          if (validation.status === MapLayerSourceStatus.Valid) {
            // Attach layer and update settings service (only if editing)
            if (layerRequiringCredentialsIdx !== undefined) {
              // Update username / password
              vp.displayStyle.changeMapLayerProps({
                subLayers: validation.subLayers,
              }, layerRequiringCredentialsIdx, isOverlay);
              vp.displayStyle.changeMapLayerCredentials(layerRequiringCredentialsIdx, isOverlay, source.userName, source.password);

              // Reset the provider's status
              const provider = vp.getMapLayerImageryProvider(layerRequiringCredentialsIdx, isOverlay);
              if (provider && provider.status !== MapLayerImageryProviderStatus.Valid) {
                provider.status = MapLayerImageryProviderStatus.Valid;
              }
            } else {
              // Update service settings if storage is available and we are not prompting user for credentials
              if (!settingsStorageDisabled && !props.layerRequiringCredentials) {
                if (!(await MapLayerSettingsService.storeSourceInSettingsService(source, storeOnIModel, vp.iModel.iTwinId!, vp.iModel.iModelId!)))
                  return;
              }
              const layerSettings = source.toLayerSettings(validation.subLayers);
              if (layerSettings) {
                vp.displayStyle.attachMapLayerSettings(layerSettings, isOverlay, undefined);

                const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttached", { sourceName: source.name, sourceUrl: source.url });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
              } else {
                const msgError = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Messages.MapLayerLayerSettingsConversionError");
                const msg = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.MapLayerAttachError", { error: msgError, sourceUrl: source.url });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
              }
            }

            vp.invalidateRenderPlan();
          }

          if (closeDialog) {
            // This handler will close the layer source handler, and therefore the MapUrl dialog.
            // don't call it if the dialog needs to remains open.
            onOkResult();
          }

        } else {
          const msg = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.ValidationError");
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} ${source.url}`));
          resolve(true);
        }
        resolve(false);
      }).catch((error) => {
        const msg = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.MapLayerAttachError", { error, sourceUrl: source.url });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        resolve(true);
      });
    });
  }, [props.activeViewport, props.layerRequiringCredentials, settingsStorage, serverRequireCredentials, invalidCredentialsProvided, onOkResult, layerRequiringCredentialsIdx, isOverlay, settingsStorageDisabled]);

  const onNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapName(event.target.value);
  }, [setMapName]);

  const onRadioChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsStorageRadio(event.target.value);
  }, [setSettingsStorageRadio]);

  const onUrlChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(event.target.value);
  }, [setMapUrl]);

  const handleOk = React.useCallback(() => {
    let source: MapLayerSource | undefined;
    if (mapUrl && mapName) {
      source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType,
        userName,
        password,
      });

      if (source === undefined || props.mapLayerSourceToEdit) {

        ModalDialogManager.closeDialog();

        if (source === undefined) {
          // Close the dialog and inform end user something went wrong.
          const msgError = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Messages.MapLayerLayerSourceCreationFailed");
          const msg = MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:CustomAttach.MapLayerAttachError", { error: msgError, sourceUrl: mapUrl });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
          return;
        }

        // Simply change the source definition in the setting service
        if (props.mapLayerSourceToEdit !== undefined) {
          const vp = props.activeViewport;
          void (async () => {
            if (isSettingsStorageAvailable && vp) {
              if (!(await MapLayerSettingsService.replaceSourceInSettingsService(props.mapLayerSourceToEdit!, source, vp.iModel.iTwinId!, vp.iModel.iModelId!))) {
                const errorMessage = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerEditError", { layerName: props.mapLayerSourceToEdit?.name });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
                return;
              }

            }
          })();
          return;
        }
      }

      setLayerAttachPending(true);

      void (async () => {
        // Code below is executed in the an async manner but
        // I don't necessarily  want to mark the handler as async
        // so Im wrapping it un in a void wrapper.
        try {
          const closeDialog = await doAttach(source);
          if (isMounted.current) {
            setLayerAttachPending(false);
          }

          // In theory the modal dialog should always get closed by the parent
          // AttachLayerPanel's 'onOkResult' handler.  We close it here just in case.
          if (closeDialog) {
            ModalDialogManager.closeDialog();
          }
        } catch (_error) {
          ModalDialogManager.closeDialog();
        }
      })();
    }

  }, [mapUrl, mapName, mapType, userName, password, props.mapLayerSourceToEdit, props.activeViewport, isSettingsStorageAvailable, doAttach]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const readyToSave = React.useCallback(() => {
    const credentialsSet = !!userName && !!password;
    return (!!mapUrl && !!mapName)
      && (!serverRequireCredentials || (serverRequireCredentials && credentialsSet) && !layerAttachPending)
      && !invalidCredentialsProvided;
  }, [mapUrl, mapName, userName, password, layerAttachPending, invalidCredentialsProvided, serverRequireCredentials]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [readyToSave, handleCancel, handleOk]);

  const handleOnKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === SpecialKey.Enter) {
      if (readyToSave())
        handleOk();
    }
  }, [handleOk, readyToSave]);

  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-url-dialog"
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={120}
        maxWidth={600}
        titleStyle={{paddingLeft: "10px"}}
        footerStyle={{paddingBottom: "10px", paddingRight: "10px"}}
        trapFocus={false}
      >
        <div className="map-layer-url-dialog-content">
          <div className="map-layer-source-url">
            <span className="map-layer-source-label">{typeLabel}</span>
            <Select
              className="map-layer-source-select"
              options={mapTypes}
              value={mapType}
              disabled={props.layerRequiringCredentials !== undefined || props.mapLayerSourceToEdit !== undefined}
              onChange={handleMapTypeSelection}
              size="small"/>
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input className="map-layer-source-input" placeholder={nameInputPlaceHolder} onChange={onNameChange} value={mapName} disabled={props.layerRequiringCredentials !== undefined} size="small" />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input className="map-layer-source-input" placeholder={urlInputPlaceHolder} onKeyPress={handleOnKeyDown} onChange={onUrlChange} disabled={props.mapLayerSourceToEdit !== undefined} value={mapUrl} size="small" />
            {isAuthSupported() && props.mapLayerSourceToEdit === undefined &&
              <>
                <span className="map-layer-source-label">{userNameLabel}</span>
                <LabeledInput
                  className="map-layer-source-input"
                  displayStyle="inline"
                  placeholder={serverRequireCredentials ? userNameRequiredLabel : userNameLabel}
                  status={!userName && serverRequireCredentials ? InputStatus.Warning : undefined}
                  onChange={onUsernameChange}
                  size="small" />

                <span className="map-layer-source-label">{passwordLabel}</span>
                <LabeledInput
                  className="map-layer-source-input"
                  displayStyle="inline"
                  type="password" placeholder={serverRequireCredentials ? passwordRequiredLabel : passwordLabel}
                  status={!password && serverRequireCredentials ? InputStatus.Warning : undefined}
                  onChange={onPasswordChange}
                  onKeyPress={handleOnKeyDown}
                  size="small" />
              </>
            }

            {/* Store settings options, not shown when editing a layer */}
            {isSettingsStorageAvailable && <div title={settingsStorageDisabled ? noSaveSettingsWarning : ""}>
              <Radio disabled={settingsStorageDisabled}
                name="settingsStorage" value="iTwin"
                label={iTwinSettingsLabel} checked={settingsStorage === "iTwin"}
                onChange={onRadioChange} />
              <Radio disabled={settingsStorageDisabled}
                name="settingsStorage" value="Model"
                label={modelSettingsLabel} checked={settingsStorage === "Model"}
                onChange={onRadioChange} />
            </div>}
          </div>
        </div>

        {/* Warning message */}
        <div className="map-layer-source-warnMessage">
          {warningMessage ?
            <>
              <Icon className="map-layer-source-warnMessage-icon" iconSpec="icon-status-warning" />
              <span className="map-layer-source-warnMessage-label">{warningMessage}</span >
            </>
            :
            // Place holder to avoid dialog resize
            <span className="map-layer-source-placeholder">&nbsp;</span>
          }
        </div>

        {/* Progress bar */}
        {layerAttachPending &&
          <div className="map-layer-source-progressBar">
            <ProgressLinear indeterminate />
          </div>
        }
      </Dialog>
    </div >
  );
}
