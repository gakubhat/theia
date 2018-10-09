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

import { inject, postConstruct, injectable } from 'inversify';
import * as React from 'react';
import { Disposable } from '@theia/core';
import { ReactWidget } from '@theia/core/lib/browser/widgets';
import { DebugState } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugAction } from './debug-action';

/**
 * Debug toolbar.
 */
@injectable()
export class DebugToolBar extends ReactWidget {

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        this.id = 'debug:toolbar';
        this.addClass('debug-toolbar');
        this.update();
    }

    focus(): void {
        if (!this.doFocus()) {
            this.onRender.push(Disposable.create(() => this.doFocus()));
            this.update();
        }
    }
    protected doFocus(): boolean {
        if (!this.stepRef) {
            return false;
        }
        this.stepRef.focus();
        return true;
    }
    protected stepRef: DebugAction | undefined;
    protected setStepRef = (stepRef: DebugAction | null) => this.stepRef = stepRef || undefined;

    protected render(): React.ReactNode {
        const { state } = this.manager;
        return <React.Fragment>
            <DebugAction enabled={state !== DebugState.Inactive} run={this.stop} label='Stop' iconClass='stop' />
            <DebugAction enabled={state === DebugState.Stopped} run={this.continue} label='Resume' iconClass='play-circle' />
            <DebugAction enabled={state === DebugState.Running} run={this.pause} label='Suspend' iconClass='pause' />
            <DebugAction enabled={state === DebugState.Stopped} run={this.step} label='Step' iconClass='arrow-right' ref={this.setStepRef} />
            <DebugAction enabled={state === DebugState.Stopped} run={this.stepIn} label='Step In' iconClass='arrow-down' />
            <DebugAction enabled={state === DebugState.Stopped} run={this.stepOut} label='Step Out' iconClass='arrow-up' />
        </React.Fragment>;
    }

    protected stop = () => this.manager.currentSession && this.manager.currentSession.disconnect();
    protected continue = () => this.manager.currentThread && this.manager.currentThread.continue();
    protected pause = () => this.manager.currentThread && this.manager.currentThread.pause();
    protected step = () => this.manager.currentThread && this.manager.currentThread.next();
    protected stepIn = () => this.manager.currentThread && this.manager.currentThread.stepIn();
    protected stepOut = () => this.manager.currentThread && this.manager.currentThread.stepOut();


}
