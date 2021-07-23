/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as UiCore from "@bentley/ui-core";
import {ArcGisEnterpriseClientId, EsriOAuth2} from "@bentley/imodeljs-frontend";
import { ModalDialogManager } from "@bentley/ui-framework";
import { EsriOAuthEditDialog, EsriOAuthEditParams } from "./EsriOAuthEditDialog";
import "./MapManagerSettings.scss";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function EsriOAuthSettingsGroup() {
  const [enterpriseClientIds, setEnterpriseClientIds] = React.useState<ArcGisEnterpriseClientId[]|undefined>();
  const [listItemUnderCursor, setListItemUnderCursor] = React.useState<string | undefined>();
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();
  const [uniqueId, setUniqueId] = React.useState(0);
  const [loadingFromSettingService, setLoadingFromSettingService] = React.useState(false);

  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  // Make sure client ids are loaded from setting service
  React.useEffect(() => {
    setLoadingFromSettingService(true);

    void (async () => {
      try {
        await EsriOAuth2.loadFromSettingsService();
        if (isMounted.current) {
          setLoadingFromSettingService(false);
          setEnterpriseClientIds(EsriOAuth2.arcGisEnterpriseClientIds);
        }

      } catch (_error) {
        if (isMounted.current) {
          setLoadingFromSettingService(false);
        }
      }
    })();

  }, []);

  // Handle Remove layer button clicked
  const onItemRemoveButtonClicked = React.useCallback((clientId: ArcGisEnterpriseClientId, event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.

    const clientIds = EsriOAuth2.clientIds;
    if (clientIds === undefined) {
      return;
    }
    const filteredClientIds = clientIds.enterpriseClientIds?.filter((item) => item.serviceBaseUrl !== clientId.serviceBaseUrl);
    EsriOAuth2.clientIds = {arcgisOnlineClientId: clientIds.arcgisOnlineClientId, enterpriseClientIds: filteredClientIds};
    setEnterpriseClientIds(filteredClientIds);
  }, []);

  // Clears the currently selected from the ListBox
  // Only way I found is to set a value not part of the list. A new value need to be used each time.
  const clearListBoxSelectValue = React.useCallback(() => {
    setSelectedValue(`${uniqueId+1}`); // workaround to display the new added item
    setUniqueId(uniqueId+1);
  }, [uniqueId]);

  const onCancelEdit= React.useCallback(() => {
    ModalDialogManager.closeDialog();
    clearListBoxSelectValue();
  }, [clearListBoxSelectValue]);

  const onOkEdit= React.useCallback((params: EsriOAuthEditParams) => {
    ModalDialogManager.closeDialog();
    if (params.baseUrl === undefined){
      // ArcGIS online case
      EsriOAuth2.arcGisOnlineClientId = params.clientId;
    } else {
      EsriOAuth2.setEnterpriseClientId(params.baseUrl, params.clientId);
      setEnterpriseClientIds(EsriOAuth2.arcGisEnterpriseClientIds);
      clearListBoxSelectValue();
    }
    EsriOAuth2.saveInSettingsService();

  }, [clearListBoxSelectValue]);

  const handleClick = React.useCallback((isOnline: boolean, baseUrl?: string) => {
    let clientId: string = "";
    if (isOnline) {
      clientId = EsriOAuth2.arcGisOnlineClientId ?? "";
    } else if (baseUrl) {
      clientId = EsriOAuth2.getMatchingEnterpriseClientId(baseUrl) ?? "";
    }
    ModalDialogManager.openDialog(<EsriOAuthEditDialog
      clientId={clientId}
      baseUrl={isOnline ? undefined : baseUrl}
      onOkResult={onOkEdit}
      onCancelResult={onCancelEdit}
    />);
    return;
  }, [onCancelEdit, onOkEdit]);

  const onListboxValueChange = React.useCallback((newValue: UiCore.ListboxValue, _isControlOrCommandPressed?: boolean)=> {
    let clientId: string = "";
    if (newValue) {
      clientId = EsriOAuth2.getMatchingEnterpriseClientId(newValue) ?? "";
    }
    ModalDialogManager.openDialog(<EsriOAuthEditDialog clientId={clientId} baseUrl={newValue} onOkResult={onOkEdit} onCancelResult={onCancelEdit}/>);

    return;
  }, [onCancelEdit, onOkEdit]);

  return (
    <div className="map-manager-settings-group">
      <fieldset>
        <legend>ESRI OAuth</legend>
        {(loadingFromSettingService) && <UiCore.LoadingSpinner size={UiCore.SpinnerSize.Medium} />}
        {(!loadingFromSettingService) && <>
          <div className="maplayers-settings-container">
            <UiCore.Button className="esriSettings-button" buttonType={UiCore.ButtonType.Hollow} onClick={()=>handleClick(true)}>
            ArcGIS Online
            </UiCore.Button>
          </div>
          <div className="esriSettings-enterprise-clientIds">
            <div className="esriSettings-enterprise-header">
              <span>ArcGIS Enterprise</span>
              <button className="esriSettings-enterprise-add-clientId-button" onClick={()=>handleClick(false, "")}>
                <UiCore.WebFontIcon iconName="icon-add" />
              </button>
            </div>
            <div className="esriSettings-clientIds">
              <UiCore.Listbox
                selectedValue={selectedValue}
                onListboxValueChange={onListboxValueChange}
                className="esriSettings-clientIds-list" >
                {
                  enterpriseClientIds?.map((clientId) =>
                    <UiCore.ListboxItem
                      key={clientId.serviceBaseUrl}
                      className="esriSettings-clientIds-entry"
                      value={clientId.serviceBaseUrl}
                      onMouseEnter={() => setListItemUnderCursor(clientId.serviceBaseUrl)}
                      onMouseLeave={() => setListItemUnderCursor(undefined)}
                    >
                      <span className="esriSettings-clientIds-entry-name" title={clientId.serviceBaseUrl}>{clientId.serviceBaseUrl}</span>

                      { // Display the delete icon only when the mouse over a specific item otherwise list feels cluttered.
                        (listItemUnderCursor && listItemUnderCursor === clientId.serviceBaseUrl) &&
                  <>
                    <UiCore.Button
                      className="esriSettings-clientIds-entry-button"
                      onClick={(event) => {onItemRemoveButtonClicked(clientId, event);}}>
                      <UiCore.Icon iconSpec="icon-delete" />
                    </UiCore.Button>
                  </>}

                    </UiCore.ListboxItem>
                  )
                }
              </UiCore.Listbox>
            </div>
          </div>
        </>}
      </fieldset>
    </div>
  );
}
