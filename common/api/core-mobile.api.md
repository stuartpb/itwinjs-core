## API Report File for "@itwin/core-mobile"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { AccessToken } from '@itwin/core-bentley';
import { AsyncMethodsOf } from '@itwin/core-bentley';
import { AuthorizationClient } from '@itwin/core-common';
import { BeEvent } from '@itwin/core-bentley';
import { BentleyError } from '@itwin/core-bentley';
import { GetMetaDataFunction } from '@itwin/core-bentley';
import * as https from 'https';
import { IModelAppOptions } from '@itwin/core-frontend';
import { NativeAppOpts } from '@itwin/core-frontend';
import { NativeHostOpts } from '@itwin/core-backend';
import { PromiseReturnType } from '@itwin/core-bentley';
import { RpcConfiguration } from '@itwin/core-common';
import { RpcEndpoint } from '@itwin/core-common';
import { RpcInterfaceDefinition } from '@itwin/core-common';
import { RpcProtocol } from '@itwin/core-common';
import { RpcRequest } from '@itwin/core-common';
import { RpcRequestFulfillment } from '@itwin/core-common';
import { RpcSerializedValue } from '@itwin/core-common';

// @beta (undocumented)
export class AndroidApp {
    // (undocumented)
    static get isValid(): boolean;
    // (undocumented)
    static startup(opts?: {
        mobileApp?: {
            rpcInterfaces?: RpcInterfaceDefinition[];
        };
        iModelApp?: IModelAppOptions;
    }): Promise<void>;
}

// @beta (undocumented)
export class AndroidHost extends MobileHost {
    static startup(opt?: AndroidHostOpts): Promise<void>;
}

// @beta (undocumented)
export type AndroidHostOpts = MobileHostOpts;

// @beta (undocumented)
export enum BatteryState {
    // (undocumented)
    Charging = 2,
    // (undocumented)
    Full = 3,
    // (undocumented)
    Unknown = 0,
    // (undocumented)
    Unplugged = 1
}

// @beta
export interface CancelRequest {
    cancel: () => boolean;
}

// @beta (undocumented)
export type DeviceEvents = "memoryWarning" | "orientationChanged" | "enterForeground" | "enterBackground" | "willTerminate";

// @internal
export class DownloadFailed extends BentleyError {
    constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction);
}

// @beta (undocumented)
export interface DownloadTask {
    // (undocumented)
    cancel?: MobileCancelCallback;
    // (undocumented)
    cancelId?: number;
    // (undocumented)
    doneBytes?: number;
    // (undocumented)
    downloadPath: string;
    // (undocumented)
    isBackground?: boolean;
    // (undocumented)
    isDetached: boolean;
    // (undocumented)
    isRunning: boolean;
    // (undocumented)
    toBackground: () => boolean;
    // (undocumented)
    toForeground: () => boolean;
    // (undocumented)
    totalBytes?: number;
    // (undocumented)
    url: string;
}

// @beta (undocumented)
export class IOSApp {
    // (undocumented)
    static get isValid(): boolean;
    // (undocumented)
    static startup(opts?: IOSAppOpts): Promise<void>;
}

// @beta (undocumented)
export type IOSAppOpts = NativeAppOpts;

// @beta (undocumented)
export class IOSHost extends MobileHost {
    static startup(opt?: IOSHostOpts): Promise<void>;
}

// @beta (undocumented)
export type IOSHostOpts = MobileHostOpts;

// @beta (undocumented)
export class MobileApp {
    // (undocumented)
    static callBackend<T extends AsyncMethodsOf<MobileAppFunctions>>(methodName: T, ...args: Parameters<MobileAppFunctions[T]>): Promise<PromiseReturnType<MobileAppFunctions[T]>>;
    // (undocumented)
    static get isValid(): boolean;
    // (undocumented)
    static onEnterBackground: BeEvent<() => void>;
    // (undocumented)
    static onEnterForeground: BeEvent<() => void>;
    // (undocumented)
    static onMemoryWarning: BeEvent<() => void>;
    // (undocumented)
    static onOrientationChanged: BeEvent<() => void>;
    // (undocumented)
    static onWillTerminate: BeEvent<() => void>;
    // @internal
    static startup(opts?: NativeAppOpts): Promise<void>;
}

// @beta
export interface MobileAppAuthorizationConfiguration {
    readonly clientId: string;
    readonly expiryBuffer?: number;
    issuerUrl?: string;
    readonly redirectUri?: string;
    readonly scope: string;
}

// @beta
export interface MobileAppFunctions {
    // (undocumented)
    reconnect: (connection: number) => Promise<void>;
}

// @beta
export class MobileAuthorizationBackend implements AuthorizationClient {
    constructor(config?: MobileAppAuthorizationConfiguration);
    // (undocumented)
    protected _accessToken?: AccessToken;
    // (undocumented)
    protected _baseUrl: string;
    // (undocumented)
    config?: MobileAppAuthorizationConfiguration;
    // (undocumented)
    static defaultRedirectUri: string;
    // (undocumented)
    expireSafety: number;
    // (undocumented)
    getAccessToken(): Promise<AccessToken>;
    initialize(config?: MobileAppAuthorizationConfiguration): Promise<void>;
    // (undocumented)
    issuerUrl?: string;
    // (undocumented)
    get redirectUri(): string;
    refreshToken(): Promise<AccessToken>;
    // (undocumented)
    setAccessToken(token?: AccessToken): void;
    signIn(): Promise<void>;
    signOut(): Promise<void>;
    // (undocumented)
    protected _url?: string;
}

// @beta (undocumented)
export type MobileCancelCallback = () => boolean;

// @beta (undocumented)
export type MobileCompletionCallback = (downloadUrl: string, downloadFileUrl: string, cancelled: boolean, err?: string) => void;

// @beta (undocumented)
export abstract class MobileDevice {
    // (undocumented)
    abstract authGetAccessToken(callback: (accessToken?: string, err?: string) => void): void;
    // (undocumented)
    authInit(_config: MobileAppAuthorizationConfiguration, callback: (err?: string) => void): void;
    // (undocumented)
    abstract authSignIn(callback: (err?: string) => void): void;
    // (undocumented)
    abstract authSignOut(callback: (err?: string) => void): void;
    // (undocumented)
    abstract authStateChanged(accessToken?: string, err?: string): void;
    // (undocumented)
    abstract cancelDownloadTask(cancelId: number): boolean;
    // (undocumented)
    abstract createDownloadTask(downloadUrl: string, isBackground: boolean, downloadTo: string, completion: MobileCompletionCallback, progress?: MobileProgressCallback): number;
    // (undocumented)
    emit(eventName: DeviceEvents, ...args: any[]): void;
    // (undocumented)
    abstract getBatteryLevel(): number;
    // (undocumented)
    abstract getBatteryState(): BatteryState;
    // (undocumented)
    abstract getDownloadTasks(): DownloadTask[];
    // (undocumented)
    abstract getOrientation(): Orientation;
    // (undocumented)
    abstract reconnect(connection: number): void;
    // (undocumented)
    abstract resumeDownloadInBackground(requestId: number): boolean;
    // (undocumented)
    abstract resumeDownloadInForeground(requestId: number): boolean;
}

// @internal
export class MobileFileHandler {
    constructor();
    // (undocumented)
    agent?: https.Agent;
    basename(filePath: string): string;
    downloadFile(_accessToken: AccessToken, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void>;
    exists(filePath: string): boolean;
    getFileSize(filePath: string): number;
    isDirectory(filePath: string): boolean;
    static isUrlExpired(downloadUrl: string, futureSeconds?: number): boolean;
    join(...paths: string[]): string;
    unlink(filePath: string): void;
    uploadFile(accessToken: AccessToken, uploadUrlString: string, uploadFromPathname: string, progressCallback?: ProgressCallback): Promise<void>;
}

// @beta (undocumented)
export class MobileHost {
    // (undocumented)
    static get device(): MobileDevice;
    // @internal (undocumented)
    static downloadFile(downloadUrl: string, downloadTo: string, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void>;
    // (undocumented)
    static get isValid(): boolean;
    // (undocumented)
    static readonly onEnterBackground: BeEvent<import("@itwin/core-bentley").Listener>;
    // (undocumented)
    static readonly onEnterForeground: BeEvent<import("@itwin/core-bentley").Listener>;
    // (undocumented)
    static readonly onMemoryWarning: BeEvent<import("@itwin/core-bentley").Listener>;
    // (undocumented)
    static readonly onOrientationChanged: BeEvent<import("@itwin/core-bentley").Listener>;
    // (undocumented)
    static readonly onWillTerminate: BeEvent<import("@itwin/core-bentley").Listener>;
    // @internal (undocumented)
    static reconnect(connection: number): void;
    static startup(opt?: MobileHostOpts): Promise<void>;
}

// @beta (undocumented)
export interface MobileHostOpts extends NativeHostOpts {
    // (undocumented)
    mobileHost?: {
        device?: MobileDevice;
        rpcInterfaces?: RpcInterfaceDefinition[];
        authConfig?: MobileAppAuthorizationConfiguration;
    };
}

// @beta (undocumented)
export interface MobileNotifications {
    // (undocumented)
    notifyEnterBackground: () => void;
    // (undocumented)
    notifyEnterForeground: () => void;
    // (undocumented)
    notifyMemoryWarning: () => void;
    // (undocumented)
    notifyOrientationChanged: () => void;
    // (undocumented)
    notifyWillTerminate: () => void;
}

// @beta (undocumented)
export type MobileProgressCallback = (bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => void;

// @beta (undocumented)
export type MobileRpcChunks = Array<string | Uint8Array>;

// @beta
export abstract class MobileRpcConfiguration extends RpcConfiguration {
    static get args(): any;
    static get platform(): RpcMobilePlatform;
    // (undocumented)
    abstract protocol: MobileRpcProtocol;
    // @internal (undocumented)
    static setup: {
        obtainPort: () => number;
        checkPlatform: () => boolean;
    };
}

// @beta (undocumented)
export interface MobileRpcGateway {
    // (undocumented)
    connectionId: number;
    // (undocumented)
    handler: (payload: ArrayBuffer | string, connectionId: number) => void;
    // (undocumented)
    port: number;
    // (undocumented)
    sendBinary: (message: Uint8Array, connectionId: number) => void;
    // (undocumented)
    sendString: (message: string, connectionId: number) => void;
}

// @beta
export class MobileRpcManager {
    static initializeClient(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration;
    static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration;
    // @internal (undocumented)
    static ready(): Promise<void>;
}

// @beta
export class MobileRpcProtocol extends RpcProtocol {
    constructor(configuration: MobileRpcConfiguration, endPoint: RpcEndpoint);
    // (undocumented)
    static encodeRequest(request: MobileRpcRequest): Promise<MobileRpcChunks>;
    // (undocumented)
    static encodeResponse(fulfillment: RpcRequestFulfillment): MobileRpcChunks;
    // (undocumented)
    static obtainInterop(): MobileRpcGateway;
    // (undocumented)
    requests: Map<string, MobileRpcRequest>;
    // (undocumented)
    readonly requestType: typeof MobileRpcRequest;
    // (undocumented)
    sendToBackend(message: MobileRpcChunks): void;
    // (undocumented)
    sendToFrontend(message: MobileRpcChunks, connection?: number): void;
    // (undocumented)
    socket: WebSocket;
    }

// @beta (undocumented)
export class MobileRpcRequest extends RpcRequest {
    protected load(): Promise<RpcSerializedValue>;
    // @internal (undocumented)
    notifyResponse(fulfillment: RpcRequestFulfillment): void;
    readonly protocol: MobileRpcProtocol;
    protected send(): Promise<number>;
    protected setHeader(_name: string, _value: string): void;
}

// @beta (undocumented)
export enum Orientation {
    // (undocumented)
    FaceDown = 32,
    // (undocumented)
    FaceUp = 16,
    // (undocumented)
    LandscapeLeft = 4,
    // (undocumented)
    LandscapeRight = 8,
    // (undocumented)
    Portrait = 1,
    // (undocumented)
    PortraitUpsideDown = 2,
    // (undocumented)
    Unknown = 0
}

// @beta
export enum RpcMobilePlatform {
    // (undocumented)
    Android = 1,
    // (undocumented)
    iOS = 2,
    // (undocumented)
    Unknown = 0
}

// @internal
export class SasUrlExpired extends BentleyError {
    constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction);
}

// @internal
export class UserCancelledError extends BentleyError {
    constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction);
}


// (No @packageDocumentation comment for this package)

```
