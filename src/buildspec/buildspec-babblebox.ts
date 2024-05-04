export const buildspecBabblebox = {
    "version":"0.2",
    "env": {
      "secrets-manager": {
        "GITHUB_TOKEN": "github-token",
      },
      "variables": {
        "DOCKER_BUILDKIT": "1",
        //this wont work as the image tag is not available at the time of build
        "DOCKER_REGISTRY": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com",
        "IMAGE_TAG": "${IMAGE_TAG}"
      }
    },
    "phases": {
        "pre_build" : {
            "commands": [
                    'echo Logging in to Amazon ECR...',
                    'echo $AWS_DEFAULT_REGION',
                    'echo $AWS_ACCOUNT_ID',
                    'echo $DOCKER_REGISTRY',
                    'echo $IMAGE_TAG',
                    'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com'
                    ],
        },

        "build" : {
            "commands": [
                    'cd babblebox',
                    'ls -l',
                    'pwd',
                    'echo Building image...',
                    'DOCKER_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com" IMAGE_TAG="${IMAGE_TAG}" docker compose -f codebuild.yml build',
                ],
        },
        "post_build" : {
            "commands": [
                'echo Pushing the Docker images...',
                'DOCKER_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com" IMAGE_TAG="${IMAGE_TAG}" docker compose -f codebuild.yml push',
                'echo Build completed',
                'mkdir tmpbabblebox',
                'cd tmpbabblebox',
                'git clone https://${GITHUB_TOKEN}@github.com/shivaam/babblebox.git',
                'cd babblebox',
                'ls -l',
                'git checkout development@1.0',
                'cd babblebox',
                'sed -i "s/CODE_XTAG/${IMAGE_TAG}/g" k8s/*',
                'grep -i image k8s/*',
                'git add k8s/',
                'git config --global user.email "test.run@gmail.com"',
                'git config --global user.name "CodeBuild"',
                'git commit -m "updated image tag to ${IMAGE_TAG}"',
                'git checkout production-local', // Checkout the production-local branch
                'git merge development@1.0 --strategy-option=theirs --no-commit --no-ff', // Merge development@1.0 into production-local, favoring changes from development@1.0
                'git commit -m "Merged development@1.0 into production-local with image tag - ${IMAGE_TAG}"', // Commit the merge
                'git push -f origin production-local' // Force push the production-local branch
            ],
        },
    },
}