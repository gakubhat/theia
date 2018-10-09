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

import { inject, injectable, postConstruct } from 'inversify';
import { BaseWidget, PanelLayout, Message } from '@theia/core/lib/browser';
import { ViewContainer } from '@theia/core/lib/browser/view-container';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugThreadsWidget } from './debug-threads-widget';
import { DebugStackFramesWidget } from './debug-stack-frames-widget';
import { DebugBreakpointsWidget } from './debug-breakpoints-widget';
import { DebugToolBar } from './debug-toolbar-widget';

// FIXME
import { ConsoleContentWidget } from '@theia/console/lib/browser/content/console-content-widget';
import { DebugVariablesSource } from '../view/debug-variables-source';
import { ConsoleSessionNode } from '@theia/console/lib/browser/content/console-content-tree';

@injectable()
export class DebugSessionWidget extends BaseWidget {

    @inject(DebugToolBar)
    protected readonly toolbar: DebugToolBar;

    @inject(DebugThreadsWidget)
    protected readonly threads: DebugThreadsWidget;

    @inject(DebugStackFramesWidget)
    protected readonly frames: DebugStackFramesWidget;

    // FIXME extract reusable tree data source
    @inject(ConsoleContentWidget)
    protected readonly variables: ConsoleContentWidget;
    @inject(DebugVariablesSource)
    protected readonly variablesSource: DebugVariablesSource;

    @inject(DebugBreakpointsWidget)
    protected readonly breakpoints: DebugBreakpointsWidget;

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        this.id = 'debug:session';
        this.title.closable = true;
        this.title.iconClass = 'fa debug-tab-icon';
        this.addClass('theia-session-container');

        const debugContainer = new ViewContainer();

        this.variables.id = 'debug:variables';
        this.variables.title.label = 'Variables';
        this.variables.model.root = ConsoleSessionNode.to(this.variablesSource);
        this.variables.scrollArea = debugContainer.node;
        this.toDispose.push(this.variablesSource.onDidChange(() => this.variables.model.refresh()));
        debugContainer.addWidget(this.variables);

        this.threads.scrollArea = debugContainer.node;
        debugContainer.addWidget(this.threads);
        debugContainer.addWidget(this.frames);

        this.breakpoints.scrollArea = debugContainer.node;
        debugContainer.addWidget(this.breakpoints);

        const layout = this.layout = new PanelLayout();
        layout.addWidget(this.toolbar);
        layout.addWidget(debugContainer);

        this.toDispose.push(this.manager.onDidChange(() => {
            this.toolbar.update();
            debugContainer.update();
        }));
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.toolbar.focus();
    }

}
