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

import { ApplicationShell, WidgetManager, AbstractViewContribution } from '@theia/core/lib/browser';
import { injectable, inject } from 'inversify';
import { JsonSchemaStore } from '@theia/core/lib/browser/json-schema-store';
import { InMemoryResources } from '@theia/core/lib/common';
import { DebugService } from '../common/debug-service';
import { IJSONSchema } from '@theia/core/lib/common/json-schema';
import URI from '@theia/core/lib/common/uri';
import { DebugSessionManager } from './debug-session-manager';
import { DebugWidget } from './view/debug-widget';
import { BreakpointManager } from './breakpoint/breakpoint-manager';

@injectable()
export class DebugFrontendApplicationContribution extends AbstractViewContribution<DebugWidget> {

    @inject(JsonSchemaStore) protected readonly jsonSchemaStore: JsonSchemaStore;
    @inject(InMemoryResources) protected readonly inmemoryResources: InMemoryResources;
    @inject(DebugService) protected readonly debugService: DebugService;

    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;
    @inject(DebugSessionManager) protected readonly manager: DebugSessionManager;

    @inject(BreakpointManager)
    protected readonly breakpoints: BreakpointManager;

    constructor() {
        super({
            widgetId: DebugWidget.ID,
            widgetName: DebugWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left'
            },
            toggleCommandId: 'debug:toggle',
            toggleKeybinding: 'ctrlcmd+shift+d'
        });
    }

    async initializeLayout(): Promise<void> {
        await this.openView();
    }

    async onStart(): Promise<void> {
        this.debugService.debugTypes().then(async types => {
            const launchSchemaUrl = new URI('vscode://debug/launch.json');
            const attributePromises = types.map(type => this.debugService.getSchemaAttributes(type));
            const schema: IJSONSchema = {
                ...launchSchema
            };
            const items = (<IJSONSchema>launchSchema!.properties!['configurations'].items);
            for (const attributes of await Promise.all(attributePromises)) {
                items.oneOf!.push(...attributes);
            }
            this.inmemoryResources.add(launchSchemaUrl, JSON.stringify(schema));
            this.jsonSchemaStore.registerSchema({
                fileMatch: ['launch.json'],
                url: launchSchemaUrl.toString()
            });
        });
        await this.breakpoints.load();
    }

    onStop(): void {
        this.breakpoints.save();
    }
}

// debug general schema
const defaultCompound = { name: 'Compound', configurations: [] };

const launchSchemaId = 'vscode://schemas/launch';
const launchSchema: IJSONSchema = {
    id: launchSchemaId,
    type: 'object',
    title: 'Launch',
    required: [],
    default: { version: '0.2.0', configurations: [], compounds: [] },
    properties: {
        version: {
            type: 'string',
            description: 'Version of this file format.',
            default: '0.2.0'
        },
        configurations: {
            type: 'array',
            description: 'List of configurations. Add new configurations or edit existing ones by using IntelliSense.',
            items: {
                defaultSnippets: [],
                'type': 'object',
                oneOf: []
            }
        },
        compounds: {
            type: 'array',
            description: 'List of compounds. Each compound references multiple configurations which will get launched together.',
            items: {
                type: 'object',
                required: ['name', 'configurations'],
                properties: {
                    name: {
                        type: 'string',
                        description: 'Name of compound. Appears in the launch configuration drop down menu.'
                    },
                    configurations: {
                        type: 'array',
                        default: [],
                        items: {
                            oneOf: [{
                                enum: [],
                                description: 'Please use unique configuration names.'
                            }, {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: {
                                        enum: [],
                                        description: 'Name of compound. Appears in the launch configuration drop down menu.'
                                    },
                                    folder: {
                                        enum: [],
                                        description: 'Name of folder in which the compound is located.'
                                    }
                                }
                            }]
                        },
                        description: 'Names of configurations that will be started as part of this compound.'
                    }
                },
                default: defaultCompound
            },
            default: [
                defaultCompound
            ]
        }
    }
};
