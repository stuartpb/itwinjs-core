/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { DropdownMenu, getUserColor, MenuItem, UserIcon, Text } from "@itwin/itwinui-react";
import { useAccessToken } from "./Authorization";
import { IModelApp } from "@itwin/core-frontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";

interface User {
  displayName: string;
  email: string;
  givenName: string;
  surname: string;
}

interface UserProfileResponse {
  user: User;
}

function useUserProfile() {
  const accessToken = useAccessToken();
  const [data, setData] = React.useState<UserProfileResponse>();
  React.useEffect(() => {
    (async function () {
      if (!accessToken) {
        setData(undefined);
        return;
      }

      const url = `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/users/me`;
      const result = await fetch(url, {
        headers: {
          "authorization": accessToken,
        },
      });
      const data = await result.json() as UserProfileResponse;
      setData(data);
    })();
  }, [accessToken]);
  return data;
}

function useAbbreviation(userProfile: User) {
  return React.useMemo(() => {
    return `${userProfile.givenName[0]}${userProfile.surname[0]}`;
  }, [userProfile]);
}

function useBackgroundColor(userProfile: User) {
  return React.useMemo(() => {
    return userProfile?.email ? getUserColor(userProfile.email) : undefined;
  }, [userProfile]);
}

function signOut() {
  const authorizationClient = IModelApp.authorizationClient;
  if (!(authorizationClient instanceof ElectronRendererAuthorization))
    return;
  void authorizationClient.signOut();
}

export default function UserProfile() {
  const userProfile = useUserProfile();
  if (!userProfile)
    return null;
  return <SignedInUserProfile user={userProfile.user} />;
}

interface UserProfileProps {
  user: User;
}

function SignedInUserProfile({ user }: UserProfileProps) {
  const backgroundColor = useBackgroundColor(user);
  const abbreviation = useAbbreviation(user);
  return (
    <div
      style={{
        position: "absolute",
        padding: "0.75em",
        right: 0,
      }}
    >
      <DropdownMenu menuItems={(close) => [
        <UserProfileMenu
          key={1}
          user={user}
          close={close}
        />
      ]}>
        <div style={{
          cursor: "pointer",
        }}>
          <UserIcon
            abbreviation={abbreviation}
            backgroundColor={backgroundColor}
            size="large"
          />
        </div>
      </DropdownMenu>
    </div>
  );
}

interface UserProfileMenuProps {
  user: User;
  close(): void;
}

function UserProfileMenu({ user, close }: UserProfileMenuProps) {
  return (
    <>
      <div style={{
        margin: "0 13px 6px 13px",
        padding: "13px 0 6px",
        borderBottom: "1px solid var(--iui-text-color)",
      }}>
        <Text>
          {user.givenName} {user.surname}
        </Text>
        <Text isMuted>
          {user.displayName}
        </Text>
      </div>
      <MenuItem onClick={() => {
        signOut();
        close();
      }}>
        Sign Out
      </MenuItem>
    </>
  );
}
