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

import { injectable, inject, named, postConstruct } from 'inversify';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Emitter, Event, ContributionProvider, DisposableCollection } from '@theia/core';
import { LabelProvider } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { MessageType } from '@theia/core/lib/common/message-service-protocol';
import { DebugConfiguration, DebugService } from '../common/debug-service';
import { DebugState, DebugSession, INITIALIZE_ARGUMENTS } from './debug-session';
import { DebugSessionContribution, DebugSessionFactory } from './debug-session-contribution';
import { DebugThread } from './model/debug-thread';
import { DebugStackFrame } from './model/debug-stack-frame';
import { DebugBreakpoint } from './model/debug-breakpoint';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import URI from '@theia/core/lib/common/uri';
import { MessageClient } from '@theia/core';

@injectable()
export class DebugSessionManager {
    protected readonly _sessions = new Map<string, DebugSession>();
    protected readonly contribs = new Map<string, DebugSessionContribution>();

    protected readonly onDidCreateDebugSessionEmitter = new Emitter<DebugSession>();
    readonly onDidCreateDebugSession: Event<DebugSession> = this.onDidCreateDebugSessionEmitter.event;

    protected readonly onDidChangeActiveDebugSessionEmitter = new Emitter<[DebugSession | undefined, DebugSession | undefined]>();
    readonly onDidChangeActiveDebugSession: Event<[DebugSession | undefined, DebugSession | undefined]> = this.onDidChangeActiveDebugSessionEmitter.event;

    protected readonly onDidDestroyDebugSessionEmitter = new Emitter<DebugSession>();
    readonly onDidDestroyDebugSession: Event<DebugSession> = this.onDidDestroyDebugSessionEmitter.event;

    protected readonly onDidChangeBreakpointsEmitter = new Emitter<URI>();
    readonly onDidChangeBreakpoints: Event<URI> = this.onDidChangeBreakpointsEmitter.event;
    protected fireDidChangeBreakpoints(uri: URI): void {
        this.onDidChangeBreakpointsEmitter.fire(uri);
    }

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    @inject(DebugSessionFactory)
    protected readonly debugSessionFactory: DebugSessionFactory;

    @inject(ContributionProvider) @named(DebugSessionContribution)
    protected readonly contributions: ContributionProvider<DebugSessionContribution>;

    @inject(DebugService)
    protected readonly debugService: DebugService;

    @inject(MessageClient)
    protected readonly messages: MessageClient;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(BreakpointManager)
    protected readonly breakpoints: BreakpointManager;

    @postConstruct()
    protected init(): void {
        for (const contrib of this.contributions.getContributions()) {
            this.contribs.set(contrib.debugType, contrib);
        }
        this.breakpoints.onDidChangeMarkers(uri => this.fireDidChangeBreakpoints(uri));
    }

    async start(configuration: DebugConfiguration): Promise<DebugSession> {
        const session = await this.debugService.create(configuration);
        return this.create(session, configuration);
    }

    /**
     * Creates a new [debug session](#DebugSession).
     * @param sessionId The session identifier
     * @param configuration The debug configuration
     * @returns The debug session
     */
    async create(sessionId: string, debugConfiguration: DebugConfiguration): Promise<DebugSession> {
        const contrib = this.contribs.get(debugConfiguration.type);
        const sessionFactory = contrib ? contrib.debugSessionFactory() : this.debugSessionFactory;
        const session = sessionFactory.get(sessionId, debugConfiguration);
        this._sessions.set(sessionId, session);

        this.onDidCreateDebugSessionEmitter.fire(session);

        session.onDidChange(() => this.updateCurrentSession(session));
        session.on('terminated', event => this.disconnect(session, event));
        session.on('exited', () => this.destroy(session.id));
        this.launchOrAttach(session);
        return session;
    }

    protected disconnect(session: DebugSession, event: DebugProtocol.TerminatedEvent): void {
        const restart = event.body && event.body.restart;
        if (restart) {
            this.restart(session, restart);
        } else {
            session.disconnect();
        }
    }

    protected async restart(session: DebugSession, restart: Object): Promise<void> {
        await session.disconnect({ restart: true });
        await this.launchOrAttach(session);
    }

    protected async launchOrAttach(session: DebugSession): Promise<void> {
        const initializeArgs: DebugProtocol.InitializeRequestArguments = {
            ...INITIALIZE_ARGUMENTS,
            adapterID: session.configuration.type
        };
        const request = session.configuration.request;
        switch (request) {
            case 'attach': {
                await this.attach(session, initializeArgs);
                break;
            }
            case 'launch': {
                await this.launch(session, initializeArgs);
                break;
            }
            default: throw new Error(`Unsupported request '${request}' type.`);
        }
    }

    private async attach(session: DebugSession, initializeArgs: DebugProtocol.InitializeRequestArguments): Promise<void> {
        await session.initialize(initializeArgs);

        const attachArgs: DebugProtocol.AttachRequestArguments = Object.assign(session.configuration, { __restart: false });
        try {
            await session.sendRequest('attach', attachArgs);
        } catch (cause) {
            this.onSessionInitializationFailed(session, cause as DebugProtocol.Response);
            throw cause;
        }
    }

    private async launch(session: DebugSession, initializeArgs: DebugProtocol.InitializeRequestArguments): Promise<void> {
        await session.initialize(initializeArgs);

        const launchArgs: DebugProtocol.LaunchRequestArguments = Object.assign(session.configuration, { __restart: false, noDebug: false });
        try {
            await session.sendRequest('launch', launchArgs);
        } catch (cause) {
            this.onSessionInitializationFailed(session, cause as DebugProtocol.Response);
            throw cause;
        }
    }

    private async onSessionInitializationFailed(session: DebugSession, cause: DebugProtocol.Response): Promise<void> {
        this.destroy(session.id);
        await this.messages.showMessage({
            type: MessageType.Error,
            text: cause.message || 'Debug session initialization failed. See console for details.',
            options: {
                timeout: 10000
            }
        });
    }

    protected remove(sessionId: string): void {
        this._sessions.delete(sessionId);
        const { currentSession } = this;
        if (currentSession && currentSession.id === sessionId) {
            this.updateCurrentSession(undefined);
        }
    }

    getSession(sessionId: string): DebugSession | undefined {
        return this._sessions.get(sessionId);
    }

    get sessions(): DebugSession[] {
        return Array.from(this._sessions.values()).filter(session => session.state > DebugState.Inactive);
    }

    protected _currentSession: DebugSession | undefined;
    get currentSession(): DebugSession | undefined {
        return this._currentSession;
    }
    set currentSession(session: DebugSession | undefined) {
        if (this._currentSession !== session)  {
            this.setCurrentSession(session);
        }
    }
    protected readonly toDisposeOnCurrentSession = new DisposableCollection();
    protected setCurrentSession(session: DebugSession | undefined) {
        this.toDisposeOnCurrentSession.dispose();
        const { currentSession } = this;
        this._currentSession = session;
        this.onDidChangeActiveDebugSessionEmitter.fire([currentSession, session]);
        if (session) {
            this.toDisposeOnCurrentSession.push(session.onDidChange(() => this.fireDidChange()));
            this.toDisposeOnCurrentSession.push(session.onDidChangeBreakpoints(uri => this.fireDidChangeBreakpoints(uri)));
        }
        this.updateBreakpoints(currentSession, session);
        this.fireDidChange();
    }
    protected updateBreakpoints(previous: DebugSession | undefined, current: DebugSession | undefined): void {
        const affectedUri = new Set();
        for (const session of [previous, current]) {
            if (session) {
                for (const uriString of session.breakpointUris) {
                    if (!affectedUri.has(uriString)) {
                        affectedUri.add(uriString);
                        this.fireDidChangeBreakpoints(new URI(uriString));
                    }
                }
            }
        }
    }
    protected updateCurrentSession(session: DebugSession | undefined) {
        this.setCurrentSession(session || this.sessions[0]);
    }

    get currentThread(): DebugThread | undefined {
        const session = this.currentSession;
        return session && session.currentThread;
    }

    get state(): DebugState {
        const session = this.currentSession;
        return session ? session.state : DebugState.Inactive;
    }

    get currentFrame(): DebugStackFrame | undefined {
        const { currentThread } = this;
        return currentThread && currentThread.currentFrame;
    }

    /**
     * Destroy the debug session. If session identifier isn't provided then
     * all active debug session will be destroyed.
     * @param sessionId The session identifier
     */
    destroy(sessionId?: string): void {
        if (sessionId) {
            const session = this._sessions.get(sessionId);
            if (session) {
                this.doDestroy(session);
            }
        } else {
            this._sessions.forEach(session => this.doDestroy(session));
        }
    }

    private doDestroy(session: DebugSession): void {
        this.debugService.stop(session.id);

        session.dispose();
        this.remove(session.id);
        this.onDidDestroyDebugSessionEmitter.fire(session);
    }

    getBreakpoints(session?: DebugSession): DebugBreakpoint[];
    getBreakpoints(uri: URI, session?: DebugSession): DebugBreakpoint[];
    getBreakpoints(arg?: URI | DebugSession, arg2?: DebugSession): DebugBreakpoint[] {
        const uri = arg instanceof URI ? arg : undefined;
        const session = arg instanceof DebugSession ? arg : arg2 instanceof DebugSession ? arg2 : this.currentSession;
        if (session && session.state > DebugState.Initializing) {
            return session.getBreakpoints();
        }
        return this.breakpoints.findMarkers({ uri }).map(({ data }) => new DebugBreakpoint({ data }, this.labelProvider, this.breakpoints, this.editorManager));
    }

}
