from __future__ import print_function
import datetime
import json
import boto3


# Creates an interactive pyspark spark session. 
# Python(kind=pyspark), R(kind=sparkr) and SQL(kind=sql) spark sessions can also be created by changing the value of kind.
def create_spark_session(master_dns, kind='pyspark'):
    # 8998 is the port on which the Livy server runs
    host = 'http://' + master_dns + ':8998'
    data = {'kind': kind}
    headers = {'Content-Type': 'application/json'}
    response = requests.post(host + '/sessions', data=json.dumps(data), headers=headers)
    logging.info(response.json())
    return response.headers

# Submits the scala code as a simple JSON command to the Livy server
def submit_statement(session_url, statement_path):
    statements_url = session_url + '/statements'
    with open(statement_path, 'r') as f:
        code = f.read()
    data = {'code': code}
    response = requests.post(statements_url, data=json.dumps(data), headers={'Content-Type': 'application/json'})
    logging.info(response.json())
    return response

# Function to help track the progress of the scala code submitted to Apache Livy
def track_statement_progress(master_dns, response_headers):
    statement_status = ''
    host = 'http://' + master_dns + ':8998'
    session_url = host + response_headers['location'].split('/statements', 1)[0]
    # Poll the status of the submitted scala code
    while statement_status != 'available':
            # If a statement takes longer than a few milliseconds to execute, Livy returns early and provides a statement URL that can be polled until it is complete:
            statement_url = host + response_headers['location']
            statement_response = requests.get(statement_url, headers={'Content-Type': 'application/json'})
            statement_status = statement_response.json()['state']
            logging.info('Statement status: ' + statement_status)

            #logging the logs
            lines = requests.get(session_url + '/log', headers={'Content-Type': 'application/json'}).json()['log']
            for line in lines:
                logging.info(line)

            if 'progress' in statement_response.json():
                logging.info('Progress: ' + str(statement_response.json()['progress']))
            time.sleep(10)
    final_statement_status = statement_response.json()['output']['status']
    if final_statement_status == 'error':
        logging.info('Statement exception: ' + statement_response.json()['output']['evalue'])
        for trace in statement_response.json()['output']['traceback']:
            logging.info(trace)
        raise ValueError('Final Statement Status: ' + final_statement_status)
    logging.info('Final Statement Status: ' + final_statement_status)

def handler(event, context):
    headers = emr.create_spark_session(cluster_dns, 'pyspark')
    session_url = emr.wait_for_idle_session(cluster_dns, headers)
    statement_response = emr.submit_statement(session_url,
                                                '/root/airflow/dags/transform/movies.scala')
    emr.track_statement_progress(cluster_dns, statement_response.headers)    