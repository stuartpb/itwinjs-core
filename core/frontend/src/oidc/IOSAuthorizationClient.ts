/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AuthStatus, BeEvent, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessToken, ImsAuthorizationClient } from "@bentley/itwin-client";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";

const loggerCategory: string = FrontendLoggerCategory.IOSAuthorizationClient;

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class IOSAuthorizationClient extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _accessToken: AccessToken | undefined;
  public constructor() {
    super();
  }

  /** Initialize client by hooking to notifOidcClient handler called by native side */
  public async initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      (window as any).notifyOidcClient = () => {
        this.reloadInfo();
        this.onUserStateChanged.raiseEvent(this._accessToken);
      };
      resolve();
    });
  }

  /** Load oidc info that is set by native side and set access_token */
  private reloadInfo() {
    const settings = window.localStorage.getItem("ios:oidc_info");
    const info = JSON.parse(settings!);
    this._accessToken = AccessToken.fromTokenResponseJson(info, info.user_info);
  }

  /** Start the sign-in process */
  public async signIn(_requestContext: ClientRequestContext): Promise<void> {
    (window as any).webkit.messageHandlers.signIn.postMessage("");
  }

  /** Start the sign-out process */
  public async signOut(_requestContext: ClientRequestContext): Promise<void> {
    (window as any).webkit.messageHandlers.signOut.postMessage("");
  }

  /** return accessToken */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this._accessToken)
      return this._accessToken;
    if (requestContext)
      requestContext.enter();
    throw new BentleyError(AuthStatus.Error, "Not authorized.", Logger.logError, loggerCategory);
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return !!this._accessToken;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined, message: string) => void>();
}
