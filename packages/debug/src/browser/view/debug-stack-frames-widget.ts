/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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

import { VirtualWidget, SELECTED_CLASS, } from '@theia/core/lib/browser';
import { h } from '@phosphor/virtualdom';
import { injectable, postConstruct, inject } from 'inversify';
import { DebugSessionManager } from '../debug-session-manager';

// FIXME: rewrite with React
@injectable()
export class DebugStackFramesWidget extends VirtualWidget {

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        this.id = 'debug:frames';
        this.title.label = 'Call Stack';
        this.addClass('theia-debug-entry');
    }

    protected render(): h.Child {
        const items: h.Child = [];

        const { currentThread } = this.manager;
        if (currentThread) {
            for (const frame of currentThread.frames) {
                const classNames = ['theia-debug-item'];
                if (frame === currentThread.currentFrame) {
                    classNames.push(SELECTED_CLASS);
                }
                const className = classNames.join(' ');
                const id = `debug-stack-frames-${frame.raw.id}`;

                const item =
                    h.div({
                        id, className,
                        onclick: () => {
                            currentThread.currentFrame = frame;
                            frame.open();
                        },
                        ondblclick: () => {
                            currentThread.currentFrame = frame;
                            frame.open({ mode: 'activate' });
                        }
                    }, frame.raw.name);

                items.push(item);
            }
        }

        return h.div({ className: 'theia-debug-frames' }, items);
    }

}
