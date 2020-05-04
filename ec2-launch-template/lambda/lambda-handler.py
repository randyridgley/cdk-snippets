import boto3
import os


def main(event, context):
    ec2 = boto3.client('ec2')
    fleet_id = os.environ['fleet_id']
    target_capacity = event['target_capacity']
    print('target_capacity ' + str(target_capacity))
    
    kwargs = {
            'FleetId': fleet_id,
            'TargetCapacitySpecification': {
                'TotalTargetCapacity': int(target_capacity)
            },
            'ExcessCapacityTerminationPolicy': 'termination',
    }
    response = ec2.modify_fleet(**kwargs)
    print(response)