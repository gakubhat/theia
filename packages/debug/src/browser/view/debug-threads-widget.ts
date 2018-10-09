/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, postConstruct, interfaces, Container } from 'inversify';
import { MenuPath } from '@theia/core';
import { TreeNode, NodeProps, SelectableTreeNode } from '@theia/core/lib/browser';
import { ConsoleContentWidget } from '@theia/console/lib/browser/content/console-content-widget';
import { createConsoleContentContainer } from '@theia/console/lib/browser/content/console-content-container';
import { ConsoleSessionNode, ConsoleItemNode } from '@theia/console/lib/browser/content/console-content-tree';
import { DebugThreadsSource } from './debug-threads-source';
import { DebugSession } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugThread } from '../model/debug-thread';

@injectable()
export class DebugThreadsWidget extends ConsoleContentWidget {

    static CONTEXT_MENU: MenuPath = ['debug-threads-context-menu'];
    static createContainer(parent: interfaces.Container): Container {
        const child = createConsoleContentContainer(parent, {
            contextMenuPath: DebugThreadsWidget.CONTEXT_MENU,
            virtualized: false
        });
        child.bind(DebugThreadsSource).toSelf();
        child.unbind(ConsoleContentWidget);
        child.bind(DebugThreadsWidget).toSelf();
        return child;
    }
    static createWidget(parent: interfaces.Container): DebugThreadsWidget {
        return DebugThreadsWidget.createContainer(parent).get(DebugThreadsWidget);
    }

    @inject(DebugThreadsSource)
    protected readonly source: DebugThreadsSource;

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        super.init();
        this.id = 'debug:threads';
        this.title.label = 'Threads';
        this.addClass('theia-debug-entry');

        this.model.root = ConsoleSessionNode.to(this.source);
        this.toDispose.push(this.source.onDidChange(() => {
            this.model.refresh();
            const { currentThread } = this.manager;
            if (currentThread) {
                const node = this.model.getNode(currentThread.id);
                if (SelectableTreeNode.is(node)) {
                    this.model.selectNode(node);
                }
            }
        }));
        this.toDispose.push(this.model.onSelectionChanged(nodes => {
            const node = nodes[0];
            if (ConsoleItemNode.is(node)) {
                if (node.item instanceof DebugSession) {
                    this.manager.currentSession = node.item;
                } else if (node.item instanceof DebugThread) {
                    node.item.session.currentThread = node.item;
                }
            }
        }));
    }

    protected getDefaultNodeStyle(node: TreeNode, props: NodeProps): React.CSSProperties | undefined {
        if (this.source.multiSesssion) {
            return super.getDefaultNodeStyle(node, props);
        }
        return undefined;
    }

}
