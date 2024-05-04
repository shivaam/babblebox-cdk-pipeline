import * as pipeline from 'aws-cdk-lib/pipelines';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { v4 as uuidv4 } from 'uuid';
import { buildspecBabblebox } from '../buildspec/buildspec-babblebox';
import { Construct } from 'constructs';
import { Stage } from 'aws-cdk-lib';

const imageTag = `latest-${uuidv4().split('-').pop()}`;
const PIPELINE_GITHUB_REPO = 'shivaam/babblebox-cdk-pipeline';
const WEBSITE_GITHUB_REPO = 'shivaam/babblebox';

export class ApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

class ApplicationStage extends Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new ApplicationStack(this, 'empty-stack');
  }
}

export class BabbleboxAppPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repositoryNames = [
      'babblebox_production_django',
      'babblebox_production_traefik',
    ];

    // //create ecr repos - can only be created one time since it is a resource with a fixed name'
    // Cfn does not allow creating multiple times with the same name
    
    // const ecrRepos = repositoryNames.map(repoName => new ecr.Repository(this, repoName, {
    //   repositoryName: repoName,
    // }));

    const ecrRepos = repositoryNames.map(repoName => ecr.Repository.fromRepositoryName(this, repoName, repoName));

    const ecrRegistry = ecrRepos[0].repositoryArn.split("/")[0];

    const buildSpec = codebuild.BuildSpec.fromObject(buildspecBabblebox);

    const gitHubSourceCdk = pipeline.CodePipelineSource.gitHub(PIPELINE_GITHUB_REPO, "development@0.1", {
      authentication: cdk.SecretValue.secretsManager("github-token"),
    });

    const gitHubSourceApp = pipeline.CodePipelineSource.gitHub(WEBSITE_GITHUB_REPO, "development@1.0", {
      authentication: cdk.SecretValue.secretsManager("github-token"),
    });

    const babbleboxPipeline = new pipeline.CodePipeline(this, "ContainerPipeline", {
      selfMutation: true,
      pipelineName: "babblebox-app-pipeline",
      synth: new pipeline.ShellStep("Synth", {
        input: gitHubSourceCdk,
        commands: ["npm install -g aws-cdk", "npm install", "cdk synth"],
      }),
    });


    const buildContainerProject = new pipeline.CodeBuildStep("ContainerBuild", {
      buildEnvironment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      input: gitHubSourceApp,
      partialBuildSpec: buildSpec,
      commands: [],
      env: {
        ECR_REGISTRY: ecrRegistry,
        AWS_ACCOUNT_ID: this.account,
        IMAGE_TAG:imageTag
      },
      // Configure local cache for Docker layers
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER)
    });

    babbleboxPipeline.addStage(new ApplicationStage(this, 'buildAndPush'), {
      pre: [buildContainerProject]
    });
    //Add buildContainerProject stage to the pipeline that just does the build and push to ECR
    babbleboxPipeline.buildPipeline();
    ecrRepos.forEach((repo) => {
      repo.grantPullPush(buildContainerProject.project);
    });


    buildContainerProject.project.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ecr:GetAuthorizationToken"],
      resources: ["*"],
    }));
    //allow pulling secrets from secrets manager for github token
    buildContainerProject.project.addToRolePolicy(new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: ["*"],
    }));
  }
} 