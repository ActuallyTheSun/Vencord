/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addContextMenuPatch, findGroupChildrenByChildId, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, Forms, Menu, UserStore } from "@webpack/common";
import { Channel, Message } from "discord-types/general/index.js";

import { ChannelsTabsContainer } from "./components";
import { BasicChannelTabsProps, channelTabsSettings, ChannelTabsUtils } from "./util.js";

const channelMentionContextMenuPatch: NavContextMenuPatchCallback = (children, props) =>
    () => {
        if (!props) return;
        const { channel, messageId }: { channel: Channel, messageId?: string; } = props;
        const group = findGroupChildrenByChildId("channel-copy-link", children);
        if (group)
            group.push(
                <Menu.MenuItem
                    label="Open In New Tab"
                    id="open-link-in-tab"
                    key="open-link-in-tab"
                    action={() => ChannelTabsUtils.createTab({
                        guildId: channel.guild_id,
                        channelId: channel.id
                    }, true, messageId)}
                />
            );
    };

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, props) =>
    () => {
        if (!props) return;
        const { channel }: { channel: Channel; } = props;
        const group = findGroupChildrenByChildId("channel-copy-link", children);
        if (group)
            group.push(
                <Menu.MenuItem
                    label="Open In New Tab"
                    id="open-link-in-tab"
                    key="open-link-in-tab"
                    action={() => ChannelTabsUtils.createTab({
                        guildId: channel.guild_id,
                        channelId: channel.id
                    }, true)}
                />
            );
    };

export default definePlugin({
    name: "ChannelTabs",
    description: "Group your commonly visited channels in tabs, like a browser",
    authors: [Devs.TheSun, Devs.TheKodeToad, Devs.keifufu],
    dependencies: ["ContextMenuAPI"],
    patches: [
        // add the channel tab container at the top
        {
            find: ".LOADING_DID_YOU_KNOW",
            replacement: {
                // tried to use lookarounds /\i\.Fragment,{(?<=\?void 0:(\i)\.channelId.{0,120})/ and patch times were consistently >30ms
                match: /(\?void 0:(\i)\.channelId.{0,120})\i\.Fragment,{/,
                replace: "$1$self.render,{currentChannel:$2,"
            }
        },
        // ctrl click to open in new tab in inbox
        {
            find: ".messageGroupWrapper,children",
            replacement: {
                match: /,\(function\(\i\){(?=return \i\((\i),(\i)\))/,
                replace: ",(function($2){if ($2.ctrlKey) return $self.open($1);"
            }
        },
        // ctrl click to open in new tab in search results
        {
            find: ".searchResultFocusRing",
            replacement: {
                match: /;(?=null!=(\i)&&\i\(\i\))/,
                replace: ";if (arguments[0].ctrlKey) return $self.open($1);"
            }
        }
    ],

    settings: channelTabsSettings,

    start() {
        addContextMenuPatch("channel-mention-context", channelMentionContextMenuPatch);
        addContextMenuPatch("channel-context", channelContextMenuPatch);
    },

    stop() {
        removeContextMenuPatch("channel-mention-context", channelContextMenuPatch);
        removeContextMenuPatch("channel-context", channelContextMenuPatch);
    },

    render({ currentChannel, children }: {
        currentChannel: BasicChannelTabsProps,
        children: JSX.Element; // original children passed by discord
    }) {
        const id = UserStore.getCurrentUser()?.id;
        return <>
            <ErrorBoundary>
                <ChannelsTabsContainer {...currentChannel} userId={id} />
            </ErrorBoundary>
            {children}
        </>;
    },

    open(message: Message) {
        const tab = {
            channelId: message.channel_id,
            guildId: ChannelStore.getChannel(message.channel_id)?.guild_id,
            compact: false
        };
        ChannelTabsUtils.createTab(tab, false, message.id);
    },

    settingsAboutComponent: () => {
        // @ts-ignore
        const { FormTitle, FormSection, FormText, KeyCombo } = Forms;
        return <>
            <FormTitle tag="h3">Keybinds</FormTitle>
            <Flex flexDirection="row">
                <FormSection>
                    <FormTitle>Switch between tabs</FormTitle>
                    <KeyCombo shortcut="mod+tab" />
                    <KeyCombo shortcut="mod+shift+tab" />
                </FormSection>
                <FormSection>
                    <FormTitle>Open and close tabs</FormTitle>
                    <KeyCombo shortcut="mod+n" />
                    <KeyCombo shortcut="mod+w" />
                </FormSection>
                <FormSection>
                    <Forms.FormTitle>Reopen a recently closed tab</Forms.FormTitle>
                    <KeyCombo shortcut="mod+shift+t" />
                </FormSection>
            </Flex>
            <FormText>You can also Ctrl+click on the Jump button of a search result to open it in a new tab</FormText>
        </>;
    },

    util: ChannelTabsUtils,

    flux: {
        PRESENCE_UPDATES: ChannelTabsUtils.onPresenceUpdate
    }
});
