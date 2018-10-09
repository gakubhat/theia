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
import { MenuPath } from '@theia/core/lib/common';
import { TreeNode, NodeProps } from '@theia/core/lib/browser';
import { ConsoleContentWidget } from '@theia/console/lib/browser/content/console-content-widget';
import { ConsoleSessionNode } from '@theia/console/lib/browser/content/console-content-tree';
import { createConsoleContentContainer } from '@theia/console/lib/browser/content/console-content-container';
import { DebugBreakpointsSource } from './debug-breakpoints-source';

@injectable()
export class DebugBreakpointsWidget extends ConsoleContentWidget {

    static CONTEXT_MENU: MenuPath = ['debug-breakpoints-context-menu'];
    static createContainer(parent: interfaces.Container): Container {
        const child = createConsoleContentContainer(parent, {
            contextMenuPath: DebugBreakpointsWidget.CONTEXT_MENU,
            virtualized: false
        });
        child.bind(DebugBreakpointsSource).toSelf();
        child.unbind(ConsoleContentWidget);
        child.bind(DebugBreakpointsWidget).toSelf();
        return child;
    }
    static createWidget(parent: interfaces.Container): DebugBreakpointsWidget {
        return DebugBreakpointsWidget.createContainer(parent).get(DebugBreakpointsWidget);
    }

    @inject(DebugBreakpointsSource)
    protected readonly source: DebugBreakpointsSource;

    @postConstruct()
    protected init(): void {
        super.init();
        this.id = 'debug:breakpoints';
        this.title.label = 'Breakpoints';
        this.addClass('theia-debug-entry');

        this.model.root = ConsoleSessionNode.to(this.source);
        this.toDispose.push(this.source.onDidChange(() => this.model.refresh()));
    }

    protected getDefaultNodeStyle(node: TreeNode, props: NodeProps): React.CSSProperties | undefined {
        return undefined;
    }

}
