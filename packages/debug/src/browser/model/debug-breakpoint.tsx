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
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { RecursivePartial } from '@theia/core';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, Range } from '@theia/editor/lib/browser';
import { LabelProvider, DISABLED_CLASS, WidgetOpenerOptions } from '@theia/core/lib/browser';
import { ConsoleItem } from '@theia/console/lib/browser/console-session';
import { DebugSession } from '../debug-session';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugSource } from './debug-source';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';

export class DebugBreakpointData {
    readonly raw?: DebugProtocol.Breakpoint;
    readonly data: SourceBreakpoint;
}

export class DebugBreakpoint extends DebugBreakpointData implements ConsoleItem {

    readonly uri: URI;

    constructor(
        data: DebugBreakpointData,
        protected readonly labelProvider: LabelProvider,
        protected readonly breakpoints: BreakpointManager,
        protected readonly editorManager: EditorManager,
        protected readonly session?: DebugSession
    ) {
        super();
        Object.assign(this, data);
        this.uri = new URI(this.data.uri);
    }
    update(data: Partial<DebugBreakpointData>): void {
        Object.assign(this, data);
    }

    get id(): string | undefined {
        return this.raw && String(this.raw.id);
    }

    get enabled(): boolean {
        return this.data.enabled;
    }

    get installed(): boolean {
        return !!this.raw;
    }

    get verified(): boolean {
        return this.raw && this.raw.verified || true;
    }
    get message(): string {
        return this.raw && this.raw.message || '';
    }

    /** 1-based */
    get line(): number {
        return this.raw && this.raw.line || this.data.raw.line;
    }
    get column(): number | undefined {
        return this.raw && this.raw.column || this.data.raw.column;
    }
    get endLine(): number | undefined {
        return this.raw && this.raw.endLine;
    }
    get endColumn(): number | undefined {
        return this.raw && this.raw.endColumn;
    }

    get source(): DebugSource | undefined {
        return this.raw && this.raw.source && this.session && this.session.getSource(this.raw.source);
    }

    async open(options: WidgetOpenerOptions = {
        mode: 'reveal'
    }): Promise<void> {
        const { line, column, endLine, endColumn } = this;
        const selection: RecursivePartial<Range> = {
            start: {
                line: line - 1,
                character: typeof column === 'number' ? column - 1 : undefined
            }
        };
        if (typeof endLine === 'number') {
            selection.end = {
                line: endLine - 1,
                character: typeof endColumn === 'number' ? endColumn - 1 : undefined
            };
        }
        if (this.source) {
            await this.source.open({
                ...options,
                selection
            });
        } else {
            this.editorManager.open(this.uri, {
                ...options,
                selection
            });
        }
    }

    render(): React.ReactNode {
        const classNames = ['theia-source-breakpoint'];
        if (!this.verified) {
            classNames.push(DISABLED_CLASS);
        }
        return <div title={this.message} className={classNames.join(' ')}>
            <input type='checkbox' checked={this.enabled} onChange={this.setBreakpointEnabled} />
            <span className='name'>{this.labelProvider.getName(this.uri)} </span>
            <span className='path'>{this.labelProvider.getLongName(this.uri.parent)} </span>
            <span className='line'>{this.line}</span>
        </div>;
    }

    protected readonly setBreakpointEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = event.target.checked;
        this.breakpoints.setBreakpointEnabled(this.uri, this.line, enabled);
    }

}
