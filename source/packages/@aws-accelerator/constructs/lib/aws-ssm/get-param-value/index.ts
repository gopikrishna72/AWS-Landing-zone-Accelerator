/**
 *  Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { throttlingBackOff } from '@aws-accelerator/utils';
import * as AWS from 'aws-sdk';
import * as console from 'console';
AWS.config.logger = console;

/**
 * get ssm parameter custom control
 *
 * @param event
 * @returns
 */
export async function handler(event: AWSLambda.CloudFormationCustomResourceEvent): Promise<
  | {
      PhysicalResourceId: string | undefined;
      Status: string;
    }
  | undefined
> {
  const region = event.ResourceProperties['region'];
  const invokingAccountID = event.ResourceProperties['invokingAccountID'];
  const parameterAccountID = event.ResourceProperties['parameterAccountID'];
  const assumeRoleArn = event.ResourceProperties['assumeRoleArn'];
  const parameterName = event.ResourceProperties['parameterName'];

  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      let ssmClient: AWS.SSM;
      if (invokingAccountID !== parameterAccountID) {
        const stsClient = new AWS.STS({ region: region });
        const assumeRoleCredential = await throttlingBackOff(() =>
          stsClient
            .assumeRole({
              RoleArn: assumeRoleArn,
              RoleSessionName: 'acceleratorAssumeRoleSession',
            })
            .promise(),
        );
        console.log(assumeRoleCredential);
        ssmClient = new AWS.SSM({
          region: region,
          credentials: {
            accessKeyId: assumeRoleCredential.Credentials!.AccessKeyId,
            secretAccessKey: assumeRoleCredential.Credentials!.SecretAccessKey,
            sessionToken: assumeRoleCredential.Credentials!.SessionToken,
            expireTime: assumeRoleCredential.Credentials!.Expiration,
          },
        });
      } else {
        ssmClient = new AWS.SSM({ region: region });
      }

      const response = await throttlingBackOff(() => ssmClient.getParameter({ Name: parameterName }).promise());

      console.log(response.Parameter!.Value);

      return { PhysicalResourceId: response.Parameter!.Value, Status: 'SUCCESS' };

    case 'Delete':
      // Do Nothing
      return {
        PhysicalResourceId: undefined,
        Status: 'SUCCESS',
      };
  }
}
