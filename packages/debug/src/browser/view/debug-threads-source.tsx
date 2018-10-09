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

import { injectable, inject, postConstruct } from 'inversify';
import { Event, Emitter } from '@theia/core/lib/common';
import { ConsoleSession, ConsoleItem } from '@theia/console/lib/browser/console-session';
import { DebugSessionManager } from '../debug-session-manager';

@injectable()
export class DebugThreadsSource implements ConsoleSession {

    id = 'Threads';
    name = 'Threads';
    items: ConsoleItem[] = [];
    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        this.refresh();
        this.manager.onDidChange(() => this.refresh());
    }

    protected refresh(): void {
        this.items = this.getItems();
        this.onDidChangeEmitter.fire(undefined);
    }

    get multiSesssion(): boolean {
        const { sessions } = this.manager;
        return sessions.length > 1;
    }

    protected getItems(): ConsoleItem[] {
        const sessions = this.manager.sessions;
        if (sessions.length === 1) {
            const threads = [...sessions[0].threads];
            if (threads.length) {
                return threads;
            }
        }
        return sessions;
    }

    execute(): void { /*no-op*/ }
    clear(): void { /*no-op*/ }
}
