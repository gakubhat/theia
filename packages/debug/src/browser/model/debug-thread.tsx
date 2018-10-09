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

import * as React from 'react';
import { Event, Emitter } from '@theia/core';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { ConsoleItem } from '@theia/console/lib/browser/console-session';
import { DebugStackFrame } from './debug-stack-frame';
import debounce = require('p-debounce');
import { DebugSession } from '../debug-session';

export type StoppedDetails = DebugProtocol.StoppedEvent['body'] & {
    framesErrorMessage?: string
};

export class DebugThreadData {
    readonly raw: DebugProtocol.Thread;
    readonly stoppedDetails: StoppedDetails | undefined;
}

export class DebugThread extends DebugThreadData implements ConsoleItem {

    protected readonly onDidChangedEmitter = new Emitter<void>();
    readonly onDidChanged: Event<void> = this.onDidChangedEmitter.event;

    constructor(
        readonly session: DebugSession
    ) {
        super();
    }

    get id(): string {
        return this.session.id + ':' + this.raw.id;
    }

    protected _currentFrame: DebugStackFrame | undefined;
    get currentFrame(): DebugStackFrame | undefined {
        return this._currentFrame;
    }
    set currentFrame(frame: DebugStackFrame | undefined) {
        if (this._currentFrame !== frame) {
            this.setCurrentFrame(frame);
        }
    }

    get stopped(): boolean {
        return !!this.stoppedDetails;
    }

    update(data: Partial<DebugThreadData>): void {
        Object.assign(this, data);
    }

    clear(): void {
        this.update({
            raw: this.raw,
            stoppedDetails: undefined
        });
        this.doUpdateFrames([]);
    }

    continue(): Promise<DebugProtocol.ContinueResponse> {
        return this.session.sendRequest('continue', this.toArgs());
    }

    next(): Promise<DebugProtocol.NextResponse> {
        return this.session.sendRequest('next', this.toArgs());
    }

    stepIn(): Promise<DebugProtocol.StepInResponse> {
        return this.session.sendRequest('stepIn', this.toArgs());
    }

    stepOut(): Promise<DebugProtocol.StepOutResponse> {
        return this.session.sendRequest('stepOut', this.toArgs());
    }

    pause(): Promise<DebugProtocol.PauseResponse> {
        return this.session.sendRequest('pause', this.toArgs());
    }

    protected _frames = new Map<number, DebugStackFrame>();
    get frames(): IterableIterator<DebugStackFrame> {
        return this._frames.values();
    }

    readonly updateFrames = debounce(async () => {
        const frames = await this.fetchFrames();
        this.doUpdateFrames(frames);
    }, 100);
    protected async fetchFrames(): Promise<DebugProtocol.StackFrame[]> {
        try {
            const response = await this.session.sendRequest('stackTrace', this.toArgs<Partial<DebugProtocol.StackTraceArguments>>({
                format: {
                    parameters: true,
                    parameterTypes: true,
                    parameterNames: true,
                    parameterValues: true,
                    line: true,
                    module: true,
                    includeAll: true,
                    hex: false
                }
            }));
            return response.body.stackFrames;
        } catch (e) {
            if (this.stoppedDetails) {
                this.stoppedDetails.framesErrorMessage = e.message;
            }
            return [];
        }
    }
    protected doUpdateFrames(frames: DebugProtocol.StackFrame[]): void {
        const existing = this._frames;
        this._frames = new Map();
        for (const raw of frames) {
            const id = raw.id;
            const frame = existing.get(id) || new DebugStackFrame(this.session);
            this._frames.set(id, frame);
            frame.update({ raw });
        }
        this.updateCurrentFrame();
    }
    protected updateCurrentFrame(): void {
        const { currentFrame } = this;
        const frameId = currentFrame && currentFrame.raw.id;
        this.setCurrentFrame(typeof frameId === 'number' &&
            this._frames.get(frameId) ||
            this._frames.values().next().value);
    }

    protected toArgs<T extends object>(arg?: T): { threadId: number } & T {
        return Object.assign({}, arg, {
            threadId: this.raw.id
        });
    }

    protected async setCurrentFrame(frame: DebugStackFrame | undefined): Promise<void> {
        this._currentFrame = frame;
        this.onDidChangedEmitter.fire(undefined);
    }

    render(): React.ReactNode {
        const reason = this.stoppedDetails && this.stoppedDetails.reason;
        const status = this.stoppedDetails ? reason ? `Paused on ${reason}` : 'Paused' : 'Running';
        return <div className='theia-debug-thread' title='Thread'>
            <span className='label'>{this.raw.name}</span>
            <span className='status'>{status}</span>
        </div>;
    }

}
