#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BabbleboxAppPipelineStack } from './stack/pipeline';

const app = new cdk.App();
new BabbleboxAppPipelineStack(app, 'babblebox-app-pipeline');
