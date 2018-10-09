/********************************************************************************
 * Copyright (C) TypeFox and others.
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

import { injectable, inject } from 'inversify';
import { StorageService } from '@theia/core/lib/browser';
import { MarkerManager } from '@theia/markers/lib/browser/marker-manager';
import URI from '@theia/core/lib/common/uri';
import { SourceBreakpoint, BREAKPOINT_KIND } from './breakpoint-marker';

@injectable()
export class BreakpointManager extends MarkerManager<SourceBreakpoint> {

    protected readonly owner = 'breakpoint';

    @inject(StorageService)
    protected readonly storage: StorageService;

    getKind(): string {
        return BREAKPOINT_KIND;
    }

    get breakpointsDisabled(): boolean {
        return false;
    }

    getBreakpoint(uri: URI, line: number): SourceBreakpoint | undefined {
        const marker = this.findMarkers({
            uri,
            dataFilter: breakpoint => breakpoint.raw.line === line
        })[0];
        return marker && marker.data;
    }

    setBreakpoints(uri: URI, breakpoints: SourceBreakpoint[]): void {
        this.setMarkers(uri, this.owner, breakpoints);
    }

    toggleBreakpoint(uri: URI, line: number, column?: number): void {
        const breakpoints = this.findMarkers({ uri }).map(marker => marker.data);
        const newBreakpoints = breakpoints.filter(breakpoint => breakpoint.raw.line !== line);
        if (breakpoints.length === newBreakpoints.length) {
            newBreakpoints.push({
                uri: uri.toString(),
                enabled: true,
                raw: {
                    line,
                    column
                }
            });
        }
        this.setBreakpoints(uri, newBreakpoints);
    }

    setBreakpointEnabled(uri: URI, line: number, enabled: boolean): void {
        const breakpoint = this.getBreakpoint(uri, line);
        if (breakpoint && breakpoint.enabled !== enabled) {
            breakpoint.enabled = enabled;
            this.fireOnDidChangeMarkers(uri);
        }
    }

    async load(): Promise<void> {
        const data = await this.storage.getData<BreakpointManager.Data>('breakpoints', {
            breakpoints: {}
        });
        // tslint:disable-next-line:forin
        for (const uri in data.breakpoints) {
            this.setBreakpoints(new URI(uri), data.breakpoints[uri]);
        }
    }

    save(): void {
        const data: BreakpointManager.Data = {
            breakpoints: {}
        };
        const uris = this.getUris();
        for (const uri of uris) {
            data.breakpoints[uri] = this.findMarkers({ uri: new URI(uri) }).map(marker => marker.data);
        }
        this.storage.setData('breakpoints', data);
    }

}
export namespace BreakpointManager {
    export interface Data {
        breakpoints: {
            [uri: string]: SourceBreakpoint[]
        }
    }
}
