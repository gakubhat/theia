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

import { injectable, postConstruct, inject } from 'inversify';
import { BaseWidget, PanelLayout, Message } from '@theia/core/lib/browser';
import { DebugSessionWidget } from './debug-session-widget';
import { DebugConfigurationWidget } from './debug-configuration-widget';

@injectable()
export class DebugWidget extends BaseWidget {

    static ID = 'debug';
    static LABEL = 'Debug';

    @inject(DebugConfigurationWidget)
    protected readonly toolbar: DebugConfigurationWidget;

    @inject(DebugSessionWidget)
    protected readonly sessionWidget: DebugSessionWidget;

    @postConstruct()
    protected init(): void {
        this.id = DebugWidget.ID;
        this.title.label = DebugWidget.LABEL;
        this.title.caption = DebugWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa debug-tab-icon';
        this.addClass('theia-debug-container');

        const layout = this.layout = new PanelLayout();
        layout.addWidget(this.toolbar);
        layout.addWidget(this.sessionWidget);
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.toolbar.focus();
    }

}
